-- 0001_profiles.sql
-- Aurelia OS: user profiles, per-user room salt, and empty per-app schemas.
--
-- Apply once, in order, via the Supabase SQL editor or `supabase db push`
-- (see supabase/README.md). Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by trigger on sign-up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  role         text not null default 'Executive' check (char_length(role) <= 40),
  -- Random 16-byte PBKDF2 salt for the room key, base64. Not secret: the room
  -- key is derived in the browser from the user's passphrase plus this salt,
  -- and neither the passphrase nor the key ever reaches the server.
  room_salt    text not null default encode(extensions.gen_random_bytes(16), 'base64'),
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'Aurelia OS user profile (display name, role label, room-key salt).';
comment on column public.profiles.room_salt is 'Base64 PBKDF2 salt for the client-side room key. Not secret. Not user-writable.';

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policies: rows are created by the trigger below and removed
-- by the cascade from auth.users. Users may only change name and role; the
-- salt is fixed so a stolen session cannot silently change everyone's key.
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, role) on public.profiles to authenticated;

-- Create the profile when a user signs up (magic link or Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    ), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users who signed up before this migration.
insert into public.profiles (id, display_name)
select u.id, left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
                           split_part(coalesce(u.email, ''), '@', 1), ''), 80)
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Per-app schemas, created empty. Each app (01-07) owns exactly one.
--
-- CONVENTION for every table an app adds (in a later migration):
--
--   create table app_0N.things (
--     id         uuid primary key default gen_random_uuid(),
--     owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
--     created_at timestamptz not null default now(),
--     ...
--   );
--   alter table app_0N.things enable row level security;
--   create policy "owner" on app_0N.things for all to authenticated
--     using (owner_id = (select auth.uid()))
--     with check (owner_id = (select auth.uid()));
--   grant select, insert, update, delete on app_0N.things to authenticated;
--
-- Encrypted payloads are encrypted in the browser with the room key before
-- insert; the server stores ciphertext only. To reach a schema from the
-- client, add it to Settings > API > Exposed schemas and call
-- supabase.schema('app_0N').from('things').
-- ---------------------------------------------------------------------------
do $$
declare
  s text;
begin
  foreach s in array array['app_01', 'app_02', 'app_03', 'app_04', 'app_05', 'app_06', 'app_07'] loop
    execute format('create schema if not exists %I', s);
    execute format('revoke all on schema %I from public, anon', s);
    execute format('grant usage on schema %I to authenticated', s);
    -- Tables created later still need RLS + a policy before anything is visible;
    -- these defaults only save repeating the grant in every migration.
    execute format('alter default privileges in schema %I grant select, insert, update, delete on tables to authenticated', s);
    execute format('alter default privileges in schema %I grant usage, select on sequences to authenticated', s);
  end loop;
end;
$$;

comment on schema app_01 is 'Aurelia app 01: Daily Command Timeline';
comment on schema app_02 is 'Aurelia app 02: Cross-Cloud Asset Vault';
comment on schema app_03 is 'Aurelia app 03: Voice Authority Studio';
comment on schema app_04 is 'Aurelia app 04: CTL Encrypted Relay';
comment on schema app_05 is 'Aurelia app 05: GlowGrid Creator Radar';
comment on schema app_06 is 'Aurelia app 06: Expense, Tax & Invoice';
comment on schema app_07 is 'Aurelia app 07: Distribution & Affiliate Engine';
