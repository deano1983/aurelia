import type { CtlFields, CtlPayload, SealedPacket } from '@aurelia/core/crypto'

/** Form state: the relay fields plus the (never sealed) shared passphrase. */
export type PacketFields = CtlFields & {
  passphrase: string
}

/** A sealed packet: v2 (written today) or legacy v1 "1.0" (decrypt-only). */
export type EncryptedPacket = SealedPacket

export type DecryptedPacket = CtlPayload
