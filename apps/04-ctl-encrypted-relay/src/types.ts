export type PacketFields = {
  senderDesk: string
  senderRole: string
  recipientRole: string
  channel: string
  subject: string
  passphrase: string
  cloudProofPointer: string
  confidentialNote: string
}

export type EncryptedPacket = {
  iv: string
  salt: string
  ciphertext: string
  version: string
}

export type DecryptedPacket = PacketFields & {
  timestamp: string
}