// C.T.L. Relay payload: the JSON object sealed inside a #ctl= packet.
// Shared by 04 (relay), 03 (draft approval links) and chat (sealed packets
// dropped into a room).

import {
  hashToPacket,
  openJson,
  packetToHash,
  sealJson,
  type SealedPacket,
  type PacketV2,
  type SealOptions,
} from './packet'

export type CtlFields = {
  senderDesk: string
  senderRole: string
  recipientRole: string
  channel: string
  subject: string
  cloudProofPointer: string
  confidentialNote: string
}

export type CtlPayload = CtlFields & { timestamp: string }

const CTL_FIELD_NAMES: (keyof CtlFields)[] = [
  'senderDesk',
  'senderRole',
  'recipientRole',
  'channel',
  'subject',
  'cloudProofPointer',
  'confidentialNote',
]

const MAX_FIELD_CHARS = 64 * 1024

function str(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_FIELD_CHARS) : ''
}

/**
 * Seals relay fields. Only the known fields are sealed: legacy callers passed
 * the passphrase inside the fields object and it ended up in the ciphertext,
 * which is no longer the case.
 */
export async function sealCtlPacket(
  fields: Partial<CtlFields>,
  passphrase: string,
  options: Omit<SealOptions, 'context'> = {},
): Promise<PacketV2> {
  const payload: Record<string, string> = {}
  for (const name of CTL_FIELD_NAMES) payload[name] = str(fields[name])
  payload.timestamp = new Date().toISOString()
  return sealJson(payload, passphrase, { ...options, context: 'ctl' })
}

/** Opens a #ctl= packet (v1 or v2) and returns a sanitised payload. Throws PacketError. */
export async function openCtlPacket(packet: unknown, passphrase: string): Promise<CtlPayload> {
  const raw = await openJson<Record<string, unknown>>(packet, passphrase, { context: 'ctl' })
  const out = { timestamp: str(raw?.timestamp) } as CtlPayload
  for (const name of CTL_FIELD_NAMES) out[name] = str(raw?.[name])
  return out
}

export function ctlPacketToHash(packet: SealedPacket): string {
  return packetToHash(packet, 'ctl')
}

export function ctlHashToPacket(input: string): SealedPacket | null {
  return hashToPacket(input, 'ctl')
}
