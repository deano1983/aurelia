// Byte/encoding helpers shared by the packet format and encrypted chat.
// Everything here is pure and works in browsers, Capacitor webviews and Node 20+.

const ENCODER = new TextEncoder()
const DECODER = new TextDecoder('utf-8', { fatal: true })

export function utf8Encode(text: string): Uint8Array {
  return ENCODER.encode(text)
}

/** Decodes UTF-8, throwing on invalid byte sequences instead of inserting U+FFFD. */
export function utf8Decode(bytes: Uint8Array | ArrayBuffer): string {
  return DECODER.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
}

/** Cryptographically secure random bytes (WebCrypto). Never Math.random. */
export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 1 || length > 65536) {
    throw new RangeError('randomBytes: length must be an integer in 1..65536')
  }
  return crypto.getRandomValues(new Uint8Array(length))
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.byteLength
  }
  return out
}

/** Big-endian unsigned 32-bit integer. */
export function u32(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new RangeError('u32 out of range')
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, n, false)
  return out
}

/** Constant-time comparison for equal-length byte arrays. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  let diff = 0
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// ---------------------------------------------------------------------------
// Base64 / base64url. Chunked so large inputs never blow the call stack
// (the old `String.fromCharCode(...bytes)` pattern did for ~100 KB+ inputs).
// ---------------------------------------------------------------------------

function bytesToBinary(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
  }
  return binary
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes))
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/
const B64URL_RE = /^[A-Za-z0-9_-]*$/

/**
 * Strict decoder that accepts standard base64 (with or without padding) or
 * base64url. Throws `TypeError` on any other character or impossible length.
 */
export function base64ToBytes(input: string): Uint8Array {
  if (typeof input !== 'string') throw new TypeError('base64: expected string')
  let s = input.trim()
  if (B64URL_RE.test(s)) {
    s = s.replace(/-/g, '+').replace(/_/g, '/')
  } else if (!B64_RE.test(s)) {
    throw new TypeError('base64: invalid characters')
  }
  s = s.replace(/=+$/, '')
  if (s.length % 4 === 1) throw new TypeError('base64: invalid length')
  s += '='.repeat((4 - (s.length % 4)) % 4)
  const binary = atob(s)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export const base64UrlToBytes = base64ToBytes

export function utf8ToBase64Url(text: string): string {
  return bytesToBase64Url(utf8Encode(text))
}

export function base64UrlToUtf8(b64: string): string {
  return utf8Decode(base64ToBytes(b64))
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Ensures a plain ArrayBuffer-backed view (WebCrypto typings dislike SharedArrayBuffer). */
export function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return (bytes.buffer instanceof ArrayBuffer ? bytes : new Uint8Array(bytes)) as Uint8Array<ArrayBuffer>
}
