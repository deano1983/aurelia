# Sharing and posting to social networks

Aurelia apps share content in three ways. The first two work today with no
setup. The third, direct posting to LinkedIn, needs a one-time setup by DC.

| Way | Works without setup | Where it shows |
|---|---|---|
| Intent links: open the network's composer with the text filled in | Yes | Share sheet, every network listed below |
| Native share: the phone's or browser's system share sheet | Yes, where the device supports it | "Share via this device…" in the share sheet |
| Post directly to LinkedIn from the app | No, see [Direct LinkedIn posting](#direct-linkedin-posting-setup) | "Post directly to LinkedIn" in the share sheet |

The share sheet appears on:

- **03 Voice Authority Studio**: "Share / Post" on each generated draft card.
- **05 GlowGrid Creator Radar**: "Share / Post" next to Print in the media kit export (shares a text summary of the kit).
- **07 Distribution & Affiliate Engine**: "Share / Post pitch" under the pitch template preview.

Code: `packages/core/src/share` (import from `@aurelia/core/share`).

## What works with zero setup

### Intent links

`buildShareTargets(post)` returns one link per network. Opening it shows the
network's own composer with the text ready; the user presses Post there.
No API keys and no developer accounts are involved.

| Network | Link | Notes |
|---|---|---|
| LinkedIn | `linkedin.com/feed/?shareActive=true&text=…` | Text and link in the composer. Limit 3,000. |
| LinkedIn (link card) | `linkedin.com/sharing/share-offsite/?url=…` | Only when a URL is shared; LinkedIn ignores text here. |
| X | `x.com/intent/post?text=…&url=…` | Limit 280; every link counts as 23. |
| Facebook | `facebook.com/sharer/sharer.php?u=…` | Facebook accepts a link only, so the text is copied for pasting. |
| Threads | `threads.net/intent/post?text=…` | Limit 500. |
| WhatsApp | `wa.me/?text=…` | |
| Telegram | `t.me/share/url?url=…&text=…` | |
| Reddit | `reddit.com/submit?…` | Link post when there is a URL, text post otherwise. Title limit 300. |
| Bluesky | `bsky.app/intent/compose?text=…` | Limit 300. |
| Email | `mailto:?subject=…&body=…` | |
| SMS | `sms:?&body=…` | Works on iOS and Android. |

Text that is too long for a network is cut at a word boundary with "…"
(`fitForNetwork`), and the share sheet says so in amber next to that network.
Links are never cut. Each row has a preview of exactly what will be sent.

**Instagram and TikTok** have no web share link at all. Their buttons copy
the caption to the clipboard and tell the user to open the app and paste.

### Native share

`nativeShare(post)` uses, in order: Capacitor's Share plugin when the app runs
as a native build and the plugin is installed (Aurelia does not add the plugin;
add `@capacitor/share` to an app if you want it there), then the browser's
Web Share API (most phones, Safari, Edge), and otherwise falls back to the
intent links above.

## Direct LinkedIn posting: setup

Direct posting publishes to the user's own LinkedIn feed from inside the app,
as that user. It needs a LinkedIn developer app and two Supabase edge
functions. Until this is done, the share sheet shows "Direct posting needs
Supabase sign-in" or "not enabled on this server yet", and everything else
keeps working.

### 1. Create the LinkedIn app

1. Go to <https://www.linkedin.com/developers/apps> and choose **Create app**.
   It must be linked to a LinkedIn Company Page (create one for Aurelia if
   needed; a page admin must verify the app).
2. On the **Products** tab, request both:
   - **Sign In with LinkedIn using OpenID Connect** (gives `openid`, `profile`)
   - **Share on LinkedIn** (gives `w_member_social`)
   Both are self-serve and are normally approved immediately.
3. On the **Auth** tab, under **Authorized redirect URLs for your app**, add exactly:

   ```
   https://dhyfiudikillxfqeqqrp.supabase.co/functions/v1/linkedin-auth/callback
   ```

4. From the **Auth** tab, copy the **Client ID** and **Primary Client Secret**.

### 2. Apply the database migration

`supabase/migrations/0003_linkedin.sql` creates:

- `linkedin_connections`: one row per user with the LinkedIn member id, access
  token and expiry. RLS is on with no client policies and table privileges are
  revoked from `anon` and `authenticated`, so no app can ever read a token.
  Only the edge functions (service role) touch it.
- `linkedin_status()`: RPC that returns `connected` and `expires_at` for the
  signed-in user, and nothing else.
- `linkedin_disconnect()`: RPC that deletes the signed-in user's connection.
- `share_log`: one row per share (`network`, `app_id`, optional `post_urn`),
  readable and writable only by its owner.

```sh
supabase link --project-ref dhyfiudikillxfqeqqrp
supabase db push
```

### 3. Set the function secrets

```sh
supabase secrets set \
  LINKEDIN_CLIENT_ID=<client id> \
  LINKEDIN_CLIENT_SECRET=<primary client secret> \
  LINKEDIN_REDIRECT_URI=https://dhyfiudikillxfqeqqrp.supabase.co/functions/v1/linkedin-auth/callback \
  STATE_SECRET=$(openssl rand -base64 48) \
  APP_ORIGINS=https://<where the apps are hosted>,http://localhost:5177
```

- `STATE_SECRET` signs the OAuth `state` (HMAC-SHA-256). At least 32 characters.
  Changing it only cancels sign-ins that are in progress.
- `APP_ORIGINS` is a comma-separated list of origins the apps are served from
  (scheme + host + port, no path). The flow refuses to start from, or return
  to, any other origin. Add `capacitor://localhost` and `https://localhost`
  for the native builds.
  `linkedin-post` uses the same list for CORS: browsers on any other origin
  are refused.
- `LINKEDIN_DAILY_POST_LIMIT` (optional, default 25) caps posts per user per
  24 hours through `linkedin-post`, counted from `share_log`.
- `LINKEDIN_VERSION` (optional) overrides the `LinkedIn-Version` header,
  default `202411`. LinkedIn retires each monthly version after about a year;
  when posting starts failing with a version error, set a recent `YYYYMM`.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
  provided to edge functions by Supabase automatically. Never put the service
  role key in an app or a `VITE_` variable.

### 4. Deploy the functions

```sh
supabase functions deploy linkedin-auth --no-verify-jwt
supabase functions deploy linkedin-post
```

(`supabase functions deploy linkedin-auth linkedin-post` deploys both in one
go, but `linkedin-auth` must have JWT verification off: LinkedIn's redirect to
`/callback` carries no Supabase token. The function checks the user itself.
Alternatively set `[functions.linkedin-auth] verify_jwt = false` in
`supabase/config.toml`.)

### 5. Apps need Supabase sign-in

The share sheet reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see
`.env.example`), or uses a client passed in as the `supabase` prop. The user
must be signed in to Aurelia; then the sheet shows **Connect LinkedIn**, and
after that **Post now** with a visibility choice (Anyone / Connections only).

