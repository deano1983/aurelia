import { ctlPacketToHash, sealCtlPacket, type CtlFields } from '@aurelia/core/crypto'
import type { Draft, ProofPointer } from '../types'

// ---------------------------------------------------------------------------
// C.T.L. Relay deep-link builder (#ctl=)
// ---------------------------------------------------------------------------
// Uses the shared packet implementation in @aurelia/core/crypto, so a sealed
// packet produced here opens in 04 C.T.L. Relay (and in an Aurelia chat room)
// with the same shared passphrase. The draft goes in confidentialNote; an
// optional cross-cloud proof pointer from 02 Asset Vault goes in
// cloudProofPointer.
//
// Nothing is sent to a server: the ciphertext travels only in the URL hash
// fragment and is decrypted entirely in the receiver's browser.
// ---------------------------------------------------------------------------

/** URL of the 04 relay next to this app (/apps/04-ctl-encrypted-relay/ on the shared origin). */
function defaultRelayBase(): string {
  const here = new URL(import.meta.env.BASE_URL || '/', window.location.origin)
  return new URL('../04-ctl-encrypted-relay/', here).toString()
}

export async function buildCtlLink(options: {
  draft: Draft
  proofPointer: ProofPointer | null
  passphrase: string
  baseUrl?: string
}): Promise<string> {
  const { draft, proofPointer, passphrase, baseUrl } = options
  const base = baseUrl || defaultRelayBase()

  const fields: CtlFields = {
    senderDesk: 'Velvet Cadence Studio',
    senderRole: 'Executive Communications',
    recipientRole: 'LinkedIn Approver',
    channel: 'LinkedIn Authority Bundle',
    subject: `Draft for Approval — ${STYLE_LABEL[draft.style]}`,
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

  const packet = await sealCtlPacket(fields, passphrase)
  return `${base}${ctlPacketToHash(packet)}`
}

const STYLE_LABEL: Record<Draft['style'], string> = {
  executive: 'Executive Authority',
  punchy: 'Short & Punchy',
  human: 'Human Story',
}
