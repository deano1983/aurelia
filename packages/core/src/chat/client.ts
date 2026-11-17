// End-to-end encrypted chat client. Everything secret (device private keys,
// room keys, plaintext) stays inside this object and the device's IndexedDB;
// the transport only sees public keys, wrapped keys and ciphertext.

import { ctlHashToPacket, ctlPacketToHash, openCtlPacket, sealCtlPacket, type CtlPayload } from '../crypto/ctl'
import { deviceFingerprint, groupDigits, safetyNumber } from './fingerprint'
import {
  assertId,
  deviceRecordOf,
  generateDeviceIdentity,
  publicP256Jwk,
  type DeviceIdentity,
  type KeyStore,
} from './identity'
import { decryptMessage, encryptMessage, generateRoomKey, unwrapRoomKey, validateContent, wrapRoomKey } from './primitives'
import { TransportError, type ChatTransport } from './transport'
import type {
  ChatMessage,
  DeviceRecord,
  DeviceView,
  MemberRecord,
  MessageContent,
  MessageRecord,
  RoomKind,
  RoomRecord,
} from './types'

export type ChatClientOptions = {
  transport: ChatTransport
  keyStore: KeyStore
  userId: string
  /** Optional human label for this device, e.g. "MacBook (Chrome)". Public metadata. */
  deviceLabel?: string
}

function sameSet(a: Iterable<string>, b: Iterable<string>): boolean {
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size !== sb.size) return false
  for (const x of sa) if (!sb.has(x)) return false
  return true
}

export class ChatClient {
  readonly userId: string
  private readonly transport: ChatTransport
  private readonly keyStore: KeyStore
  private readonly deviceLabel?: string
  private identity: DeviceIdentity | null = null
  /** `${roomId}:${version}` -> non-extractable room key */
  private roomKeys = new Map<string, Promise<CryptoKey | null>>()
  /** deviceId -> public record (kept for the session so past senders stay verifiable) */
  private devices = new Map<string, DeviceRecord>()
  /** `${roomId}:${senderDevice}:${seq}` already surfaced */
  private seen = new Set<string>()

  constructor(options: ChatClientOptions) {
    this.userId = assertId(options.userId, 'user id')
    this.transport = options.transport
    this.keyStore = options.keyStore
    this.deviceLabel = options.deviceLabel
  }

  // -------------------------------------------------------------------------
  // Device identity
  // -------------------------------------------------------------------------

  /** Loads (or creates) this device's identity and publishes its public keys. */
  async init(): Promise<DeviceRecord> {
    let identity = await this.keyStore.loadIdentity(this.userId)
    if (!identity) {
      identity = await generateDeviceIdentity(this.userId)
      await this.keyStore.saveIdentity(identity)
    }
    this.identity = identity
    const record = deviceRecordOf(identity, this.deviceLabel)
    await this.transport.publishDevice(record)
    this.devices.set(record.deviceId, record)
    return record
  }

  /**
   * Discards this device's keys and creates a new device identity. Messages
   * sent under room keys wrapped for the old device become unreadable here;
   * other members' next send re-keys rooms to include the new device.
   */
  async resetDevice(): Promise<DeviceRecord> {
    await this.keyStore.deleteIdentity(this.userId)
    this.roomKeys.clear()
    this.identity = null
    return this.init()
  }

  private get id(): DeviceIdentity {
    if (!this.identity) throw new Error('ChatClient.init() has not completed')
    return this.identity
  }

  get deviceId(): string {
    return this.id.deviceId
  }

  get device(): DeviceRecord {
    return deviceRecordOf(this.id, this.deviceLabel)
  }

  async fingerprint(): Promise<string> {
    return groupDigits(await deviceFingerprint(this.device))
  }

  // -------------------------------------------------------------------------
  // Rooms and membership
  // -------------------------------------------------------------------------

