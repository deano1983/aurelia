// Builds all eight apps for one web origin and assembles them into ./site:
//   site/            -> 00-central-hub
//   site/apps/<app>/ -> each of the seven apps (built with base /apps/<app>/)
import { execSync } from 'node:child_process'
import { cpSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveBuildId, writeVersion } from './write-version.mjs'

const root = new URL('..', import.meta.url).pathname
const appsDir = join(root, 'apps')
const out = join(root, 'site')
const buildId = resolveBuildId()
const apps = readdirSync(appsDir).filter((d) => /^\d\d-/.test(d)).sort()

rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'apps'), { recursive: true })

for (const app of apps) {
  const dir = join(appsDir, app)
  console.log(`\n== building ${app}`)
  execSync('npm run build', { cwd: dir, stdio: 'inherit', env: { ...process.env, AURELIA_ASSEMBLE: '1', VITE_AURELIA_BUILD_ID: buildId } })
  const target = app.startsWith('00-') ? out : join(out, 'apps', app)
  cpSync(join(dir, 'dist'), target, { recursive: true })
}
writeVersion({ out, buildId })

// Security headers for the single origin. `_headers` is read by Netlify and
// Cloudflare Pages; other hosts must send the same values (see README).
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.googleapis.com https://oauth2.googleapis.com https://graph.microsoft.com https://login.microsoftonline.com",
  "form-action 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
].join('; ')
writeFileSync(join(out, '_headers'), `/*
  Content-Security-Policy: ${csp}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), geolocation=(), microphone=(self)
  Strict-Transport-Security: max-age=31536000; includeSubDomains
`)

console.log(`\nAssembled ${apps.length} apps into ${out}`)
