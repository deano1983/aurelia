// Thin adapter over the shared implementation in @aurelia/core/crypto.
// New pointers are sealed in the v2 packet format with context "vault"
// (600k PBKDF2 rounds, authenticated header); legacy "1.0" pointers already
// stored in IndexedDB or carried in #vault= links keep decrypting.
import { hashToPacket, openJson, packetToHash, parsePacket, sealJson } from '@aurelia/core/crypto'
import type { CloudPointer, DecryptedPointer, EncryptedPointer } from './types'

const CONTEXT = 'vault'

export async function encryptPointer(pointer: CloudPointer, passphrase: string): Promise<EncryptedPointer> {
  return sealJson({ ...pointer, timestamp: new Date().toISOString() }, passphrase, { context: CONTEXT })
}

export async function decryptPointer(packet: EncryptedPointer, passphrase: string): Promise<DecryptedPointer | null> {
  try {
    return await openJson<DecryptedPointer>(packet, passphrase, { context: CONTEXT })
  } catch {
    return null
  }
}

export function pointerToUrlHash(packet: EncryptedPointer): string {
  // parsePacket validates the stored object before it is encoded into a link.
  return packetToHash(parsePacket(packet), CONTEXT)
}

export function urlHashToPointer(hash: string): EncryptedPointer | null {
  return hashToPacket(hash, CONTEXT)
}