### How the flow works

1. **Connect LinkedIn** copies the draft to the clipboard (the page is about to
   navigate away), then submits a hidden form (top-level POST, so the user's
   Supabase JWT is never in a URL) to `linkedin-auth/start`.
2. `start` checks the `Origin` against `APP_ORIGINS`, verifies the JWT, signs a
   `state` holding the user id, return URL, 10-minute expiry and a random
   nonce, sets the nonce as an `HttpOnly; Secure; SameSite=Lax` cookie, and
   redirects to LinkedIn with scopes `openid profile w_member_social`.
3. LinkedIn redirects to `linkedin-auth/callback`. The function verifies the
   `state` signature and expiry and that the cookie nonce matches (so a consent
   started in one browser cannot be completed in another), exchanges the code
   at `https://www.linkedin.com/oauth/v2/accessToken`, reads the member id
   (`sub`) from `https://api.linkedin.com/v2/userinfo`, stores token + expiry,
   and redirects back to the app with `?linkedin=connected` (or
   `?linkedin=error&linkedin_reason=…`).
4. **Post now** calls `linkedin-post` with the user's JWT. The function loads
   the token server-side and calls `POST https://api.linkedin.com/rest/posts`
   with `LinkedIn-Version` and `X-Restli-Protocol-Version: 2.0.0`, author
   `urn:li:person:<sub>`, the text as `commentary` (LinkedIn's reserved
   characters such as `(`, `#`, `@` are escaped so the post is not cut short),
   `lifecycleState: PUBLISHED` and `feedDistribution: MAIN_FEED`. It returns
   the post URN and URL and records it in `share_log`.
   - Expired or revoked token: `401 token_expired`; the sheet switches back to
     **Connect LinkedIn**.
   - LinkedIn rate limit: `429 rate_limited` with `retryAfter` when LinkedIn
     sends one.

LinkedIn member tokens last 60 days. The `Share on LinkedIn` product does not
issue refresh tokens, so users reconnect when a token expires.

## Direct posting to other networks

Not in v1. Posting directly (rather than through the composer link) to X,
Facebook, Instagram or TikTok needs each company's own developer approval:

- **X**: a paid API tier for write access.
- **Facebook and Instagram**: a Meta app with App Review for publishing
  permissions; Instagram publishing also needs a Business or Creator account
  linked to a Facebook Page.
- **TikTok**: the Content Posting API, which requires an app audit before
  posts can be public.

The intent links and native share above are the v1 for these networks.
