import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToBase64Url } from '../crypto/encoding'
import { PacketError } from '../crypto/packet'
import {
  ChatClient,
  IndexedDbKeyStore,
  MemoryChatServer,
  MemoryKeyStore,
  deviceFingerprint,
  generateDeviceIdentity,
  openRoomPacket,
  safetyNumber,
  sealRoomPacket,
  type ChatMessage,
  type MessageRecord,
} from './index'
import { decryptMessage, unwrapRoomKey } from './primitives'
import { ctlHashToPacket, ctlPacketToHash, sealCtlPacket } from '../crypto/ctl'
import type { PacketV2 } from '../crypto/packet'

async function setup(...users: string[]) {
  const server = new MemoryChatServer()
  const clients: Record<string, ChatClient> = {}
  for (const u of users) {
    server.registerUser(u, `${u}@example.test`)
    clients[u] = new ChatClient({ transport: server.transportFor(u), keyStore: new MemoryKeyStore(), userId: u })
    await clients[u].init()
  }
  return { server, clients }
}

function nextMessage(client: ChatClient, roomId: string): Promise<ChatMessage> {
  return new Promise((resolve) => {
    const off = client.subscribe(roomId, (m) => {
      off()
      resolve(m)
    })
  })
}

const text = (m: ChatMessage) => (m.content?.type === 'text' ? m.content.text : undefined)

