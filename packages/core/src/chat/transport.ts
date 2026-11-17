// Storage/delivery abstraction. The Supabase implementation lives in
// supabaseTransport.ts; tests and the offline demo use MemoryChatServer.
// A transport only ever moves public keys, wrapped keys and ciphertext.

import type { DeviceRecord, MemberRecord, MessageRecord, RoomKeyRecord, RoomRecord } from './types'

export interface ChatTransport {
  /** Upserts this user's device public keys. */
  publishDevice(device: DeviceRecord): Promise<void>
  /** Marks one of the caller's own devices revoked (it receives no further room keys). */
  revokeDevice(deviceId: string): Promise<void>
  /** Devices for the given users (the server only returns users that share a room with the caller, or the caller). */
  listDevices(userIds: string[]): Promise<DeviceRecord[]>
  /** Resolves an email address or user id to a user id, or null. */
  resolveUser(identifier: string): Promise<string | null>

  /** Creates a room owned by the caller and makes the caller its owner-member. */
  createRoom(room: RoomRecord): Promise<RoomRecord>
  listRooms(): Promise<RoomRecord[]>
  listMembers(roomId: string): Promise<MemberRecord[]>
  addMembers(roomId: string, userIds: string[]): Promise<void>
  removeMember(roomId: string, userId: string): Promise<void>

  /** Highest key version that exists for the room (0 if none). */
  latestKeyVersion(roomId: string): Promise<number>
  /** Device ids that received the given key version. */
  listKeyRecipients(roomId: string, keyVersion: number): Promise<string[]>
  /** The wrapped key for one device and version, or null. */
  getWrappedKey(roomId: string, deviceId: string, keyVersion: number): Promise<RoomKeyRecord | null>
  /** Inserts all rows for a new key version. Must reject if (room, version, device) already exists. */
  putRoomKeys(rows: RoomKeyRecord[]): Promise<void>

  /** Inserts a message; rejects a duplicate (room, senderDevice, seq). */
  insertMessage(message: MessageRecord): Promise<MessageRecord>
  /** Most recent `limit` messages, oldest first. */
  listMessages(roomId: string, options?: { limit?: number }): Promise<MessageRecord[]>
  /** Live delivery of new messages in a room. Returns an unsubscribe function. */
  subscribe(roomId: string, onMessage: (message: MessageRecord) => void): () => void
}

export class TransportError extends Error {
  readonly code: 'forbidden' | 'conflict' | 'not-found' | 'backend'
  constructor(code: TransportError['code'], message: string) {
    super(message)
    this.name = 'TransportError'
    this.code = code
  }
}
