-- 0005: chat hardening from pentest round 2.
--
-- N-01 / N-02: a member could publish a room key at any version (for example
-- 2147483647), pinning the room to a key they control so that a later re-key
-- overflowed and a removed member kept reading. A new key version must now be
-- exactly the current latest + 1. All rows of one rotation go in one INSERT,
-- and policy checks see the snapshot from before the statement, so every row
-- of the batch passes; a concurrent rotation loses on the primary key and the
-- client retries at the next version.
--
-- N-07: a device id could be renamed, or deleted and re-registered with new
-- keys (a silent key swap under a known id). Device ids are now immutable and
-- devices are revoked, never deleted.

create or replace function public.chat_latest_key_version(p_room uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(max(k.key_version), 0) from public.chat_room_keys k where k.room_id = p_room;
$$;

revoke all on function public.chat_latest_key_version(uuid) from public;
grant execute on function public.chat_latest_key_version(uuid) to authenticated;

drop policy if exists chat_room_keys_insert on public.chat_room_keys;
create policy chat_room_keys_insert on public.chat_room_keys
  for insert to authenticated
  with check (
    public.chat_is_member(room_id)
    and wrapped_by_user = (select auth.uid())
    and public.chat_owns_device(wrapped_by_device)
    and public.chat_device_in_room(device_id, room_id)
    and key_version = public.chat_latest_key_version(room_id) + 1
  );

create or replace function public.chat_devices_immutable_keys()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.device_id <> old.device_id
     or new.user_id <> old.user_id
     or new.public_key <> old.public_key
     or new.signing_key <> old.signing_key then
    raise exception 'chat device ids and keys are immutable; register a new device instead'
      using errcode = '42501';
  end if;
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'a revoked chat device cannot be reinstated' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Revoke instead of delete, so a device id can never be reused with new keys.
drop policy if exists chat_devices_delete on public.chat_devices;
