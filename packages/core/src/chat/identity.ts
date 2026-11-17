// Per-device identity: an ECDH P-256 key pair (room-key wrapping) and an
// ECDSA P-256 key pair (message signatures). Private keys are generated
// non-extractable and persisted as CryptoKey objects in IndexedDB, so their
// bytes are never visible to JavaScript, to Aurelia, or to the server.

import { bytesToBase64Url, randomBytes } from '../crypto/encoding'
import type { DeviceRecord } from './types'

export const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' }
export const ECDSA_PARAMS: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' }

export type DeviceIdentity = {
  userId: string
  deviceId: string
  ecdhPrivateKey: CryptoKey
  ecdhPublicJwk: JsonWebKey
  signPrivateKey: CryptoKey
  signPublicJwk: JsonWebKey
  createdAt: string
}

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

/** Ids are embedded in AAD and HKDF info strings; restrict them so encodings are unambiguous. */
export function assertId(value: unknown, what: string): string {
  if (typeof value !== 'string' || !ID_RE.test(value)) throw new TypeError(`invalid ${what}`)
  return value
}

/** Copies only the public members of a P-256 JWK. Rejects anything else (and never forwards `d`). */
export function publicP256Jwk(jwk: unknown): JsonWebKey {
  const j = jwk as JsonWebKey | null
  if (!j || j.kty !== 'EC' || j.crv !== 'P-256' || typeof j.x !== 'string' || typeof j.y !== 'string') {
    throw new TypeError('expected a P-256 public JWK')
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(j.x) || !/^[A-Za-z0-9_-]{43}$/.test(j.y)) {
    throw new TypeError('malformed P-256 coordinates')
  }
  return { kty: 'EC', crv: 'P-256', x: j.x, y: j.y }
}

export function newDeviceId(): string {
  return bytesToBase64Url(randomBytes(16))
}

export async function generateDeviceIdentity(userId: string, deviceId = newDeviceId()): Promise<DeviceIdentity> {
  assertId(userId, 'user id')
  assertId(deviceId, 'device id')
  const ecdh = (await crypto.subtle.generateKey(ECDH_PARAMS, false, ['deriveBits'])) as CryptoKeyPair
  const sign = (await crypto.subtle.generateKey(ECDSA_PARAMS, false, ['sign', 'verify'])) as CryptoKeyPair
  return {
    userId,
    deviceId,
    ecdhPrivateKey: ecdh.privateKey,
    ecdhPublicJwk: publicP256Jwk(await crypto.subtle.exportKey('jwk', ecdh.publicKey)),
    signPrivateKey: sign.privateKey,
    signPublicJwk: publicP256Jwk(await crypto.subtle.exportKey('jwk', sign.publicKey)),
    createdAt: new Date().toISOString(),
  }
}

export function deviceRecordOf(identity: DeviceIdentity, label?: string): DeviceRecord {
  return {
    userId: identity.userId,
    deviceId: identity.deviceId,
    publicKey: identity.ecdhPublicJwk,
    signingKey: identity.signPublicJwk,
    label,
    createdAt: identity.createdAt,
  }
}

export async function importEcdhPublic(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', publicP256Jwk(jwk), ECDH_PARAMS, false, [])
}

export async function importEcdsaPublic(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', publicP256Jwk(jwk), ECDSA_PARAMS, false, ['verify'])
}

// ---------------------------------------------------------------------------
// Key stores
// ---------------------------------------------------------------------------

export interface KeyStore {
  loadIdentity(userId: string): Promise<DeviceIdentity | null>
  saveIdentity(identity: DeviceIdentity): Promise<void>
  deleteIdentity(userId: string): Promise<void>
  /** Atomically returns the next per-device message sequence number (starting at 1). */
  nextSeq(userId: string): Promise<number>
  /** Devices this user has verified out of band: deviceId -> fingerprint at verification time. */
  loadVerified(userId: string): Promise<Record<string, string>>
  setVerified(userId: string, deviceId: string, fingerprint: string | null): Promise<void>
}