  /** Resolves emails/user ids. Unknown identifiers are returned separately. */
  async resolveUsers(identifiers: string[]): Promise<{ userIds: string[]; unknown: string[] }> {
    const userIds: string[] = []
    const unknown: string[] = []
    for (const raw of identifiers.map((s) => s.trim()).filter(Boolean)) {
      const id = await this.transport.resolveUser(raw)
      if (id && id !== this.userId && !userIds.includes(id)) userIds.push(id)
      else if (!id) unknown.push(raw)
    }
    return { userIds, unknown }
  }

  async createRoom(input: { name: string; memberUserIds: string[]; kind?: RoomKind }): Promise<RoomRecord> {
    const name = input.name.trim().slice(0, 120) || 'Untitled room'
    const others = [...new Set(input.memberUserIds)].filter((u) => u !== this.userId)
    others.forEach((u) => assertId(u, 'user id'))
    const room = await this.transport.createRoom({
      id: crypto.randomUUID(),
      ownerId: this.userId,
      name,
      kind: input.kind ?? (others.length === 1 ? 'direct' : 'group'),
    })
    if (others.length) await this.transport.addMembers(room.id, others)
    await this.rotateRoomKey(room.id)
    return room
  }

  listRooms(): Promise<RoomRecord[]> {
    return this.transport.listRooms()
  }

  listMembers(roomId: string): Promise<MemberRecord[]> {
    return this.transport.listMembers(roomId)
  }

  /** Adds members and re-keys, so new members cannot read earlier messages. */
  async addMembers(roomId: string, userIds: string[]): Promise<number> {
    userIds.forEach((u) => assertId(u, 'user id'))
    await this.transport.addMembers(roomId, userIds)
    return this.rotateRoomKey(roomId)
  }

  /**
   * Removes a member and re-keys the room so the removed member's devices
   * cannot read anything sent afterwards. Leaving (removing yourself) skips
   * the re-key; the next remaining sender re-keys automatically.
   */
  async removeMember(roomId: string, userId: string): Promise<number | null> {
    await this.transport.removeMember(roomId, userId)
    if (userId === this.userId) {
      for (const k of [...this.roomKeys.keys()]) if (k.startsWith(`${roomId}:`)) this.roomKeys.delete(k)
      return null
    }
    return this.rotateRoomKey(roomId)
  }

  // -------------------------------------------------------------------------
  // Room keys
  // -------------------------------------------------------------------------

  private async memberDevices(roomId: string): Promise<DeviceRecord[]> {
    const members = await this.transport.listMembers(roomId)
    const devices = await this.transport.listDevices(members.map((m) => m.userId))
    const memberIds = new Set(members.map((m) => m.userId))
    const valid: DeviceRecord[] = []
    for (const d of devices) {
      try {
        publicP256Jwk(d.publicKey)
        publicP256Jwk(d.signingKey)
        assertId(d.deviceId, 'device id')
      } catch {
        continue // ignore malformed directory entries
      }
      this.devices.set(d.deviceId, d)
      if (!memberIds.has(d.userId) || d.revokedAt) continue
      valid.push(d)
    }
    return valid
  }

  /** Generates a fresh room key and wraps it for every current member device. */
  async rotateRoomKey(roomId: string, attempt = 0): Promise<number> {
    const me = this.id
    const devices = await this.memberDevices(roomId)
    if (!devices.some((d) => d.deviceId === me.deviceId)) devices.push(this.device)
    const version = (await this.transport.latestKeyVersion(roomId)) + 1
    const roomKey = await generateRoomKey()
    const rows = await Promise.all(
      devices.map(async (d) => ({
        roomId,
        keyVersion: version,
        deviceId: d.deviceId,
        wrappedKey: await wrapRoomKey(roomKey, me.ecdhPrivateKey, d.publicKey, {
          roomId,
          keyVersion: version,
          fromDevice: me.deviceId,
          toDevice: d.deviceId,
        }),
        wrappedByUser: me.userId,
        wrappedByDevice: me.deviceId,
      })),
    )
    try {
      await this.transport.putRoomKeys(rows)
    } catch (e) {
      // Another device rotated concurrently; take the next version.
      if (e instanceof TransportError && e.code === 'conflict' && attempt < 3) {
        return this.rotateRoomKey(roomId, attempt + 1)
      }
      throw e
    }
    // The extractable `roomKey` goes out of scope here; we use our own unwrapped copy.
    return version
  }

