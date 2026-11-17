// Room-key wrapping and message encryption primitives.
//
// Room key   random AES-256-GCM key per (room, key version).
// Wrapping   ECDH(P-256, wrapper device private, recipient device public)
//            -> HKDF-SHA256(salt = 32 random bytes, info = "aurelia-chat/room-key/v1|<roomId>")
//            -> AES-256-GCM key that wraps the raw room key, with
//               AAD = "aurelia-chat/wrap/v1|room|version|fromDevice|toDevice".
// Messages   AES-256-GCM(room key, random 96-bit IV,
//               AAD = "aurelia-chat/msg/v1|room|senderUser|senderDevice|seq|keyVersion")
//            then ECDSA P-256/SHA-256 signature by the sender device over
//            len(AAD)|AAD|IV|ciphertext, so members cannot forge each other.

import {
  base64ToBytes,
  bytesToBase64Url,
  concatBytes,
  randomBytes,
  toBufferSource,
  u32,
  utf8Decode,
  utf8Encode,
} from '../crypto/encoding'
import { assertId, importEcdhPublic, importEcdsaPublic } from './identity'
import type { MessageContent, MessageRecord } from './types'

const WRAP_SALT_BYTES = 32
const IV_BYTES = 12
const MAX_TEXT_CHARS = 16_000
const MAX_CIPHERTEXT_B64 = 128 * 1024

export async function generateRoomKey(): Promise<CryptoKey> {
  // Extractable only so it can be wrapped once for each member device; the
  // caller drops it after wrapping and uses its own unwrapped (non-extractable) copy.
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

function wrapAad(roomId: string, version: number, fromDevice: string, toDevice: string): Uint8Array {
  return utf8Encode(`aurelia-chat/wrap/v1|${roomId}|${version}|${fromDevice}|${toDevice}`)
}

async function deriveWrappingKey(
  ownPrivate: CryptoKey,
  peerPublicJwk: JsonWebKey,
  salt: Uint8Array,
  roomId: string,
): Promise<CryptoKey> {
  const peer = await importEcdhPublic(peerPublicJwk)
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, ownPrivate, 256)
  const hkdf = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toBufferSource(salt),
      info: toBufferSource(utf8Encode(`aurelia-chat/room-key/v1|${roomId}`)),
    },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

export type WrapContext = {
  roomId: string
  keyVersion: number
  fromDevice: string
  toDevice: string
}

function checkWrapContext(c: WrapContext) {
  assertId(c.roomId, 'room id')
  assertId(c.fromDevice, 'device id')
  assertId(c.toDevice, 'device id')
  if (!Number.isSafeInteger(c.keyVersion) || c.keyVersion < 1) throw new TypeError('invalid key version')
}

