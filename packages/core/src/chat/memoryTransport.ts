// In-memory "server" for tests and the offline demo. It mirrors the row-level
// security rules of supabase/migrations/0004_chat.sql (members-only reads and
// writes, users manage only their own devices) so client logic is exercised
// against the same constraints. `raw` exposes the stored rows exactly as a
// database administrator would see them.

import { TransportError, type ChatTransport } from './transport'
import type { DeviceRecord, MemberRecord, MessageRecord, RoomKeyRecord, RoomRecord } from './types'

type Listener = { roomId: string; userId: string; fn: (m: MessageRecord) => void }

export class MemoryChatServer {
  readonly raw = {
    users: new Map<string, string>(), // email -> userId
    devices: [] as DeviceRecord[],
    rooms: [] as RoomRecord[],
    members: [] as MemberRecord[],
    roomKeys: [] as RoomKeyRecord[],
    messages: [] as MessageRecord[],
  }
  private listeners = new Set<Listener>()
  private nextId = 1

  registerUser(userId: string, email?: string) {
    if (email) this.raw.users.set(email.toLowerCase(), userId)
    else this.raw.users.set(userId, userId)
  }

  isMember(roomId: string, userId: string) {
    return this.raw.members.some((m) => m.roomId === roomId && m.userId === userId)
  }

  private sharesRoom(a: string, b: string) {
    if (a === b) return true
    const rooms = new Set(this.raw.members.filter((m) => m.userId === a).map((m) => m.roomId))
    return this.raw.members.some((m) => m.userId === b && rooms.has(m.roomId))
  }