  /** The key version to send with, re-keying first if room devices changed. */
  private async sendVersion(roomId: string): Promise<number> {
    const latest = await this.transport.latestKeyVersion(roomId)
    if (latest === 0) return this.rotateRoomKey(roomId)
    const [recipients, devices] = await Promise.all([
      this.transport.listKeyRecipients(roomId, latest),
      this.memberDevices(roomId),
    ])
    if (!sameSet(recipients, devices.map((d) => d.deviceId))) return this.rotateRoomKey(roomId)
    return latest
  }

  private async deviceRecord(deviceId: string, userId: string): Promise<DeviceRecord | null> {
    const cached = this.devices.get(deviceId)
    if (cached) return cached.userId === userId ? cached : null
    const list = await this.transport.listDevices([userId])
    for (const d of list) this.devices.set(d.deviceId, d)
    const found = this.devices.get(deviceId)
    return found && found.userId === userId ? found : null
  }

  private roomKey(roomId: string, version: number): Promise<CryptoKey | null> {
    const cacheKey = `${roomId}:${version}`
    let p = this.roomKeys.get(cacheKey)
    if (!p) {
      p = (async () => {
        const me = this.id
        const row = await this.transport.getWrappedKey(roomId, me.deviceId, version)
        if (!row) return null
        const wrapper = await this.deviceRecord(row.wrappedByDevice, row.wrappedByUser)
        if (!wrapper) return null
        try {
          return await unwrapRoomKey(row.wrappedKey, me.ecdhPrivateKey, wrapper.publicKey, {
            roomId,
            keyVersion: version,
            fromDevice: row.wrappedByDevice,
            toDevice: me.deviceId,
          })
        } catch {
          return null
        }
      })()
      this.roomKeys.set(cacheKey, p)
      // Do not cache misses: the key may be published moments later.
      p.then((k) => {
        if (!k) this.roomKeys.delete(cacheKey)
      })
    }
    return p
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  async send(roomId: string, content: MessageContent): Promise<ChatMessage> {
    const me = this.id
    const valid = validateContent(content)
    const keyVersion = await this.sendVersion(roomId)
    const key = await this.roomKey(roomId, keyVersion)
    if (!key) throw new Error('room key unavailable for this device')
    const seq = await this.keyStore.nextSeq(this.userId)
    const header = { roomId, senderUser: me.userId, senderDevice: me.deviceId, seq, keyVersion }
    const record = await encryptMessage(header, valid, key, me.signPrivateKey)
    this.seen.add(`${roomId}:${me.deviceId}:${seq}`)
    const stored = await this.transport.insertMessage(record)
    return {
      ...header,
      id: stored.id,
      createdAt: stored.createdAt,
      sentAt: new Date().toISOString(),
      status: 'ok',
      content: valid,
    }
  }

  sendText(roomId: string, text: string): Promise<ChatMessage> {
    return this.send(roomId, { type: 'text', text })
  }

  /** Drops a sealed C.T.L. packet (a #ctl= link or fragment) into the room. */
  sendCtl(roomId: string, hashOrLink: string, label?: string): Promise<ChatMessage> {
    const packet = ctlHashToPacket(hashOrLink)
    if (!packet) throw new TypeError('not a #ctl= packet')
    return this.send(roomId, { type: 'ctl', hash: ctlPacketToHash(packet), label })
  }

  async decryptRecord(record: MessageRecord): Promise<ChatMessage> {
    const base: ChatMessage = {
      id: record.id,
      roomId: record.roomId,
      senderUser: record.senderUser,
      senderDevice: record.senderDevice,
      seq: record.seq,
      keyVersion: record.keyVersion,
      createdAt: record.createdAt,
      status: 'invalid',
    }
    try {
      const key = await this.roomKey(record.roomId, record.keyVersion)
      if (!key) return { ...base, status: 'no-key' }
      const sender = await this.deviceRecord(record.senderDevice, record.senderUser)
      if (!sender) return base
      const { content, sentAt } = await decryptMessage(record, key, sender.signingKey)
      return { ...base, status: 'ok', content, sentAt }
    } catch {
      return base
    }
  }

  /** Backfill: most recent messages, oldest first, decrypted. */
  async history(roomId: string, limit = 100): Promise<ChatMessage[]> {
    const records = await this.transport.listMessages(roomId, { limit })
    const out: ChatMessage[] = []
    for (const r of records) {
      this.seen.add(`${r.roomId}:${r.senderDevice}:${r.seq}`)
      out.push(await this.decryptRecord(r))
    }
    return out
  }

  /** Live messages (excluding ones this client sent or already returned). */
  subscribe(roomId: string, onMessage: (message: ChatMessage) => void): () => void {
    return this.transport.subscribe(roomId, (record) => {
      const k = `${record.roomId}:${record.senderDevice}:${record.seq}`
      if (record.roomId !== roomId || this.seen.has(k)) return
      this.seen.add(k)
      void this.decryptRecord(record).then(onMessage)
    })
  }

  // -------------------------------------------------------------------------
  // Verification
  // -------------------------------------------------------------------------

  /** All devices in the room with fingerprints, pairwise safety numbers and local verification state. */
  async roomDevices(roomId: string): Promise<DeviceView[]> {
    const devices = await this.memberDevices(roomId)
    const verified = await this.keyStore.loadVerified(this.userId)
    const mine = this.device
    return Promise.all(
      devices.map(async (d) => {
        const fp = await deviceFingerprint(d)
        return {
          ...d,
          fingerprint: groupDigits(fp),
          safetyNumber: await safetyNumber(mine, d),
          verified: verified[d.deviceId] === fp,
          isSelf: d.deviceId === mine.deviceId,
        }
      }),
    )
  }

  /** Records (or clears) that the user compared this device's safety number out of band. */
  async setVerified(device: DeviceRecord, verified: boolean): Promise<void> {
    const fp = verified ? await deviceFingerprint(device) : null
    await this.keyStore.setVerified(this.userId, device.deviceId, fp)
  }
}

// ---------------------------------------------------------------------------
// Room passphrase mode (C.T.L. relay compatible)
// ---------------------------------------------------------------------------

/**
 * Seals a note as a C.T.L. relay packet under a room passphrase. The result is
 * a `#ctl=` fragment that opens in 04 C.T.L. Relay or in any chat room member's
 * client with the same passphrase. The passphrase is never sent anywhere.
 */
export async function sealRoomPacket(
  note: string,
  passphrase: string,
  meta: { roomName?: string; subject?: string; sender?: string } = {},
): Promise<string> {
  const packet = await sealCtlPacket(
    {
      senderDesk: meta.sender ?? 'Aurelia Chat',
      channel: meta.roomName ?? '',
      subject: meta.subject ?? '',
      confidentialNote: note,
    },
    passphrase,
  )
  return ctlPacketToHash(packet)
}

/** Opens a `ctl` message (or any #ctl= link) with a room passphrase. Throws PacketError. */
export async function openRoomPacket(hashOrLink: string, passphrase: string): Promise<CtlPayload> {
  const packet = ctlHashToPacket(hashOrLink)
  if (!packet) throw new TypeError('not a #ctl= packet')
  return openCtlPacket(packet, passphrase)
}
