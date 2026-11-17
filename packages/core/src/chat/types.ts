// Wire records (what the server stores) and client-side views.
// The server only ever stores records from the first section: public keys,
// wrapped (encrypted) room keys and message ciphertext.

/** Public half of a device identity, as published to `chat_devices`. */
export type DeviceRecord = {
  userId: string
  deviceId: string
  /** ECDH P-256 public key (JWK, public members only). Used to wrap room keys. */
  publicKey: JsonWebKey
  /** ECDSA P-256 public key (JWK, public members only). Verifies message signatures. */
  signingKey: JsonWebKey
  label?: string
  createdAt?: string
  /** Set when the owner revokes the device; it then receives no new room keys. */
  revokedAt?: string | null
}

export type RoomKind = 'direct' | 'group'

export type RoomRecord = {
  id: string
  ownerId: string
  name: string
  kind: RoomKind
  createdAt?: string
}

export type MemberRecord = {
  roomId: string
  userId: string
  role: 'owner' | 'member'
}

/** A room key for one key version, wrapped for one recipient device. */
export type RoomKeyRecord = {
  roomId: string
  keyVersion: number
  /** Recipient device. */
  deviceId: string
  /** base64url(salt[32] | iv[12] | AES-GCM(wrapped raw key)). */
  wrappedKey: string
  wrappedByUser: string
  wrappedByDevice: string
  createdAt?: string
}

export type MessageRecord = {
  id?: string
  roomId: string
  senderUser: string
  senderDevice: string
  seq: number
  keyVersion: number
  /** base64url 12-byte IV. */
  iv: string
  /** base64url AES-GCM ciphertext (includes the tag). */
  ciphertext: string
  /** base64url ECDSA P-256/SHA-256 signature (IEEE P1363). */
  signature: string
  createdAt?: string
}

// ---------------------------------------------------------------------------
// Decrypted, client-side only
// ---------------------------------------------------------------------------

export type TextContent = { type: 'text'; text: string }
/** A sealed C.T.L. relay packet (#ctl=…) dropped into a room; opened with the room passphrase. */
export type CtlContent = { type: 'ctl'; hash: string; label?: string }
export type MessageContent = TextContent | CtlContent

export type MessageStatus =
  | 'ok'
  /** Sent under a key version this device never received (e.g. before it joined). */
  | 'no-key'
  /** Signature, AAD or ciphertext failed verification: forged or corrupted. */
  | 'invalid'

export type ChatMessage = {
  id?: string
  roomId: string
  senderUser: string
  senderDevice: string
  seq: number
  keyVersion: number
  createdAt?: string
  /** Sender's clock, from inside the ciphertext. */
  sentAt?: string
  status: MessageStatus
  content?: MessageContent
}

export type DeviceView = DeviceRecord & {
  fingerprint: string
  /** Pairwise safety number between this device and the viewer's device. */
  safetyNumber: string
  verified: boolean
  isSelf: boolean
}
