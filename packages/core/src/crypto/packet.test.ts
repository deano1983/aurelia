import { describe, expect, it } from 'vitest'
import {
  base64ToBytes,
  bytesToBase64,
  bytesToBase64Url,
  ctlHashToPacket,
  ctlPacketToHash,
  hashToPacket,
  openBytes,
  openCtlPacket,
  openJson,
  PacketError,
  packetToHash,
  parsePacket,
  sealBytes,
  sealCtlPacket,
  sealJson,
  utf8Encode,
  type PacketV2,
} from './index'

// Produced by the ORIGINAL apps/04-ctl-encrypted-relay/src/crypto.ts
// (encryptPacket + packetToUrlHash, commit 124d7ee) before it was replaced.
// Old links must keep decrypting forever.
const LEGACY_HASH =
  '#ctl=eyJpdiI6Im93cUhZRnNJOHo5WGZHZGUiLCJzYWx0Ijoic1ZXM0pycEJDeU9lSVFacEppeFM0UT09IiwiY2lwaGVydGV4dCI6IlcvOHZyTmpEbUpBbFEzSEtDSEFiUmlRV201Y2M0M3liMnVYeHE5eHgzWkhKN0pqb1E4cGZQdnlXV0RtYzhqaGZjWjNyWEZoN3VWdk5TdUo2WTkyUW9SOWhoNkZ3V0hHbGVsSG9lN0RmTkxqQmNGeFBoRXhIcWZsbldOWGh5R2VKSWpWTzQ1a2JUcUFvdHFmTkFjeXZwL3FTQlR0RHZ4SXNoazROeDA3bGZ3QmVTYmplY3ZpUSs1MXc3RGlUTmc3UkM1RWNrejZjTEZrNzFSSE1TTHRRd1dTS0pFSjRxc3RDOHFDUW9kMGQ4WDlXaXdLVVpqSFVUeWI5ZE5QU21JOWxBTDFmY1pLR01sdkwvdjVGaW5mVU1xY28xOWRmTHVodG4zNFVyRGtkS0F1WkI5SWRUYzR6UW44Ujd3cW1IUTd1NDAxakhCa2ZGMXQ0S2h1eGcwN1g4cGwwN0VBcHI1akdMc0hRQ1pqWDlENHRvWEZDYUFoa1kyMytFdVQyNXRHYmF5bXhEbStnaTBhaFJldUxiSTZzWXk3L3NhOGdQc0NKekJWVVdJT0QvR09RQTBTNXJjL3lmQjNjYUMvVFJEeUFrNDM2RnZDM0crbUlKaXphenNaN0w0U2lIYi93RXNRK2RMYz0iLCJ2ZXJzaW9uIjoiMS4wIn0'
const LEGACY_PASSPHRASE = 'correct horse battery'

// Low iteration count keeps tests fast; production default is 600k.
const FAST = { iterations: 100_000 }

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(PacketError)
  await expect(p).rejects.toMatchObject({ code })
}

describe('legacy v1 packets (04 C.T.L. Relay before consolidation)', () => {
  it('decrypts a #ctl= link produced by the original 04 code', async () => {
    const packet = ctlHashToPacket(LEGACY_HASH)
    expect(packet?.version).toBe('1.0')
    const payload = await openCtlPacket(packet, LEGACY_PASSPHRASE)
    expect(payload).toMatchObject({
      senderDesk: 'Executive Office',
      senderRole: 'Chief of Staff',
      recipientRole: 'Board Chair',
      channel: 'Secure Room — Q3',
      subject: 'Approved Q3 EBITDA slide',
      cloudProofPointer: '#vault=abc123',
      confidentialNote: 'Hold release until 09:30 AEST — ✓ approved 🔒',
      timestamp: '2026-11-17T20:27:11.849Z',
    })
    // The legacy plaintext carried the passphrase; the sanitised payload drops it.
    expect(payload).not.toHaveProperty('passphrase')
  })

  it('also parses a full URL carrying the legacy fragment', () => {
    expect(hashToPacket(`https://example.test/apps/04-ctl-encrypted-relay/${LEGACY_HASH}`)).not.toBeNull()
  })

  it('rejects the legacy packet with a wrong passphrase', async () => {
    await expectCode(openCtlPacket(ctlHashToPacket(LEGACY_HASH), 'correct horse batterY'), 'decrypt-failed')
  })

  it('rejects a tampered legacy ciphertext', async () => {
    const packet = ctlHashToPacket(LEGACY_HASH)!
    const ct = base64ToBytes(packet.ciphertext)
    ct[5] ^= 0x01
    await expectCode(openBytes({ ...packet, ciphertext: bytesToBase64(ct) }, LEGACY_PASSPHRASE), 'decrypt-failed')
  })
})

