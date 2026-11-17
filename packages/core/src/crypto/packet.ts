// Passphrase-sealed packets: the one implementation behind 04 C.T.L. Relay
// (#ctl=), 03 Voice Authority Studio (#ctl= links) and 02 Asset Vault (#vault=).
//
// Two on-the-wire versions are understood. Both are a JSON object that is
// carried in a URL fragment as base64url(JSON):
//
//   v1 "1.0" (legacy, decrypt-only)
//     { iv, salt, ciphertext, version: "1.0" }   fields in standard base64
//     PBKDF2-SHA256, 120 000 iterations -> AES-256-GCM, 16-byte salt, 12-byte IV,
//     no additional authenticated data. Byte-compatible with every #ctl= and
//     #vault= link produced before the consolidation.
//
//   v2 "2" (written by default)
//     { version: "2", kdf: "PBKDF2-SHA256", iterations, salt, iv, ciphertext }
//     fields in base64url. Iterations are explicit (default 600 000, bounded on
//     decrypt so a hostile link cannot pin the CPU), the passphrase is NFC
//     normalised, and the header (version, kdf, iterations, context) is bound
//     into AES-GCM as AAD: changing any header field, or relabelling a v2
//     packet as v1, makes decryption fail. `context` separates purposes
//     ("ctl" vs "vault") so a packet sealed for one cannot be replayed as the other.

import {
  base64ToBytes,
  bytesToBase64Url,
  randomBytes,
  toBufferSource,
  utf8Decode,
  utf8Encode,
} from './encoding'

export const LEGACY_PACKET_VERSION = '1.0' as const
export const PACKET_VERSION = '2' as const
export const PACKET_KDF = 'PBKDF2-SHA256' as const
export const LEGACY_PBKDF2_ITERATIONS = 120_000
/** OWASP 2023 recommendation for PBKDF2-HMAC-SHA256. */
export const DEFAULT_PBKDF2_ITERATIONS = 600_000
export const MIN_PBKDF2_ITERATIONS = 100_000
export const MAX_PBKDF2_ITERATIONS = 5_000_000
/** Minimum for NEW packets (legacy links sealed with shorter passphrases still open). */
export const MIN_PASSPHRASE_LENGTH = 12
export const SALT_BYTES = 16
export const IV_BYTES = 12
const GCM_TAG_BYTES = 16
/** Upper bound on a packet's ciphertext; fragments beyond this are not plausible links. */
export const MAX_CIPHERTEXT_BYTES = 40 * 1024
/** Size cap applied to a fragment/link before any base64 or JSON decoding. */
export const MAX_HASH_CHARS = 64 * 1024

export type LegacyPacket = {
  version: typeof LEGACY_PACKET_VERSION
  iv: string
  salt: string
  ciphertext: string
}

/**
 * Optional sender signature (see chat/packetSignature.ts): an ECDSA P-256
 * signature by a registered Aurelia device over the header, salt, IV and
 * ciphertext. Without it a packet proves only knowledge of the passphrase.
 */
export type PacketSignature = {
  /** Signer's user id (server-bound owner of the device). */
  user: string
  /** Signer's device id in chat_devices. */
  device: string
  /** base64url IEEE-P1363 ECDSA P-256/SHA-256 signature. */
  value: string
}

export type PacketV2 = {
  version: typeof PACKET_VERSION
  kdf: typeof PACKET_KDF
  iterations: number
  salt: string
  iv: string
  ciphertext: string
  sig?: PacketSignature
}

export type SealedPacket = LegacyPacket | PacketV2

export type PacketErrorCode =
  | 'malformed'
  | 'unsupported-version'
  | 'weak-passphrase'
  | 'too-large'
  | 'decrypt-failed'

export class PacketError extends Error {
  readonly code: PacketErrorCode
  constructor(code: PacketErrorCode, message: string) {
    super(message)
    this.name = 'PacketError'
    this.code = code
  }
}

export type SealOptions = {
  /** Purpose label bound into the AAD, e.g. "ctl" or "vault". Default "ctl". */
  context?: string
  iterations?: number
}

export type OpenOptions = {
  /** Must match the context used to seal (v2 only). Default "ctl". */
  context?: string
}

const CONTEXT_RE = /^[a-z0-9-]{1,32}$/

function checkContext(context: string): string {
  if (!CONTEXT_RE.test(context)) throw new PacketError('malformed', 'invalid packet context')
  return context
}

function checkIterations(iterations: number): number {
  if (
    !Number.isSafeInteger(iterations) ||
    iterations < MIN_PBKDF2_ITERATIONS ||
    iterations > MAX_PBKDF2_ITERATIONS
  ) {
    throw new PacketError('unsupported-version', 'PBKDF2 iteration count out of accepted range')
  }
  return iterations
}

