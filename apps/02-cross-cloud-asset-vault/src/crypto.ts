import type { CloudPointer, DecryptedPointer, EncryptedPointer } from './types'

const ENCODER = new TextEncoder()
const DECODER = new TextDecoder()
const PBKDF2_ROUNDS = 120_000
const KEY_ALG = 'PBKDF2'
const WRAP_ALG = 'AES-GCM'
const VERSION = '1.0'

// Mirrors the Web Crypto pattern used by 04-ctl-encrypted-relay so that
// pointers sealed here can be opened by the CTL Relay (and vice versa)
// with the same passphrase: PBKDF2-SHA256 -> AES-256-GCM.
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(passphrase),
    KEY_ALG,
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: KEY_ALG, salt, iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
    keyMaterial,
    { name: WRAP_ALG, length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptPointer(
  pointer: CloudPointer,
  passphrase: string
): Promise<EncryptedPointer> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const plaintext = ENCODER.encode(JSON.stringify({ ...pointer, timestamp: new Date().toISOString() }))
  const ciphertext = await crypto.subtle.encrypt({ name: WRAP_ALG, iv }, key, plaintext)
  return {
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    version: VERSION,
  }
}

export async function decryptPointer(
  packet: EncryptedPointer,
  passphrase: string
): Promise<DecryptedPointer | null> {
  try {
    const salt = Uint8Array.from(atob(packet.salt), (c) => c.charCodeAt(0))
    const iv = Uint8Array.from(atob(packet.iv), (c) => c.charCodeAt(0))
    const ciphertext = Uint8Array.from(atob(packet.ciphertext), (c) => c.charCodeAt(0))
    const key = await deriveKey(passphrase, salt)
    const plaintext = await crypto.subtle.decrypt({ name: WRAP_ALG, iv }, key, ciphertext)
    return JSON.parse(DECODER.decode(plaintext)) as DecryptedPointer
  } catch {
    return null
  }
}

export function pointerToUrlHash(packet: EncryptedPointer): string {
  const base64 = btoa(JSON.stringify(packet))
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `#vault=${base64url}`
}

export function urlHashToPointer(hash: string): EncryptedPointer | null {
  try {
    const match = hash.match(/#vault=([^&]*)/)
    if (!match) return null
    let base64 = match[1].replace(/-/g, '+').replace(/_/g, '/')
    base64 += '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(base64)) as EncryptedPointer
  } catch {
    return null
  }
}
