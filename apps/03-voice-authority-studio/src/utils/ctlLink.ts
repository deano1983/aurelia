import type { Draft, ProofPointer } from '../types'

// ---------------------------------------------------------------------------
// C.T.L. Relay deep-link builder (#ctl=)
// ---------------------------------------------------------------------------
// Mirrors the packet format used by 04 CTL Relay so a sealed packet produced
// here can be decrypted there with the same shared passphrase:
//   PBKDF2-SHA256 (120k rounds) -> AES-256-GCM -> base64url #ctl=<packet>
// The draft is placed in the confidentialNote field; an optional cross-cloud
// proof pointer from 02 Asset Vault is attached to cloudProofPointer.
//
// Nothing is sent to a server: the ciphertext travels only in the URL hash
// fragment and is decrypted entirely in the receiver's browser.
// ---------------------------------------------------------------------------

const ENCODER = new TextEncoder()
const PBKDF2_ROUNDS = 120_000

interface PacketFields {
  senderDesk: string
  senderRole: string
  recipientRole: string
  channel: string
  subject: string
  passphrase: string
  cloudProofPointer: string
  confidentialNote: string
}

interface EncryptedPacket {
  iv: string
  salt: string
  ciphertext: string
  version: string
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function buildCtlLink(options: {
  draft: Draft
  proofPointer: ProofPointer | null
  passphrase: string
  baseUrl?: string
}): Promise<string> {
  const { draft, proofPointer, passphrase, baseUrl } = options
  const base = baseUrl || `${window.location.origin}/04-ctl-encrypted-relay`

  const fields: PacketFields = {
    senderDesk: 'Velvet Cadence Studio',
    senderRole: 'Executive Communications',
    recipientRole: 'LinkedIn Approver',
    channel: 'LinkedIn Authority Bundle',
    subject: `Draft for Approval — ${STYLE_LABEL[draft.style]}`,
    passphrase,
    cloudProofPointer: proofPointer ? proofPointer.url : '',
    confidentialNote: [
      draft.title,
      '',
      draft.body,
      proofPointer ? `\n\nProof pointer: ${proofPointer.label} — ${proofPointer.url}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const plaintext = ENCODER.encode(
    JSON.stringify({ ...fields, timestamp: new Date().toISOString() }),
  )
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  )

  const packet: EncryptedPacket = {
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    version: '1.0',
  }

  const json = JSON.stringify(packet)
  const base64 = btoa(json)
  const base64url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `${base}#ctl=${base64url}`
}

const STYLE_LABEL: Record<Draft['style'], string> = {
  executive: 'Executive Authority',
  punchy: 'Short & Punchy',
  human: 'Human Story',
}
