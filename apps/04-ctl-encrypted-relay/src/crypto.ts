// Thin adapter over the shared implementation in @aurelia/core/crypto.
// New packets are sealed in the v2 format (600k PBKDF2 rounds, authenticated
// header); legacy v1 "1.0" #ctl= links keep decrypting.
import {
  ctlHashToPacket,
  ctlPacketToHash,
  openCtlPacket,
  sealCtlPacket,
} from '@aurelia/core/crypto'
import type { EncryptedPacket, DecryptedPacket, PacketFields } from './types'

export async function encryptPacket(fields: PacketFields, passphrase: string): Promise<EncryptedPacket> {
  // sealCtlPacket seals only the relay fields: fields.passphrase never enters the ciphertext.
  return sealCtlPacket(fields, passphrase)
}

export async function decryptPacket(packet: EncryptedPacket, passphrase: string): Promise<DecryptedPacket | null> {
  try {
    return await openCtlPacket(packet, passphrase)
  } catch {
    return null
  }
}

export function packetToUrlHash(packet: EncryptedPacket): string {
  return ctlPacketToHash(packet)
}

export function urlHashToPacket(hash: string): EncryptedPacket | null {
  return ctlHashToPacket(hash)
}