export async function wrapRoomKey(
  roomKey: CryptoKey,
  ownEcdhPrivate: CryptoKey,
  recipientPublicJwk: JsonWebKey,
  ctx: WrapContext,
): Promise<string> {
  checkWrapContext(ctx)
  const salt = randomBytes(WRAP_SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const kek = await deriveWrappingKey(ownEcdhPrivate, recipientPublicJwk, salt, ctx.roomId)
  const wrapped = await crypto.subtle.wrapKey('raw', roomKey, kek, {
    name: 'AES-GCM',
    iv: toBufferSource(iv),
    additionalData: toBufferSource(wrapAad(ctx.roomId, ctx.keyVersion, ctx.fromDevice, ctx.toDevice)),
  })
  return bytesToBase64Url(concatBytes(salt, iv, new Uint8Array(wrapped)))
}

/** Returns a NON-extractable room key, or throws if the blob was not wrapped for this device/context. */
export async function unwrapRoomKey(
  wrappedKey: string,
  ownEcdhPrivate: CryptoKey,
  wrapperPublicJwk: JsonWebKey,
  ctx: WrapContext,
): Promise<CryptoKey> {
  checkWrapContext(ctx)
  const blob = base64ToBytes(wrappedKey)
  if (blob.byteLength !== WRAP_SALT_BYTES + IV_BYTES + 32 + 16) throw new TypeError('malformed wrapped key')
  const salt = blob.subarray(0, WRAP_SALT_BYTES)
  const iv = blob.subarray(WRAP_SALT_BYTES, WRAP_SALT_BYTES + IV_BYTES)
  const ct = blob.subarray(WRAP_SALT_BYTES + IV_BYTES)
  const kek = await deriveWrappingKey(ownEcdhPrivate, wrapperPublicJwk, salt, ctx.roomId)
  return crypto.subtle.unwrapKey(
    'raw',
    toBufferSource(ct),
    kek,
    {
      name: 'AES-GCM',
      iv: toBufferSource(iv),
      additionalData: toBufferSource(wrapAad(ctx.roomId, ctx.keyVersion, ctx.fromDevice, ctx.toDevice)),
    },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type MessageHeader = Pick<MessageRecord, 'roomId' | 'senderUser' | 'senderDevice' | 'seq' | 'keyVersion'>

export function messageAad(h: MessageHeader): Uint8Array {
  assertId(h.roomId, 'room id')
  assertId(h.senderUser, 'user id')
  assertId(h.senderDevice, 'device id')
  if (!Number.isSafeInteger(h.seq) || h.seq < 1) throw new TypeError('invalid seq')
  if (!Number.isSafeInteger(h.keyVersion) || h.keyVersion < 1) throw new TypeError('invalid key version')
  return utf8Encode(
    `aurelia-chat/msg/v1|${h.roomId}|${h.senderUser}|${h.senderDevice}|${h.seq}|${h.keyVersion}`,
  )
}

function signedBytes(aad: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  return concatBytes(u32(aad.byteLength), aad, iv, ciphertext)
}

type Plaintext = { v: 1; content: MessageContent; sentAt: string }

export function validateContent(content: unknown): MessageContent {
  const c = content as MessageContent | null
  if (c && c.type === 'text' && typeof c.text === 'string' && c.text.length <= MAX_TEXT_CHARS) {
    return { type: 'text', text: c.text }
  }
  if (c && c.type === 'ctl' && typeof c.hash === 'string' && c.hash.length <= 64 * 1024 && /#(?:.*&)?ctl=/.test(c.hash)) {
    return { type: 'ctl', hash: c.hash, ...(typeof c.label === 'string' ? { label: c.label.slice(0, 200) } : {}) }
  }
  throw new TypeError('unsupported message content')
}

export async function encryptMessage(
  header: MessageHeader,
  content: MessageContent,
  roomKey: CryptoKey,
  signPrivate: CryptoKey,
): Promise<MessageRecord> {
  const aad = messageAad(header)
  const iv = randomBytes(IV_BYTES)
  const body: Plaintext = { v: 1, content: validateContent(content), sentAt: new Date().toISOString() }
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toBufferSource(iv), additionalData: toBufferSource(aad) },
      roomKey,
      toBufferSource(utf8Encode(JSON.stringify(body))),
    ),
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signPrivate,
      toBufferSource(signedBytes(aad, iv, ciphertext)),
    ),
  )
  return {
    ...header,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(ciphertext),
    signature: bytesToBase64Url(signature),
  }
}

export class MessageVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MessageVerificationError'
  }
}

/** Verifies signature and AEAD. Throws MessageVerificationError on any failure. */
export async function decryptMessage(
  record: MessageRecord,
  roomKey: CryptoKey,
  senderSigningJwk: JsonWebKey,
): Promise<{ content: MessageContent; sentAt: string }> {
  let aad: Uint8Array, iv: Uint8Array, ct: Uint8Array, sig: Uint8Array
  try {
    if (record.ciphertext.length > MAX_CIPHERTEXT_B64) throw new Error('too large')
    aad = messageAad(record)
    iv = base64ToBytes(record.iv)
    ct = base64ToBytes(record.ciphertext)
    sig = base64ToBytes(record.signature)
    if (iv.byteLength !== IV_BYTES || ct.byteLength < 16 || sig.byteLength !== 64) throw new Error('lengths')
  } catch {
    throw new MessageVerificationError('malformed message')
  }
  const verifyKey = await importEcdsaPublic(senderSigningJwk)
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    verifyKey,
    toBufferSource(sig),
    toBufferSource(signedBytes(aad, iv, ct)),
  )
  if (!ok) throw new MessageVerificationError('bad signature')
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toBufferSource(iv), additionalData: toBufferSource(aad) },
      roomKey,
      toBufferSource(ct),
    )
  } catch {
    throw new MessageVerificationError('decryption failed')
  }
  try {
    const body = JSON.parse(utf8Decode(plain)) as Plaintext
    if (body.v !== 1) throw new Error('version')
    return { content: validateContent(body.content), sentAt: typeof body.sentAt === 'string' ? body.sentAt : '' }
  } catch {
    throw new MessageVerificationError('invalid plaintext')
  }
}
