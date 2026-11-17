// Writes <out>/version.json so every app can check it runs the hub's build.
//
//   node scripts/write-version.mjs [--out site] [--build-id <id>]
//
// The same id must be baked into every app as VITE_AURELIA_BUILD_ID at build
// time (see resolveBuildId below); apps whose id differs show "Update available".
// Also importable: import { resolveBuildId, writeVersion } from './write-version.mjs'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

/** AURELIA_BUILD_ID env, else <git short sha>-<UTC yyyymmddhhmmss>, else a timestamp. */
export function resolveBuildId(env = process.env) {
  if (env.AURELIA_BUILD_ID) return env.AURELIA_BUILD_ID
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    if (sha) return `${sha}-${stamp}`
  } catch {
    /* not a git checkout */
  }
  return `build-${stamp}`
}

export function writeVersion({ out = join(root, 'site'), buildId = resolveBuildId() } = {}) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(buildId)) throw new Error(`invalid build id "${buildId}"`)
  mkdirSync(out, { recursive: true })
  const info = { buildId, builtAt: new Date().toISOString() }
  writeFileSync(join(out, 'version.json'), `${JSON.stringify(info, null, 2)}\n`)
  return info
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const arg = (name) => {
    const i = args.indexOf(name)
    return i === -1 ? undefined : args[i + 1]
  }
  const info = writeVersion({
    out: arg('--out') ? resolve(arg('--out')) : undefined,
    buildId: arg('--build-id') ?? undefined,
  })
  console.log(`version.json: ${info.buildId}`)
}