  /** A transport authenticated as `userId` (what auth.uid() would be). */
  transportFor(userId: string): ChatTransport {
    const self = this
    const raw = this.raw
    const requireMember = (roomId: string) => {
      if (!self.isMember(roomId, userId)) throw new TransportError('forbidden', 'not a member of this room')
    }
    const clone = <T>(v: T): T => structuredClone(v)

    return {
      async publishDevice(device) {
        if (device.userId !== userId) throw new TransportError('forbidden', 'can only publish own devices')
        const i = raw.devices.findIndex((d) => d.deviceId === device.deviceId)
        if (i >= 0 && raw.devices[i].userId !== userId) throw new TransportError('forbidden', 'device id taken')
        if (i >= 0) raw.devices[i] = clone(device)
        else raw.devices.push(clone({ ...device, createdAt: device.createdAt ?? new Date().toISOString() }))
      },
      async revokeDevice(deviceId) {
        const d = raw.devices.find((x) => x.deviceId === deviceId)
        if (!d || d.userId !== userId) throw new TransportError('forbidden', 'can only revoke own devices')
        d.revokedAt = d.revokedAt ?? new Date().toISOString()
      },
      async listDevices(userIds) {
        // Mirrors chat_devices_select: own devices, co-members' devices, and
        // devices that sent a message or wrapped a room key in a room the
        // caller belongs to (so former members' messages and keys stay verifiable).
        const sentInMyRoom = (deviceId: string) =>
          raw.messages.some((m) => m.senderDevice === deviceId && self.isMember(m.roomId, userId)) ||
          raw.roomKeys.some((k) => k.wrappedByDevice === deviceId && self.isMember(k.roomId, userId))
        return clone(
          raw.devices.filter(
            (d) => userIds.includes(d.userId) && (self.sharesRoom(userId, d.userId) || sentInMyRoom(d.deviceId)),
          ),
        )
      },
      async resolveUser(identifier) {
        const id = identifier.trim()
        if ([...raw.users.values()].includes(id)) return id
        return raw.users.get(id.toLowerCase()) ?? null
      },
      async createRoom(room) {
        if (room.ownerId !== userId) throw new TransportError('forbidden', 'owner must be caller')
        if (raw.rooms.some((r) => r.id === room.id)) throw new TransportError('conflict', 'room exists')
        const row = { ...room, createdAt: new Date().toISOString() }
        raw.rooms.push(row)
        raw.members.push({ roomId: room.id, userId, role: 'owner' })
        return clone(row)
      },
      async listRooms() {
        return clone(raw.rooms.filter((r) => self.isMember(r.id, userId)))
      },
      async listMembers(roomId) {
        requireMember(roomId)
        return clone(raw.members.filter((m) => m.roomId === roomId))
      },
      async addMembers(roomId, userIds) {
        const room = raw.rooms.find((r) => r.id === roomId)
        if (!room || room.ownerId !== userId) throw new TransportError('forbidden', 'only the owner can add members')
        for (const u of userIds) {
          if (!self.isMember(roomId, u)) raw.members.push({ roomId, userId: u, role: 'member' })
        }
      },
      async removeMember(roomId, target) {
        const room = raw.rooms.find((r) => r.id === roomId)
        if (!room) throw new TransportError('not-found', 'no such room')
        if (room.ownerId !== userId && target !== userId) throw new TransportError('forbidden', 'only the owner can remove others')
        if (target === room.ownerId) throw new TransportError('forbidden', 'the owner cannot leave; delete the room instead')
        raw.members = raw.members.filter((m) => !(m.roomId === roomId && m.userId === target))
      },
      async latestKeyVersion(roomId) {
        requireMember(roomId)
        return raw.roomKeys.filter((k) => k.roomId === roomId).reduce((n, k) => Math.max(n, k.keyVersion), 0)
      },
      async listKeyRecipients(roomId, keyVersion) {
        requireMember(roomId)
        return raw.roomKeys.filter((k) => k.roomId === roomId && k.keyVersion === keyVersion).map((k) => k.deviceId)
      },
      async getWrappedKey(roomId, deviceId, keyVersion) {
        requireMember(roomId)
        const k = raw.roomKeys.find((r) => r.roomId === roomId && r.deviceId === deviceId && r.keyVersion === keyVersion)
        return k ? clone(k) : null
      },
      async putRoomKeys(rows) {
        for (const r of rows) {
          requireMember(r.roomId)
          if (r.wrappedByUser !== userId) throw new TransportError('forbidden', 'wrapped_by_user must be caller')
          const dev = raw.devices.find((d) => d.deviceId === r.wrappedByDevice)
          if (!dev || dev.userId !== userId || dev.revokedAt) throw new TransportError('forbidden', 'wrapping device not owned by caller')
          const recipient = raw.devices.find((d) => d.deviceId === r.deviceId)
          if (!recipient || recipient.revokedAt || !self.isMember(r.roomId, recipient.userId)) {
            throw new TransportError('forbidden', 'recipient device is not a room member')
          }
          if (raw.roomKeys.some((k) => k.roomId === r.roomId && k.keyVersion === r.keyVersion && k.deviceId === r.deviceId)) {
            throw new TransportError('conflict', 'key version already exists')
          }
        }
        for (const r of rows) raw.roomKeys.push(clone({ ...r, createdAt: new Date().toISOString() }))
      },
      async insertMessage(m) {
        requireMember(m.roomId)
        if (m.senderUser !== userId) throw new TransportError('forbidden', 'sender_user must be caller')
        const dev = raw.devices.find((d) => d.deviceId === m.senderDevice)
        if (!dev || dev.userId !== userId || dev.revokedAt) throw new TransportError('forbidden', 'sender device not owned by caller')
        if (raw.messages.some((x) => x.roomId === m.roomId && x.senderDevice === m.senderDevice && x.seq === m.seq)) {
          throw new TransportError('conflict', 'duplicate seq')
        }
        const row: MessageRecord = { ...clone(m), id: String(self.nextId++), createdAt: new Date().toISOString() }
        raw.messages.push(row)
        // Realtime: deliver asynchronously to members only (RLS applies to realtime too).
        for (const l of self.listeners) {
          if (l.roomId === m.roomId && self.isMember(m.roomId, l.userId)) {
            queueMicrotask(() => l.fn(clone(row)))
          }
        }
        return clone(row)
      },
      async listMessages(roomId, options) {
        requireMember(roomId)
        const limit = options?.limit ?? 100
        return clone(raw.messages.filter((m) => m.roomId === roomId).slice(-limit))
      },
      subscribe(roomId, fn) {
        const l: Listener = { roomId, userId, fn }
        self.listeners.add(l)
        return () => {
          self.listeners.delete(l)
        }
      },
    }
  }
}
