-- 0004_chat.sql — end-to-end encrypted chat (see docs/CHAT-SECURITY.md)
--
-- The server stores public keys, wrapped (encrypted) room keys and message
-- ciphertext only. Plaintext and room keys never reach Postgres. Row-level
-- security limits every table to room members, and users manage only their
-- own devices.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.chat_devices (
  device_id   text primary key check (device_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- ECDH P-256 public JWK (wraps room keys) and ECDSA P-256 public JWK (signatures).
  public_key  jsonb not null,
  signing_key jsonb not null,
  label       text check (char_length(label) <= 120),
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  constraint chat_devices_public_key_shape check (
    public_key ?& array['kty', 'crv', 'x', 'y'] and not (public_key ? 'd')
    and public_key ->> 'kty' = 'EC' and public_key ->> 'crv' = 'P-256'
  ),
  constraint chat_devices_signing_key_shape check (
    signing_key ?& array['kty', 'crv', 'x', 'y'] and not (signing_key ? 'd')
    and signing_key ->> 'kty' = 'EC' and signing_key ->> 'crv' = 'P-256'
  )
);
create index if not exists chat_devices_user_idx on public.chat_devices (user_id);

create table if not exists public.chat_rooms (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Room names are NOT encrypted: they are visible to the server (documented metadata).
  name       text not null default '' check (char_length(name) <= 120),
  kind       text not null default 'group' check (kind in ('direct', 'group')),
  created_at timestamptz not null default now()
);
create index if not exists chat_rooms_owner_idx on public.chat_rooms (owner_id);

create table if not exists public.chat_members (
  room_id    uuid not null references public.chat_rooms (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  added_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists chat_members_user_idx on public.chat_members (user_id);

create table if not exists public.chat_room_keys (
  room_id           uuid not null references public.chat_rooms (id) on delete cascade,
  key_version       integer not null check (key_version >= 1),
  -- Recipient device.
  device_id         text not null references public.chat_devices (device_id) on delete cascade,
  -- base64url(salt | iv | AES-GCM-wrapped room key). Useless without the recipient's private key.
  wrapped_key       text not null check (char_length(wrapped_key) <= 256),
  wrapped_by_user   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  wrapped_by_device text not null,
  created_at        timestamptz not null default now(),
  primary key (room_id, key_version, device_id)
);
create index if not exists chat_room_keys_device_idx on public.chat_room_keys (device_id);

create table if not exists public.chat_messages (
  id            bigint generated always as identity primary key,
  room_id       uuid not null references public.chat_rooms (id) on delete cascade,
  sender_user   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sender_device text not null,
  seq           bigint not null check (seq >= 1),
  key_version   integer not null check (key_version >= 1),
  iv            text not null check (char_length(iv) between 16 and 24),
  ciphertext    text not null check (char_length(ciphertext) <= 180000),
  signature     text not null check (char_length(signature) <= 128),
  created_at    timestamptz not null default now(),
  unique (room_id, sender_device, seq)
);
create index if not exists chat_messages_room_idx on public.chat_messages (room_id, id desc);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can consult membership without
-- recursing into RLS). All pin search_path.
-- ---------------------------------------------------------------------------

create or replace function public.chat_is_member(p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_members m
    where m.room_id = p_room and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.chat_is_owner(p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_rooms r
    where r.id = p_room and r.owner_id = (select auth.uid())
  );
$$;

-- True when the caller and p_user share at least one room.
create or replace function public.chat_shares_room(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_members a
    join public.chat_members b on b.room_id = a.room_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

-- True when the device sent a message or wrapped a room key in one of the
-- caller's rooms (keeps former members' messages verifiable).
create or replace function public.chat_device_seen_in_my_rooms(p_device text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_messages msg
    join public.chat_members m on m.room_id = msg.room_id and m.user_id = (select auth.uid())
    where msg.sender_device = p_device
  ) or exists (
    select 1 from public.chat_room_keys k
    join public.chat_members m on m.room_id = k.room_id and m.user_id = (select auth.uid())
    where k.wrapped_by_device = p_device
  );
$$;

-- True when p_device belongs to the caller and is not revoked.
create or replace function public.chat_owns_device(p_device text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_devices d
    where d.device_id = p_device and d.user_id = (select auth.uid()) and d.revoked_at is null
  );
$$;

-- True when p_device belongs to a current member of p_room and is not revoked.
create or replace function public.chat_device_in_room(p_device text, p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_devices d
    join public.chat_members m on m.user_id = d.user_id and m.room_id = p_room
    where d.device_id = p_device and d.revoked_at is null
  );
$$;

-- Resolve an email address or user id to a user id, for invitations. Only
-- signed-in callers, and only users who have registered a chat device, are
-- discoverable (limits account enumeration to chat users).
create or replace function public.chat_resolve_user(identifier text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v uuid;
  s text := lower(trim(identifier));
begin
  if (select auth.uid()) is null or s is null or s = '' then
    return null;
  end if;
  if s ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select u.id into v from auth.users u where u.id = s::uuid;
  else
    select u.id into v from auth.users u where lower(u.email) = s limit 1;
  end if;
  if v is not null and not exists (
    select 1 from public.chat_devices d where d.user_id = v and d.revoked_at is null
  ) then
    v := null;
  end if;
  return v;
end;
$$;

-- The room owner becomes an owner-member automatically.
create or replace function public.chat_rooms_add_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_members (room_id, user_id, role, added_by)
  values (new.id, new.owner_id, 'owner', new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists chat_rooms_add_owner on public.chat_rooms;
create trigger chat_rooms_add_owner
  after insert on public.chat_rooms
  for each row execute function public.chat_rooms_add_owner();

-- A device's keys and owner are immutable: a key change must be a new device
-- (which other members see as a new safety number), never a silent swap.
create or replace function public.chat_devices_immutable_keys()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.user_id <> old.user_id
     or new.public_key <> old.public_key
     or new.signing_key <> old.signing_key then
    raise exception 'chat device keys are immutable; register a new device instead'
      using errcode = '42501';
  end if;
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'a revoked chat device cannot be reinstated' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists chat_devices_immutable_keys on public.chat_devices;
create trigger chat_devices_immutable_keys
  before update on public.chat_devices
  for each row execute function public.chat_devices_immutable_keys();

revoke all on function public.chat_is_member(uuid) from public, anon;
revoke all on function public.chat_is_owner(uuid) from public, anon;
revoke all on function public.chat_shares_room(uuid) from public, anon;
revoke all on function public.chat_device_seen_in_my_rooms(text) from public, anon;
revoke all on function public.chat_owns_device(text) from public, anon;
revoke all on function public.chat_device_in_room(text, uuid) from public, anon;
revoke all on function public.chat_resolve_user(text) from public, anon;
grant execute on function public.chat_is_member(uuid) to authenticated;
grant execute on function public.chat_is_owner(uuid) to authenticated;
grant execute on function public.chat_shares_room(uuid) to authenticated;
grant execute on function public.chat_device_seen_in_my_rooms(text) to authenticated;
grant execute on function public.chat_owns_device(text) to authenticated;
grant execute on function public.chat_device_in_room(text, uuid) to authenticated;
grant execute on function public.chat_resolve_user(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.chat_devices   enable row level security;
alter table public.chat_rooms     enable row level security;
alter table public.chat_members   enable row level security;
alter table public.chat_room_keys enable row level security;
alter table public.chat_messages  enable row level security;

revoke all on public.chat_devices, public.chat_rooms, public.chat_members,
              public.chat_room_keys, public.chat_messages from anon;

-- chat_devices: users manage only their own devices; others see a device's
-- public keys only when they share a room with its owner (or it appears in
-- one of their rooms).
drop policy if exists chat_devices_select on public.chat_devices;
create policy chat_devices_select on public.chat_devices
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.chat_shares_room(user_id)
    or public.chat_device_seen_in_my_rooms(device_id)
  );

drop policy if exists chat_devices_insert on public.chat_devices;
create policy chat_devices_insert on public.chat_devices
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists chat_devices_update on public.chat_devices;
create policy chat_devices_update on public.chat_devices
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists chat_devices_delete on public.chat_devices;
create policy chat_devices_delete on public.chat_devices
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- chat_rooms: visible to the owner and members; only the owner changes it.
drop policy if exists chat_rooms_select on public.chat_rooms;
create policy chat_rooms_select on public.chat_rooms
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.chat_is_member(id));

drop policy if exists chat_rooms_insert on public.chat_rooms;
create policy chat_rooms_insert on public.chat_rooms
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists chat_rooms_update on public.chat_rooms;
create policy chat_rooms_update on public.chat_rooms
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists chat_rooms_delete on public.chat_rooms;
create policy chat_rooms_delete on public.chat_rooms
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- chat_members: members see the member list; the owner adds members; the
-- owner removes others, and any non-owner member may leave.
drop policy if exists chat_members_select on public.chat_members;
create policy chat_members_select on public.chat_members
  for select to authenticated
  using (public.chat_is_member(room_id));

drop policy if exists chat_members_insert on public.chat_members;
create policy chat_members_insert on public.chat_members
  for insert to authenticated
  with check (
    public.chat_is_owner(room_id)
    and role = 'member'
    and added_by = (select auth.uid())
  );

drop policy if exists chat_members_delete on public.chat_members;
create policy chat_members_delete on public.chat_members
  for delete to authenticated
  using (
    (public.chat_is_owner(room_id) and user_id <> (select auth.uid()))
    or (user_id = (select auth.uid()) and role <> 'owner')
  );

-- chat_room_keys: members read the room's wrapped keys (each is encrypted to
-- one device); a member may publish a new key version from one of their own
-- devices, for devices of current members only. Rows are immutable.
drop policy if exists chat_room_keys_select on public.chat_room_keys;
create policy chat_room_keys_select on public.chat_room_keys
  for select to authenticated
  using (public.chat_is_member(room_id));

drop policy if exists chat_room_keys_insert on public.chat_room_keys;
create policy chat_room_keys_insert on public.chat_room_keys
  for insert to authenticated
  with check (
    public.chat_is_member(room_id)
    and wrapped_by_user = (select auth.uid())
    and public.chat_owns_device(wrapped_by_device)
    and public.chat_device_in_room(device_id, room_id)
  );

-- chat_messages: members read and post in their rooms, as themselves, from
-- one of their own non-revoked devices. Messages are immutable.
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select to authenticated
  using (public.chat_is_member(room_id));

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (
    public.chat_is_member(room_id)
    and sender_user = (select auth.uid())
    and public.chat_owns_device(sender_device)
  );

-- ---------------------------------------------------------------------------
-- Realtime: deliver new ciphertext rows to subscribed members (Realtime
-- applies the select policy above per subscriber).
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
     ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;
