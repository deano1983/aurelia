# Supabase setup for Aurelia OS

Project: `https://dhyfiudikillxfqeqqrp.supabase.co`

The apps talk to Supabase only through the shared client in
`packages/core/src/auth` (one session for all eight apps, stored in
`localStorage["aurelia.auth"]` because they share one origin).

## 1. Environment

Copy `.env.example` (repo root) to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://dhyfiudikillxfqeqqrp.supabase.co
VITE_SUPABASE_ANON_KEY=<Project Settings > API > publishable / anon key>
```

Both values are public by design; never put the `service_role` key here.
Every app's `vite.config.ts` sets `envDir: '../..'`, so the one root file is
used by all eight builds. In CI, set the same two variables in the
environment. If they are missing the build still succeeds and every app shows
a "Supabase not configured" panel instead of sign-in.

## 2. Apply the migrations

Migrations live in `supabase/migrations/` and are applied in filename order.
Each one is idempotent.

**Option A: SQL editor (no tooling)**
1. Dashboard > SQL Editor > New query.
2. Paste the contents of `migrations/0001_profiles.sql` and click Run.

**Option B: Supabase CLI**
```
supabase login
supabase link --project-ref dhyfiudikillxfqeqqrp
supabase db push
```

`0001_profiles.sql` creates:
- `public.profiles` (`id`, `display_name`, `role`, `room_salt`, `created_at`) with
  RLS: a user can read and update only their own row, and only `display_name`
  and `role` are writable. `room_salt` is a random 16-byte value (base64) used
  as the PBKDF2 salt for the room key; it is not secret and cannot be changed
  from the client.
- trigger `on_auth_user_created` on `auth.users` that inserts the profile on
  sign-up (name from Google `full_name`, otherwise the email's local part), plus
  a backfill for users that already exist.
- empty schemas `app_01` ... `app_07`, with `usage` granted to `authenticated` only.

## 3. Convention for app tables

Each app keeps its tables in its own schema (`app_0N`). Every table has an
owner column and an owner-only RLS policy:

```sql
create table app_0N.things (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
  -- ...
);
alter table app_0N.things enable row level security;
create policy "owner" on app_0N.things for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
```

Name later migrations `0002_app_0N_<what>.sql`. Anything sensitive is
encrypted in the browser with the room key before it is inserted. To query an
app schema from the client, add it under **Settings > API > Exposed schemas**,
then use `supabase.schema('app_0N').from('things')`.

## 4. Dashboard settings (Authentication)

**URL Configuration**
- Site URL: the production web origin, e.g. `https://<your-domain>/`.
- Redirect URLs, add all of:
  - the production web origin, e.g. `https://<your-domain>/**`
  - `http://localhost:5173/**` (hub dev server)
  - `com.aurelia.os.centralhub://auth-callback` (native hub app)

**Providers**
- Email: enabled (magic link). The template's link must keep `{{ .ConfirmationURL }}`.
- Google: enable it, and paste the OAuth client ID and secret from Google Cloud
  Console. In Google Cloud, the authorized redirect URI is
  `https://dhyfiudikillxfqeqqrp.supabase.co/auth/v1/callback`.

Sign-in uses the PKCE flow: the magic link must be opened in the same browser
that asked for it. The room passphrase is never sent to Supabase or stored;
only the per-user salt is.
