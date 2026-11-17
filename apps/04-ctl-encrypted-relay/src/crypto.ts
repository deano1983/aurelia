import type { EncryptedPacket, DecryptedPacket, PacketFields } from './types'

const ENCODER = new TextEncoder()
const DECODER = new TextDecoder()
const PBKDF2_ROUNDS = 120_000
const KEY_ALG = 'PBKDF2'
const WRAP_ALG = 'AES-GCM'

// ---------------------------------------------------------------------------
// Key derivation: PBKDF2-SHA256 -> 256-bit AES key
// ---------------------------------------------------------------------------
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(passphrase),
    KEY_ALG,
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: KEY_ALG,
      salt,
      iterations: PBKDF2_ROUNDS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: WRAP_ALG, length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ---------------------------------------------------------------------------
// Encrypt: AES-256-GCM with random IV + salt
// ---------------------------------------------------------------------------
export async function encryptPacket(
  fields: PacketFields,
  passphrase: string
): Promise<EncryptedPacket> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const key = await deriveKey(passphrase, salt)
  const plaintext = ENCODER.encode(JSON.stringify({ ...fields, timestamp: new Date().toISOString() }))

  const ciphertext = await crypto.subtle.encrypt(
    { name: WRAP_ALG, iv },
    key,
    plaintext
  )

  return {
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    version: '1.0',
  }
}

// ---------------------------------------------------------------------------
// Decrypt: reverse of encrypt
// ---------------------------------------------------------------------------
export async function decryptPacket(
  packet: EncryptedPacket,
  passphrase: string
): Promise<DecryptedPacket | null> {
  try {
    const salt = Uint8Array.from(atob(packet.salt), (c) => c.charCodeAt(0))
    const iv = Uint8Array.from(atob(packet.iv), (c) => c.charCodeAt(0))
    const ciphertext = Uint8Array.from(atob(packet.ciphertext), (c) => c.charCodeAt(0))

    const key = await deriveKey(passphrase, salt)

    const plaintext = await crypto.subtle.decrypt(
      { name: WRAP_ALG, iv },
      key,
      ciphertext
    )

    const parsed = JSON.parse(DECODER.decode(plaintext)) as DecryptedPacket
    return parsed
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// URL helpers: #ctl=<base64url packet>
// ---------------------------------------------------------------------------
export function packetToUrlHash(packet: EncryptedPacket): string {
  const json = JSON.stringify(packet)
  const base64 = btoa(json)
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `#ctl=${base64url}`
}

export function urlHashToPacket(hash: string): EncryptedPacket | null {
  try {
    const match = hash.match(/#ctl=([^&]*)/)
    if (!match) return null
    const base64url = match[1]
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json) as EncryptedPacket
  } catch {
    return null
  }
}