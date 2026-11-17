// Room key derivation: PBKDF2-SHA256 (120,000 rounds) -> AES-GCM 256.
// The salt is per user, random, and stored in the profile (not secret).
// The derived key is non-extractable and lives in memory only; the passphrase
// is never stored anywhere.

export const ROOM_KEY_ITERATIONS = 120_000
export const ROOM_SALT_BYTES = 16
export const MIN_PASSPHRASE_LENGTH = 8

export async function deriveRoomKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new Error('A passphrase is required to unlock the room.')
  }
  if (!(salt instanceof Uint8Array) || salt.byteLength < ROOM_SALT_BYTES) {
    throw new Error(`Room salt must be at least ${ROOM_SALT_BYTES} bytes.`)
  }
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations: ROOM_KEY_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function newRoomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(ROOM_SALT_BYTES))
}

export function saltToBase64(salt: Uint8Array): string {
  let s = ''
  for (const b of salt) s += String.fromCharCode(b)
  return btoa(s)
}

export function saltFromBase64(value: string): Uint8Array {
  const raw = atob(value.trim())
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