export class MemoryKeyStore implements KeyStore {
  private identities = new Map<string, DeviceIdentity>()
  private seqs = new Map<string, number>()
  private verified = new Map<string, Record<string, string>>()

  async loadIdentity(userId: string) {
    return this.identities.get(userId) ?? null
  }
  async saveIdentity(identity: DeviceIdentity) {
    this.identities.set(identity.userId, identity)
  }
  async deleteIdentity(userId: string) {
    this.identities.delete(userId)
    this.seqs.delete(userId)
  }
  async nextSeq(userId: string) {
    const n = (this.seqs.get(userId) ?? 0) + 1
    this.seqs.set(userId, n)
    return n
  }
  async loadVerified(userId: string) {
    return { ...(this.verified.get(userId) ?? {}) }
  }
  async setVerified(userId: string, deviceId: string, fingerprint: string | null) {
    const map = { ...(this.verified.get(userId) ?? {}) }
    if (fingerprint) map[deviceId] = fingerprint
    else delete map[deviceId]
    this.verified.set(userId, map)
  }
}

const DB_NAME = 'aurelia-chat'
const DB_VERSION = 1
const S_IDENTITY = 'identity'
const S_SEQ = 'seq'
const S_VERIFIED = 'verified'

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/**
 * IndexedDB-backed key store. CryptoKey objects are structured-cloneable, so
 * the non-extractable private keys are stored as keys, not as bytes.
 */
export class IndexedDbKeyStore implements KeyStore {
  private db: Promise<IDBDatabase> | null = null
  constructor(private readonly dbName = DB_NAME) {}

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const r = indexedDB.open(this.dbName, DB_VERSION)
        r.onupgradeneeded = () => {
          const db = r.result
          for (const s of [S_IDENTITY, S_SEQ, S_VERIFIED]) {
            if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
          }
        }
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
    }
    return this.db
  }

  private async tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T>): Promise<T> {
    const db = await this.open()
    const t = db.transaction(store, mode)
    const done = new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
    const result = await fn(t.objectStore(store))
    await done
    return result
  }

  async loadIdentity(userId: string) {
    const v = await this.tx(S_IDENTITY, 'readonly', (s) => req(s.get(userId)))
    return (v as DeviceIdentity | undefined) ?? null
  }
  async saveIdentity(identity: DeviceIdentity) {
    await this.tx(S_IDENTITY, 'readwrite', (s) => req(s.put(identity, identity.userId)))
  }
  async deleteIdentity(userId: string) {
    await this.tx(S_IDENTITY, 'readwrite', (s) => req(s.delete(userId)))
    await this.tx(S_SEQ, 'readwrite', (s) => req(s.delete(userId)))
  }
  async nextSeq(userId: string) {
    // get + put inside one readwrite transaction: IndexedDB serialises
    // overlapping readwrite transactions on a store, so tabs cannot reuse a seq.
    return this.tx(S_SEQ, 'readwrite', (s) =>
      new Promise<number>((resolve, reject) => {
        const g = s.get(userId)
        g.onerror = () => reject(g.error)
        g.onsuccess = () => {
          const n = ((g.result as number | undefined) ?? 0) + 1
          const p = s.put(n, userId)
          p.onerror = () => reject(p.error)
          p.onsuccess = () => resolve(n)
        }
      }),
    )
  }
  async loadVerified(userId: string) {
    const v = await this.tx(S_VERIFIED, 'readonly', (s) => req(s.get(userId)))
    return { ...((v as Record<string, string> | undefined) ?? {}) }
  }
  async setVerified(userId: string, deviceId: string, fingerprint: string | null) {
    const map = await this.loadVerified(userId)
    if (fingerprint) map[deviceId] = fingerprint
    else delete map[deviceId]
    await this.tx(S_VERIFIED, 'readwrite', (s) => req(s.put(map, userId)))
  }
}
