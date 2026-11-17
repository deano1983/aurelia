import { describe, expect, it } from 'vitest'
import { deriveRoomKey, newRoomSalt, saltFromBase64, saltToBase64, ROOM_SALT_BYTES } from './roomKey'
import { readSupabaseConfig } from './config'

async function encrypt(key: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return { iv, ct }
}

async function decrypt(key: CryptoKey, box: { iv: Uint8Array; ct: ArrayBuffer }) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(box.iv) }, key, box.ct)
  return new TextDecoder().decode(pt)
}

describe('room key derivation', () => {
  it('is deterministic for the same passphrase and salt', async () => {
    const salt = newRoomSalt()
    const a = await deriveRoomKey('correct horse battery', salt)
    const b = await deriveRoomKey('correct horse battery', saltFromBase64(saltToBase64(salt)))
    const box = await encrypt(a, 'board minutes')
    expect(await decrypt(b, box)).toBe('board minutes')
  })

  it('produces an AES-GCM 256 key that cannot be exported', async () => {
    const key = await deriveRoomKey('correct horse battery', newRoomSalt())
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
    expect(key.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow()
  })

  it('fails to decrypt with the wrong passphrase', async () => {
    const salt = newRoomSalt()
    const right = await deriveRoomKey('correct horse battery', salt)
    const wrong = await deriveRoomKey('correct horse battery!', salt)
    const box = await encrypt(right, 'secret value')
    await expect(decrypt(wrong, box)).rejects.toThrow()
  })

  it('fails to decrypt with the same passphrase but another user salt', async () => {
    const a = await deriveRoomKey('correct horse battery', newRoomSalt())
    const b = await deriveRoomKey('correct horse battery', newRoomSalt())
    await expect(decrypt(b, await encrypt(a, 'x'))).rejects.toThrow()
  })

  it('rejects an empty passphrase or a short salt', async () => {
    await expect(deriveRoomKey('', newRoomSalt())).rejects.toThrow()
    await expect(deriveRoomKey('long enough', new Uint8Array(ROOM_SALT_BYTES - 1))).rejects.toThrow()
  })
})

describe('readSupabaseConfig', () => {
  it('returns null when either value is missing or blank', () => {
    expect(readSupabaseConfig(undefined)).toBeNull()
    expect(readSupabaseConfig({})).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: '  ' })).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
  })

  it('returns the config when both are set', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({
      url: 'https://x.supabase.co',
      anonKey: 'k',
    })
  })
})