describe('encrypted chat', () => {
  it('two devices exchange messages through the in-memory transport', async () => {
    const { server, clients } = await setup('alice', 'bob')
    const { alice, bob } = clients
    const room = await alice.createRoom({ name: 'Board prep', memberUserIds: ['bob'] })
    expect(room.kind).toBe('direct')
    expect((await bob.listRooms()).map((r) => r.id)).toEqual([room.id])

    const live = nextMessage(bob, room.id)
    await alice.sendText(room.id, 'Q3 numbers are final — hold until 09:30.')
    const received = await live
    expect(received.status).toBe('ok')
    expect(text(received)).toBe('Q3 numbers are final — hold until 09:30.')
    expect(received.senderUser).toBe('alice')

    await bob.sendText(room.id, 'Acknowledged.')
    const history = await alice.history(room.id)
    expect(history.map(text)).toEqual(['Q3 numbers are final — hold until 09:30.', 'Acknowledged.'])
    expect(history.every((m) => m.status === 'ok')).toBe(true)

    // The server only holds ciphertext.
    const stored = JSON.stringify(server.raw)
    expect(stored).not.toContain('Q3 numbers')
    expect(stored).not.toContain('Acknowledged')
    expect(stored).not.toContain('"d"') // no private JWK members anywhere
  })

  it('resolves invitees by email', async () => {
    const { clients } = await setup('alice', 'bob')
    const r = await clients.alice.resolveUsers(['BOB@example.test', 'nobody@example.test', 'alice'])
    expect(r).toEqual({ userIds: ['bob'], unknown: ['nobody@example.test'] })
  })

  it('removed member cannot decrypt messages after rotation', async () => {
    const { server, clients } = await setup('alice', 'bob', 'carol')
    const { alice, bob, carol } = clients
    const room = await alice.createRoom({ name: 'Deal room', memberUserIds: ['bob', 'carol'] })
    await alice.sendText(room.id, 'before removal')
    expect((await carol.history(room.id)).map(text)).toEqual(['before removal'])

    // Capture carol's device secrets as they would exist on her stolen laptop.
    const carolIdentity = await (carol as unknown as { keyStore: MemoryKeyStore }).keyStore.loadIdentity('carol')
    const v1Row = server.raw.roomKeys.find((k) => k.roomId === room.id && k.deviceId === carol.deviceId)!

    const newVersion = await alice.removeMember(room.id, 'carol')
    expect(newVersion).toBe(2)
    await alice.sendText(room.id, 'after removal')
    expect((await bob.history(room.id)).map(text)).toEqual(['before removal', 'after removal'])

    // Server-side access control blocks her...
    await expect(carol.history(room.id)).rejects.toThrow(/not a member/)
    // ...and even with a full copy of the database she has no key for v2.
    expect(server.raw.roomKeys.some((k) => k.keyVersion === 2 && k.deviceId === carol.deviceId)).toBe(false)
    const after = server.raw.messages.find((m) => m.keyVersion === 2)!
    const oldKey = await unwrapRoomKey(v1Row.wrappedKey, carolIdentity!.ecdhPrivateKey, alice.device.publicKey, {
      roomId: room.id,
      keyVersion: 1,
      fromDevice: alice.deviceId,
      toDevice: carol.deviceId,
    })
    // Old key + relabelling the message as v1 still fails (version is in the AAD and signature).
    await expect(decryptMessage({ ...after, keyVersion: 1 }, oldKey, alice.device.signingKey)).rejects.toThrow()
    await expect(decryptMessage(after, oldKey, alice.device.signingKey)).rejects.toThrow()
  })

  it('a member who leaves is excluded by the next sender automatically', async () => {
    const { server, clients } = await setup('alice', 'bob', 'carol')
    const { alice, bob, carol } = clients
    const room = await alice.createRoom({ name: 'Ops', memberUserIds: ['bob', 'carol'] })
    await carol.removeMember(room.id, 'carol') // leaves; cannot re-key herself
    await bob.sendText(room.id, 'carol has left')
    const latest = server.raw.messages.at(-1)!
    expect(latest.keyVersion).toBe(2)
    const recipients = server.raw.roomKeys.filter((k) => k.keyVersion === 2).map((k) => k.deviceId)
    expect(recipients).not.toContain(carol.deviceId)
    expect((await alice.history(room.id)).map(text)).toEqual(['carol has left'])
  })

  it('new members cannot read history from before they joined', async () => {
    const { clients } = await setup('alice', 'bob', 'dan')
    const { alice, dan } = clients
    const room = await alice.createRoom({ name: 'Group', memberUserIds: ['bob'] })
    await alice.sendText(room.id, 'secret history')
    await alice.addMembers(room.id, ['dan'])
    await alice.sendText(room.id, 'welcome dan')
    const seen = await dan.history(room.id)
    expect(seen.map((m) => m.status)).toEqual(['no-key', 'ok'])
    expect(text(seen[1])).toBe('welcome dan')
  })

  it('rejects tampered ciphertext, AAD fields and forged senders', async () => {
    const { server, clients } = await setup('alice', 'bob', 'mallory')
    const { alice, bob, mallory } = clients
    const room = await alice.createRoom({ name: 'Trio', memberUserIds: ['bob', 'mallory'] })
    await alice.sendText(room.id, 'genuine')
    const original = server.raw.messages[0]

    const flip = (b64: string) => {
      const b = base64ToBytes(b64)
      b[b.length - 1] ^= 1
      return bytesToBase64Url(b)
    }
    const variants: MessageRecord[] = [
      { ...original, ciphertext: flip(original.ciphertext) },
      { ...original, iv: flip(original.iv) },
      { ...original, seq: original.seq + 1 }, // AAD: seq
      { ...original, senderDevice: bob.deviceId, senderUser: 'bob' }, // AAD: sender
      { ...original, signature: flip(original.signature) },
    ]
    for (const v of variants) {
      expect((await bob.decryptRecord(v)).status).toBe('invalid')
    }
    expect((await bob.decryptRecord(original)).status).toBe('ok')

    // Mallory holds the room key but cannot impersonate alice: she cannot sign as alice's device.
    const forged = await mallory.sendText(room.id, 'pay the invoice')
    const row = server.raw.messages.find((m) => m.seq === forged.seq && m.senderDevice === mallory.deviceId)!
    const impersonation = { ...row, senderUser: 'alice', senderDevice: alice.deviceId }
    expect((await bob.decryptRecord(impersonation)).status).toBe('invalid')
  })

  it('room passphrase mode exchanges C.T.L.-compatible sealed packets', async () => {
    const { clients } = await setup('alice', 'bob')
    const { alice, bob } = clients
    const room = await alice.createRoom({ name: 'Approvals', memberUserIds: ['bob'] })
    const hash = await sealRoomPacket('Approve the carousel', 'room-pass-123', { roomName: 'Approvals' })
    expect(hash.startsWith('#ctl=')).toBe(true)
    await alice.sendCtl(room.id, `https://aurelia.example/apps/04-ctl-encrypted-relay/${hash}`, 'Carousel sign-off')
    const [msg] = await bob.history(room.id)
    expect(msg.content?.type).toBe('ctl')
    const payload = await openRoomPacket((msg.content as { hash: string }).hash, 'room-pass-123')
    expect(payload.confidentialNote).toBe('Approve the carousel')
    expect(payload.channel).toBe('Approvals')
    await expect(openRoomPacket((msg.content as { hash: string }).hash, 'wrong-pass')).rejects.toBeInstanceOf(PacketError)
  })

  it('safety numbers are stable, symmetric and change with the key', async () => {
    const a = await generateDeviceIdentity('alice')
    const b = await generateDeviceIdentity('bob')
    const devA = { userId: 'alice', publicKey: a.ecdhPublicJwk, signingKey: a.signPublicJwk }
    const devB = { userId: 'bob', publicKey: b.ecdhPublicJwk, signingKey: b.signPublicJwk }
    const fp1 = await deviceFingerprint(devA)
    expect(fp1).toMatch(/^\d{30}$/)
    expect(await deviceFingerprint({ ...devA })).toBe(fp1)
    const sn = await safetyNumber(devA, devB)
    expect(sn).toMatch(/^(\d{5} ){11}\d{5}$/)
    expect(await safetyNumber(devB, devA)).toBe(sn)
    const c = await generateDeviceIdentity('alice')
    expect(await deviceFingerprint({ ...devA, publicKey: c.ecdhPublicJwk })).not.toBe(fp1)
    expect(await deviceFingerprint({ ...devA, userId: 'mallory' })).not.toBe(fp1)
  })

  it('fingerprint of a fixed key is a known value (regression)', async () => {
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      x: 'f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU',
      y: 'x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0',
    }
    const fp = await deviceFingerprint({ userId: 'alice', publicKey: jwk, signingKey: jwk })
    expect(fp).toBe('182350657462221317783312615351')
  })

  it('room devices view exposes verification state', async () => {
    const { clients } = await setup('alice', 'bob')
    const { alice } = clients
    const room = await alice.createRoom({ name: 'Verify', memberUserIds: ['bob'] })
    let devices = await alice.roomDevices(room.id)
    expect(devices).toHaveLength(2)
    const bobDev = devices.find((d) => d.userId === 'bob')!
    expect(bobDev.verified).toBe(false)
    expect(bobDev.safetyNumber).toBe(
      (await clients.bob.roomDevices(room.id)).find((d) => d.userId === 'alice')!.safetyNumber,
    )
    await alice.setVerified(bobDev, true)
    devices = await alice.roomDevices(room.id)
    expect(devices.find((d) => d.userId === 'bob')!.verified).toBe(true)
  })

  it('a reset device gets access again after the next re-key', async () => {
    const { clients } = await setup('alice', 'bob')
    const { alice, bob } = clients
    const room = await alice.createRoom({ name: 'Reset', memberUserIds: ['bob'] })
    await alice.sendText(room.id, 'old')
    await bob.resetDevice()
    await alice.sendText(room.id, 'new') // alice notices bob's new device and re-keys
    const msgs = await bob.history(room.id)
    expect(msgs.map((m) => m.status)).toEqual(['no-key', 'ok'])
  })
})

