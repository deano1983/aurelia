// Safety numbers. Each device has a 30-digit fingerprint derived from
// SHA-256 over its user id and both public keys. Two people compare the
// pairwise safety number (both fingerprints, sorted, 60 digits in 12 groups
// of five) in person or on a call; if it matches, nobody - including the
// Aurelia server - has substituted a key between them.

import { base64ToBytes, concatBytes, toBufferSource, u32, utf8Encode } from '../crypto/encoding'
import { assertId, publicP256Jwk } from './identity'
import type { DeviceRecord } from './types'

const FP_LABEL = 'aurelia-chat/fingerprint/v1'

function rawP256(jwk: JsonWebKey): Uint8Array {
  const pub = publicP256Jwk(jwk)
  return concatBytes(new Uint8Array([0x04]), base64ToBytes(pub.x!), base64ToBytes(pub.y!))
}

function lengthPrefixed(bytes: Uint8Array): Uint8Array {
  return concatBytes(u32(bytes.byteLength), bytes)
}

/** 30 decimal digits (no spaces) identifying a device's keys. Deterministic. */
export async function deviceFingerprint(device: Pick<DeviceRecord, 'userId' | 'publicKey' | 'signingKey'>): Promise<string> {
  const input = concatBytes(
    lengthPrefixed(utf8Encode(FP_LABEL)),
    lengthPrefixed(utf8Encode(assertId(device.userId, 'user id'))),
    lengthPrefixed(rawP256(device.publicKey)),
    lengthPrefixed(rawP256(device.signingKey)),
  )
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', toBufferSource(input)))
  let digits = ''
  for (let i = 0; i < 30; i += 5) {
    // 40-bit big-endian chunk -> 5 digits (bias of 2^40 mod 10^5 is negligible).
    let n = 0
    for (let j = 0; j < 5; j++) n = n * 256 + digest[i + j]
    digits += String(n % 100000).padStart(5, '0')
  }
  return digits
}

export function groupDigits(digits: string, size = 5): string {
  return (digits.match(new RegExp(`.{1,${size}}`, 'g')) ?? []).join(' ')
}

/** Pairwise safety number; identical on both sides regardless of who computes it. */
export async function safetyNumber(
  a: Pick<DeviceRecord, 'userId' | 'publicKey' | 'signingKey'>,
  b: Pick<DeviceRecord, 'userId' | 'publicKey' | 'signingKey'>,
): Promise<string> {
  const [fa, fb] = await Promise.all([deviceFingerprint(a), deviceFingerprint(b)])
  return groupDigits([fa, fb].sort().join(''))
}
