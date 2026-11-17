-- 0003_linkedin: LinkedIn connections for direct posting, and a share log.
--
-- linkedin_connections holds each user's LinkedIn access token. Clients can
-- never read it: RLS is on with no policies (so anon/authenticated see
-- nothing), and table privileges are revoked as a second lock. Only the edge
-- functions, which use the service role key, read or write it. Clients learn
-- whether they are connected through linkedin_status(), which returns no
-- token.

create table if not exists public.linkedin_connections (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  member_sub   text not null,
  access_token text not null,
  expires_at   timestamptz,
  scope        text,
  updated_at   timestamptz not null default now()
);

alter table public.linkedin_connections enable row level security;
alter table public.linkedin_connections force row level security;
revoke all on table public.linkedin_connections from anon, authenticated;
grant all on table public.linkedin_connections to service_role;

-- Connected flag and expiry for the signed-in user only. SECURITY DEFINER so
-- it can read past RLS; it filters on auth.uid() and returns no token.
create or replace function public.linkedin_status()
returns table (connected boolean, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.linkedin_connections c
      where c.user_id = auth.uid()
        and (c.expires_at is null or c.expires_at > now())
    ) as connected,
    (select c.expires_at from public.linkedin_connections c where c.user_id = auth.uid()) as expires_at;
$$;

revoke all on function public.linkedin_status() from public, anon;
grant execute on function public.linkedin_status() to authenticated;

-- Let a user disconnect LinkedIn (deletes their token) without reading it.
create or replace function public.linkedin_disconnect()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.linkedin_connections where user_id = auth.uid();
$$;

revoke all on function public.linkedin_disconnect() from public, anon;
grant execute on function public.linkedin_disconnect() to authenticated;

-- share_log: one row per share action, visible only to its owner.
create table if not exists public.share_log (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  network    text not null check (char_length(network) between 1 and 32),
  app_id     text check (app_id is null or char_length(app_id) <= 64),
  post_urn   text,
  created_at timestamptz not null default now()
);

create index if not exists share_log_owner_created_idx
  on public.share_log (owner_id, created_at desc);

alter table public.share_log enable row level security;

drop policy if exists share_log_select_own on public.share_log;
create policy share_log_select_own on public.share_log
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists share_log_insert_own on public.share_log;
create policy share_log_insert_own on public.share_log
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists share_log_delete_own on public.share_log;
create policy share_log_delete_own on public.share_log
  for delete to authenticated using (owner_id = auth.uid());

revoke all on table public.share_log from anon;
grant select, insert, delete on table public.share_log to authenticated;
grant all on table public.share_log to service_role;