describe('device revocation', () => {
  it('a revoked device gets no new room keys', async () => {
    const { server, clients } = await setup('alice', 'bob')
    const { alice, bob } = clients
    // Bob's second device (e.g. a laptop that is later lost).
    const laptop = new ChatClient({ transport: server.transportFor('bob'), keyStore: new MemoryKeyStore(), userId: 'bob' })
    await laptop.init()
    const room = await alice.createRoom({ name: 'Rev', memberUserIds: ['bob'] })
    await alice.sendText(room.id, 'one')
    expect((await laptop.history(room.id)).map(text)).toEqual(['one'])
    await bob.revokeDevice(laptop.deviceId)
    await alice.sendText(room.id, 'two')
    expect((await laptop.history(room.id)).map((m) => m.status)).toEqual(['ok', 'no-key'])
    expect((await bob.history(room.id)).map(text)).toEqual(['one', 'two'])
    await expect(laptop.sendText(room.id, 'from lost laptop')).rejects.toThrow()
    await expect(alice.revokeDevice(bob.deviceId)).rejects.toThrow(/own devices/)
  })
})

describe('signed C.T.L. packets', () => {
  it('verifies the sender device and rejects forgeries', async () => {
    const { clients } = await setup('alice', 'bob', 'mallory', 'outsider')
    const { alice, bob, mallory, outsider } = clients
    await alice.createRoom({ name: 'Approvals', memberUserIds: ['bob', 'mallory'] })

    const signed = await alice.sealSignedCtl({ senderDesk: 'Office of the CEO', subject: 'Approve wire' }, 'room-passphrase-1')
    // Survives the #ctl= round trip.
    const viaLink = ctlHashToPacket(ctlPacketToHash(signed)) as PacketV2
    const ok = await bob.verifyPacket(viaLink)
    expect(ok).toMatchObject({ status: 'valid', userId: 'alice', deviceId: alice.deviceId })

    // Unsigned packet: honestly reported as unsigned.
    const plain = await sealCtlPacket({ senderDesk: 'Office of the CEO' }, 'room-passphrase-1')
    expect((await bob.verifyPacket(plain)).status).toBe('unsigned')

    // Mallory knows the passphrase and re-seals with a forged sender, keeping alice's signature.
    const forged = await sealCtlPacket({ senderDesk: 'Office of the CEO', subject: 'Approve OTHER wire' }, 'room-passphrase-1')
    expect((await bob.verifyPacket({ ...forged, sig: signed.sig })).status).toBe('invalid')

    // Mallory signs with her own device but claims to be alice.
    const malSigned = await mallory.sealSignedCtl({ senderDesk: 'Office of the CEO' }, 'room-passphrase-1')
    expect((await bob.verifyPacket({ ...malSigned, sig: { ...malSigned.sig!, user: 'alice', device: alice.deviceId } })).status).toBe('invalid')
    expect((await bob.verifyPacket({ ...malSigned, sig: { ...malSigned.sig!, user: 'alice' } })).status).toBe('unknown-signer')

    // Changing the authenticated header breaks the signature too.
    expect((await bob.verifyPacket({ ...signed, iterations: signed.iterations + 1 })).status).toBe('invalid')

    // Someone who shares no room with alice cannot look up her key.
    expect((await outsider.verifyPacket(signed)).status).toBe('unknown-signer')
  })
})

