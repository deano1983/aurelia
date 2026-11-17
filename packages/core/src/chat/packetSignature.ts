// Sender signatures for passphrase packets (#ctl=). A passphrase only proves
// that the sender knew the passphrase; anyone in the room could have written
// "From: Office of the CEO". A signed packet carries an ECDSA P-256 signature
// by the sender's registered chat device. The device's public key is bound to
// the sender's auth.uid() server-side (chat_devices RLS: users manage only
// their own devices, keys are immutable), so a valid signature means the
// packet came from that Aurelia account.

import { base64ToBytes, bytesToBase64Url, toBufferSource } from '../crypto/encoding'
import { packetSigningBytes, parsePacket, type PacketV2, type SealedPacket } from '../crypto/packet'
import { importEcdsaPublic, type DeviceIdentity } from './identity'
import type { DeviceRecord } from './types'

export async function signPacket(packet: PacketV2, identity: DeviceIdentity, context = 'ctl'): Promise<PacketV2> {
  const signer = { user: identity.userId, device: identity.deviceId }
  const unsigned: PacketV2 = { ...packet }
  delete unsigned.sig
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identity.signPrivateKey,
    toBufferSource(packetSigningBytes(unsigned, signer, context)),
  )
  return { ...unsigned, sig: { ...signer, value: bytesToBase64Url(new Uint8Array(sig)) } }
}

export type PacketSignatureCheck =
  | { status: 'unsigned' }
  /** Signed, but the signing device is not visible to this user (no shared room) or not registered. */
  | { status: 'unknown-signer'; userId: string; deviceId: string }
  | { status: 'valid'; userId: string; deviceId: string; device: DeviceRecord }
  | { status: 'invalid' }

/**
 * Verifies a packet's sender signature. `lookup` must return the device as
 * published by the server (e.g. ChatClient's directory), never a key taken
 * from the packet itself.
 */
export async function verifyPacketSignature(
  packet: SealedPacket,
  lookup: (userId: string, deviceId: string) => Promise<DeviceRecord | null>,
  context = 'ctl',
): Promise<PacketSignatureCheck> {
  let p: SealedPacket
  try {
    p = parsePacket(packet)
  } catch {
    return { status: 'invalid' }
  }
  if (p.version !== '2' || !p.sig) return { status: 'unsigned' }
  const { user, device, value } = p.sig
  let record: DeviceRecord | null = null
  try {
    record = await lookup(user, device)
  } catch {
    record = null
  }
  if (!record || record.userId !== user || record.deviceId !== device) {
    return { status: 'unknown-signer', userId: user, deviceId: device }
  }
  try {
    const key = await importEcdsaPublic(record.signingKey)
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      toBufferSource(base64ToBytes(value)),
      toBufferSource(packetSigningBytes(p, { user, device }, context)),
    )
    return ok ? { status: 'valid', userId: user, deviceId: device, device: record } : { status: 'invalid' }
  } catch {
    return { status: 'invalid' }
  }
}