async function derivePacketKey(
  passphraseBytes: Uint8Array,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    toBufferSource(passphraseBytes),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toBufferSource(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function v2Aad(context: string, iterations: number): Uint8Array {
  return utf8Encode(`aurelia/packet|v${PACKET_VERSION}|${context}|${PACKET_KDF}|${iterations}`)
}

function decodeField(value: unknown, name: string, expectedLength?: number): Uint8Array {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PacketError('malformed', `packet field "${name}" missing`)
  }
  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(value)
  } catch {
    throw new PacketError('malformed', `packet field "${name}" is not base64`)
  }
  if (expectedLength !== undefined && bytes.byteLength !== expectedLength) {
    throw new PacketError('malformed', `packet field "${name}" has wrong length`)
  }
  return bytes
}

const SIG_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

function parseSignature(value: unknown): PacketSignature {
  const s = value as Record<string, unknown> | null
  if (
    !s ||
    typeof s !== 'object' ||
    typeof s.user !== 'string' ||
    typeof s.device !== 'string' ||
    typeof s.value !== 'string' ||
    !SIG_ID_RE.test(s.user) ||
    !SIG_ID_RE.test(s.device) ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(s.value)
  ) {
    throw new PacketError('malformed', 'packet signature malformed')
  }
  return { user: s.user, device: s.device, value: s.value }
}

/**
 * The bytes a sender signature covers: the authenticated header (including
 * the context and signer identity), salt, IV and ciphertext, length-prefixed.
 */
export function packetSigningBytes(packet: PacketV2, signer: { user: string; device: string }, context = 'ctl'): Uint8Array {
  const parts = [
    utf8Encode(`aurelia/packet-sig|v${PACKET_VERSION}|${checkContext(context)}|${PACKET_KDF}|${packet.iterations}|${signer.user}|${signer.device}`),
    base64ToBytes(packet.salt),
    base64ToBytes(packet.iv),
    base64ToBytes(packet.ciphertext),
  ]
  const total = parts.reduce((n, p) => n + 4 + p.byteLength, 0)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  let o = 0
  for (const p of parts) {
    view.setUint32(o, p.byteLength)
    out.set(p, o + 4)
    o += 4 + p.byteLength
  }
  return out
}

/** Validates an untrusted value (e.g. parsed from a URL) as a packet. Throws PacketError. */
export function parsePacket(value: unknown): SealedPacket {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PacketError('malformed', 'packet must be an object')
  }
  const v = value as Record<string, unknown>
  const common = {
    salt: v.salt,
    iv: v.iv,
    ciphertext: v.ciphertext,
  }
  for (const [k, field] of Object.entries(common)) {
    if (typeof field !== 'string') throw new PacketError('malformed', `packet field "${k}" missing`)
  }
  if ((common.ciphertext as string).length > Math.ceil((MAX_CIPHERTEXT_BYTES * 4) / 3) + 4) {
    throw new PacketError('too-large', 'packet ciphertext too large')
  }
  if (v.version === LEGACY_PACKET_VERSION) {
    return { version: LEGACY_PACKET_VERSION, ...(common as { salt: string; iv: string; ciphertext: string }) }
  }
  if (v.version === PACKET_VERSION) {
    if (v.kdf !== PACKET_KDF) throw new PacketError('unsupported-version', 'unsupported packet KDF')
    if (typeof v.iterations !== 'number') throw new PacketError('malformed', 'packet iterations missing')
    const out: PacketV2 = {
      version: PACKET_VERSION,
      kdf: PACKET_KDF,
      iterations: checkIterations(v.iterations),
      ...(common as { salt: string; iv: string; ciphertext: string }),
    }
    if (v.sig !== undefined) out.sig = parseSignature(v.sig)
    return out
  }
  throw new PacketError('unsupported-version', `unsupported packet version ${String(v.version)}`)
}

/** Seals bytes under a passphrase. Always writes the current (v2) format. */
export async function sealBytes(
  plaintext: Uint8Array,
  passphrase: string,
  options: SealOptions = {},
): Promise<PacketV2> {
  if (typeof passphrase !== 'string' || passphrase.normalize('NFC').length < MIN_PASSPHRASE_LENGTH) {
    throw new PacketError('weak-passphrase', `passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`)
  }
  if (!(plaintext instanceof Uint8Array)) throw new PacketError('malformed', 'plaintext must be bytes')
  if (plaintext.byteLength + GCM_TAG_BYTES > MAX_CIPHERTEXT_BYTES) {
    throw new PacketError('too-large', 'plaintext too large for a packet')
  }
  const context = checkContext(options.context ?? 'ctl')
  const iterations = checkIterations(options.iterations ?? DEFAULT_PBKDF2_ITERATIONS)
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await derivePacketKey(utf8Encode(passphrase.normalize('NFC')), salt, iterations)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toBufferSource(iv), additionalData: toBufferSource(v2Aad(context, iterations)) },
      key,
      toBufferSource(plaintext),
    ),
  )
  return {
    version: PACKET_VERSION,
    kdf: PACKET_KDF,
    iterations,
    salt: bytesToBase64Url(salt),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(ciphertext),
  }
}