describe('v2 packets', () => {
  it('round-trips JSON and records the header', async () => {
    const packet = await sealJson({ hello: 'wörld' }, 'hunter22', FAST)
    expect(packet).toMatchObject({ version: '2', kdf: 'PBKDF2-SHA256', iterations: 100_000 })
    expect(packet.salt).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await openJson(packet, 'hunter22')).toEqual({ hello: 'wörld' })
  })

  it('uses 600k iterations by default', async () => {
    const packet = await sealBytes(utf8Encode('x'), 'hunter22')
    expect(packet.iterations).toBe(600_000)
  })

  it('round-trips through the URL fragment', async () => {
    const packet = await sealCtlPacket({ subject: 'Board pack', confidentialNote: 'Sign at 9' }, 'hunter22', FAST)
    const hash = ctlPacketToHash(packet)
    expect(hash.startsWith('#ctl=')).toBe(true)
    const payload = await openCtlPacket(ctlHashToPacket(hash), 'hunter22')
    expect(payload.subject).toBe('Board pack')
    expect(payload.confidentialNote).toBe('Sign at 9')
    expect(payload.timestamp).toMatch(/^\d{4}-/)
  })

  it('never seals the passphrase into the ciphertext', async () => {
    const fields = { subject: 's', passphrase: 'hunter22' } as unknown as Record<string, string>
    const packet = await sealCtlPacket(fields, 'hunter22', FAST)
    const raw = await openJson<Record<string, unknown>>(packet, 'hunter22')
    expect(raw).not.toHaveProperty('passphrase')
  })

  it('fails with a wrong passphrase', async () => {
    const packet = await sealJson({ a: 1 }, 'hunter22', FAST)
    await expectCode(openJson(packet, 'hunter23'), 'decrypt-failed')
  })

  it('normalises the passphrase (NFC) so composed/decomposed input both work', async () => {
    const packet = await sealJson({ a: 1 }, 'café-secret', FAST)
    expect(await openJson(packet, 'café-secret')).toEqual({ a: 1 })
  })

  it('fails when the ciphertext is tampered', async () => {
    const packet = await sealJson({ a: 1 }, 'hunter22', FAST)
    const ct = base64ToBytes(packet.ciphertext)
    ct[0] ^= 0x80
    await expectCode(openJson({ ...packet, ciphertext: bytesToBase64Url(ct) }, 'hunter22'), 'decrypt-failed')
  })

  it('fails when the authenticated header (iterations) is changed', async () => {
    const packet = await sealJson({ a: 1 }, 'hunter22', FAST)
    await expectCode(openJson({ ...packet, iterations: 100_001 }, 'hunter22'), 'decrypt-failed')
  })

  it('fails when the context (AAD) differs', async () => {
    const packet = await sealJson({ a: 1 }, 'hunter22', { ...FAST, context: 'vault' })
    await expectCode(openJson(packet, 'hunter22', { context: 'ctl' }), 'decrypt-failed')
    expect(await openJson(packet, 'hunter22', { context: 'vault' })).toEqual({ a: 1 })
  })

  it('cannot be downgraded to the legacy format', async () => {
    const packet: PacketV2 = await sealJson({ a: 1 }, 'hunter22', { iterations: 120_000 })
    const downgraded = { version: '1.0', salt: packet.salt, iv: packet.iv, ciphertext: packet.ciphertext }
    await expectCode(openJson(downgraded, 'hunter22'), 'decrypt-failed')
  })

  it('refuses weak passphrases when sealing', async () => {
    await expectCode(sealJson({}, 'short'), 'weak-passphrase')
  })

  it('bounds the iteration count read from untrusted packets', async () => {
    const packet = await sealJson({ a: 1 }, 'hunter22', FAST)
    await expectCode(openJson({ ...packet, iterations: 1_000_000_000 }, 'hunter22'), 'unsupported-version')
    await expectCode(openJson({ ...packet, iterations: 1 }, 'hunter22'), 'unsupported-version')
  })

  it('validates structure, lengths and versions', async () => {
    const packet = await sealJson({ a: 1 }, 'hunter22', FAST)
    expect(() => parsePacket(null)).toThrow(PacketError)
    expect(() => parsePacket({ ...packet, version: '3' })).toThrow(/unsupported/)
    expect(() => parsePacket({ ...packet, kdf: 'MD5' })).toThrow(/KDF/)
    await expectCode(openJson({ ...packet, iv: bytesToBase64Url(new Uint8Array(8)) }, 'hunter22'), 'malformed')
    await expectCode(openJson({ ...packet, salt: 'not base64!' }, 'hunter22'), 'malformed')
  })

  it('hashToPacket never throws on junk', () => {
    expect(hashToPacket('')).toBeNull()
    expect(hashToPacket('#ctl=')).toBeNull()
    expect(hashToPacket('#ctl=%%%')).toBeNull()
    expect(hashToPacket('#ctl=bm90IGpzb24')).toBeNull()
    expect(hashToPacket('#vault=abc', 'ctl')).toBeNull()
  })

  it('uses distinct hash prefixes', async () => {
    const packet = await sealJson({ a: 1 }, 'hunter22', { ...FAST, context: 'vault' })
    const hash = packetToHash(packet, 'vault')
    expect(hash.startsWith('#vault=')).toBe(true)
    expect(hashToPacket(hash, 'vault')).toEqual(packet)
  })
})

describe('encoding', () => {
  it('base64 handles large inputs and both alphabets', () => {
    const large = new Uint8Array(300_000)
    for (let i = 0; i < large.length; i += 65536) crypto.getRandomValues(large.subarray(i, i + 65536))
    expect(base64ToBytes(bytesToBase64(large))).toEqual(large)
    expect(base64ToBytes(bytesToBase64Url(large))).toEqual(large)
    expect(() => base64ToBytes('a')).toThrow()
    expect(() => base64ToBytes('ab$c')).toThrow()
  })
})
