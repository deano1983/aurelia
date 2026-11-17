// ChatTransport over Supabase (tables + RLS in supabase/migrations/0004_chat.sql).
// Takes an already-authenticated SupabaseClient so it can share the app-wide
// client from @aurelia/core/auth without importing it here.

import type { SupabaseClient } from '@supabase/supabase-js'
import { TransportError, type ChatTransport } from './transport'
import type { DeviceRecord, MemberRecord, MessageRecord, RoomKeyRecord, RoomRecord } from './types'

type Row = Record<string, unknown>

function fail(error: { code?: string; message: string } | null): never {
  const code = error?.code === '23505' ? 'conflict' : error?.code === '42501' ? 'forbidden' : 'backend'
  throw new TransportError(code, error?.message ?? 'Supabase request failed')
}

const deviceFrom = (r: Row): DeviceRecord => ({
  userId: String(r.user_id),
  deviceId: String(r.device_id),
  publicKey: r.public_key as JsonWebKey,
  signingKey: r.signing_key as JsonWebKey,
  label: (r.label as string | null) ?? undefined,
  createdAt: r.created_at as string,
  revokedAt: (r.revoked_at as string | null) ?? null,
})

const roomFrom = (r: Row): RoomRecord => ({
  id: String(r.id),
  ownerId: String(r.owner_id),
  name: String(r.name ?? ''),
  kind: r.kind === 'direct' ? 'direct' : 'group',
  createdAt: r.created_at as string,
})

const keyFrom = (r: Row): RoomKeyRecord => ({
  roomId: String(r.room_id),
  keyVersion: Number(r.key_version),
  deviceId: String(r.device_id),
  wrappedKey: String(r.wrapped_key),
  wrappedByUser: String(r.wrapped_by_user),
  wrappedByDevice: String(r.wrapped_by_device),
  createdAt: r.created_at as string,
})

export const messageFromRow = (r: Row): MessageRecord => ({
  id: String(r.id),
  roomId: String(r.room_id),
  senderUser: String(r.sender_user),
  senderDevice: String(r.sender_device),
  seq: Number(r.seq),
  keyVersion: Number(r.key_version),
  iv: String(r.iv),
  ciphertext: String(r.ciphertext),
  signature: String(r.signature),
  createdAt: r.created_at as string,
})

export function createSupabaseChatTransport(supabase: SupabaseClient, userId: string): ChatTransport {
  return {
    async publishDevice(d) {
      const { error } = await supabase.from('chat_devices').upsert(
        {
          user_id: userId,
          device_id: d.deviceId,
          public_key: d.publicKey,
          signing_key: d.signingKey,
          label: d.label ?? null,
        },
        { onConflict: 'device_id' },
      )
      if (error) fail(error)
    },

    async listDevices(userIds) {
      if (!userIds.length) return []
      const { data, error } = await supabase
        .from('chat_devices')
        // Revoked devices are returned too, so their past messages stay verifiable;
        // the client never wraps new room keys for them.
        .select('user_id, device_id, public_key, signing_key, label, created_at, revoked_at')
        .in('user_id', userIds)
      if (error) fail(error)
      return (data ?? []).map(deviceFrom)
    },

    async resolveUser(identifier) {
      const { data, error } = await supabase.rpc('chat_resolve_user', { identifier: identifier.trim() })
      if (error) fail(error)
      return typeof data === 'string' && data ? data : null
    },

    async createRoom(room) {
      // Client-generated id: the owner is not a member until the trigger adds them,
      // so we avoid relying on RETURNING visibility.
      const { error } = await supabase
        .from('chat_rooms')
        .insert({ id: room.id, owner_id: userId, name: room.name, kind: room.kind })
      if (error) fail(error)
      return { ...room, ownerId: userId }
    },

    async listRooms() {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('id, owner_id, name, kind, created_at')
        .order('created_at', { ascending: false })
      if (error) fail(error)
      return (data ?? []).map(roomFrom)
    },

    async listMembers(roomId) {
      const { data, error } = await supabase.from('chat_members').select('room_id, user_id, role').eq('room_id', roomId)
      if (error) fail(error)
      return (data ?? []).map(
        (r: Row): MemberRecord => ({
          roomId: String(r.room_id),
          userId: String(r.user_id),
          role: r.role === 'owner' ? 'owner' : 'member',
        }),
      )
    },

    async addMembers(roomId, userIds) {
      if (!userIds.length) return
      const { error } = await supabase
        .from('chat_members')
        .upsert(
          userIds.map((u) => ({ room_id: roomId, user_id: u, role: 'member', added_by: userId })),
          { onConflict: 'room_id,user_id', ignoreDuplicates: true },
        )
      if (error) fail(error)
    },

    async removeMember(roomId, target) {
      const { error } = await supabase.from('chat_members').delete().eq('room_id', roomId).eq('user_id', target)
      if (error) fail(error)
    },

    async latestKeyVersion(roomId) {
      const { data, error } = await supabase
        .from('chat_room_keys')
        .select('key_version')
        .eq('room_id', roomId)
        .order('key_version', { ascending: false })
        .limit(1)
      if (error) fail(error)
      return data && data.length ? Number((data[0] as Row).key_version) : 0
    },

    async listKeyRecipients(roomId, keyVersion) {
      const { data, error } = await supabase
        .from('chat_room_keys')
        .select('device_id')
        .eq('room_id', roomId)
        .eq('key_version', keyVersion)
      if (error) fail(error)
      return (data ?? []).map((r: Row) => String(r.device_id))
    },

    async getWrappedKey(roomId, deviceId, keyVersion) {
      const { data, error } = await supabase
        .from('chat_room_keys')
        .select('room_id, key_version, device_id, wrapped_key, wrapped_by_user, wrapped_by_device, created_at')
        .eq('room_id', roomId)
        .eq('device_id', deviceId)
        .eq('key_version', keyVersion)
        .maybeSingle()
      if (error) fail(error)
      return data ? keyFrom(data as Row) : null
    },

    async putRoomKeys(rows) {
      const { error } = await supabase.from('chat_room_keys').insert(
        rows.map((r) => ({
          room_id: r.roomId,
          key_version: r.keyVersion,
          device_id: r.deviceId,
          wrapped_key: r.wrappedKey,
          wrapped_by_user: userId,
          wrapped_by_device: r.wrappedByDevice,
        })),
      )
      if (error) fail(error)
    },

    async insertMessage(m) {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: m.roomId,
          sender_user: userId,
          sender_device: m.senderDevice,
          seq: m.seq,
          key_version: m.keyVersion,
          iv: m.iv,
          ciphertext: m.ciphertext,
          signature: m.signature,
        })
        .select('*')
        .single()
      if (error) fail(error)
      return messageFromRow(data as Row)
    },

    async listMessages(roomId, options) {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('id', { ascending: false })
        .limit(Math.min(Math.max(options?.limit ?? 100, 1), 500))
      if (error) fail(error)
      return (data ?? []).map(messageFromRow).reverse()
    },

    subscribe(roomId, onMessage) {
      const channel = supabase
        .channel(`chat-room-${roomId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
          (payload) => onMessage(messageFromRow(payload.new as Row)),
        )
        .subscribe()
      return () => {
        void supabase.removeChannel(channel)
      }
    },
  }
}