/**
 * Opens a v1 or v2 packet. Throws PacketError('decrypt-failed') for a wrong
 * passphrase or any tampering, and other codes for malformed input.
 */
export async function openBytes(
  packet: unknown,
  passphrase: string,
  options: OpenOptions = {},
): Promise<Uint8Array> {
  const p = parsePacket(packet)
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new PacketError('decrypt-failed', 'passphrase required')
  }
  const salt = decodeField(p.salt, 'salt', SALT_BYTES)
  const iv = decodeField(p.iv, 'iv', IV_BYTES)
  const ciphertext = decodeField(p.ciphertext, 'ciphertext')
  if (ciphertext.byteLength < GCM_TAG_BYTES) throw new PacketError('malformed', 'ciphertext too short')
  if (ciphertext.byteLength > MAX_CIPHERTEXT_BYTES) throw new PacketError('too-large', 'ciphertext too large')

  let key: CryptoKey
  let params: AesGcmParams
  if (p.version === LEGACY_PACKET_VERSION) {
    // Legacy: raw (un-normalised) passphrase, fixed rounds, no AAD.
    key = await derivePacketKey(utf8Encode(passphrase), salt, LEGACY_PBKDF2_ITERATIONS)
    params = { name: 'AES-GCM', iv: toBufferSource(iv) }
  } else {
    const context = checkContext(options.context ?? 'ctl')
    key = await derivePacketKey(utf8Encode(passphrase.normalize('NFC')), salt, p.iterations)
    params = { name: 'AES-GCM', iv: toBufferSource(iv), additionalData: toBufferSource(v2Aad(context, p.iterations)) }
  }
  try {
    return new Uint8Array(await crypto.subtle.decrypt(params, key, toBufferSource(ciphertext)))
  } catch {
    throw new PacketError('decrypt-failed', 'incorrect passphrase or corrupted packet')
  }
}

export async function sealJson(value: unknown, passphrase: string, options?: SealOptions): Promise<PacketV2> {
  return sealBytes(utf8Encode(JSON.stringify(value)), passphrase, options)
}

export async function openJson<T = unknown>(
  packet: unknown,
  passphrase: string,
  options?: OpenOptions,
): Promise<T> {
  const bytes = await openBytes(packet, passphrase, options)
  try {
    return JSON.parse(utf8Decode(bytes)) as T
  } catch {
    throw new PacketError('malformed', 'packet plaintext is not JSON')
  }
}

// ---------------------------------------------------------------------------
// URL fragment helpers: #<prefix>=<base64url(JSON packet)>
// ---------------------------------------------------------------------------

const PREFIX_RE = /^[a-z][a-z0-9-]{0,31}$/

export function packetToHash(packet: SealedPacket, prefix = 'ctl'): string {
  if (!PREFIX_RE.test(prefix)) throw new PacketError('malformed', 'invalid hash prefix')
  return `#${prefix}=${bytesToBase64Url(utf8Encode(JSON.stringify(packet)))}`
}

/**
 * Extracts and validates a packet from a URL, a URL fragment, or a string that
 * merely contains `#<prefix>=…` (e.g. a chat message). Returns null when absent
 * or malformed; never throws.
 */
export function hashToPacket(input: string, prefix = 'ctl'): SealedPacket | null {
  if (typeof input !== 'string' || input.length > MAX_HASH_CHARS || !PREFIX_RE.test(prefix)) return null
  const match = input.match(new RegExp(`#(?:.*&)?${prefix}=([A-Za-z0-9_\\-+/=%]+)`))
  if (!match) return null
  try {
    const encoded = decodeURIComponent(match[1])
    return parsePacket(JSON.parse(utf8Decode(base64ToBytes(encoded))))
  } catch {
    return null
  }
}

/**
 * A random ~124-bit passphrase ("xxxxx-xxxxx-xxxxx-xxxxx-xxxxx") for sharing
 * out of band. WebCrypto randomness with rejection sampling (uniform).
 */
export function generatePassphrase(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789' // 31 symbols, no look-alikes
  const chars: string[] = []
  while (chars.length < 25) {
    for (const b of randomBytes(32)) {
      if (b < 248 && chars.length < 25) chars.push(alphabet[b % 31])
    }
  }
  return [0, 5, 10, 15, 20].map((i) => chars.slice(i, i + 5).join('')).join('-')
}