describe('IndexedDbKeyStore', () => {
  it('persists a non-extractable identity and monotonic seq', async () => {
    const store = new IndexedDbKeyStore('aurelia-chat-test')
    const id = await generateDeviceIdentity('alice')
    await store.saveIdentity(id)
    const loaded = await new IndexedDbKeyStore('aurelia-chat-test').loadIdentity('alice')
    expect(loaded?.deviceId).toBe(id.deviceId)
    expect(loaded?.ecdhPrivateKey.extractable).toBe(false)
    expect(loaded?.signPrivateKey.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('jwk', loaded!.ecdhPrivateKey)).rejects.toThrow()
    const seqs = await Promise.all([store.nextSeq('alice'), store.nextSeq('alice'), store.nextSeq('alice')])
    expect(seqs.sort()).toEqual([1, 2, 3])
    await store.setVerified('alice', 'dev1', '123')
    expect(await store.loadVerified('alice')).toEqual({ dev1: '123' })
  })

  it('a ChatClient reuses the stored device across sessions', async () => {
    const server = new MemoryChatServer()
    server.registerUser('erin')
    const store = new IndexedDbKeyStore('aurelia-chat-test-2')
    const c1 = new ChatClient({ transport: server.transportFor('erin'), keyStore: store, userId: 'erin' })
    const d1 = await c1.init()
    const c2 = new ChatClient({ transport: server.transportFor('erin'), keyStore: store, userId: 'erin' })
    const d2 = await c2.init()
    expect(d2.deviceId).toBe(d1.deviceId)
    expect(server.raw.devices).toHaveLength(1)
  })
})
