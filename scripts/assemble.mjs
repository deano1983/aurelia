// Builds all eight apps for one web origin and assembles them into ./site:
//   site/            -> 00-central-hub
//   site/apps/<app>/ -> each of the seven apps (built with base /apps/<app>/)
import { execSync } from 'node:child_process'
import { cpSync, readdirSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const appsDir = join(root, 'apps')
const out = join(root, 'site')
const apps = readdirSync(appsDir).filter((d) => /^\d\d-/.test(d)).sort()

rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'apps'), { recursive: true })

for (const app of apps) {
  const dir = join(appsDir, app)
  console.log(`\n== building ${app}`)
  execSync('npm run build', { cwd: dir, stdio: 'inherit', env: { ...process.env, AURELIA_ASSEMBLE: '1' } })
  const target = app.startsWith('00-') ? out : join(out, 'apps', app)
  cpSync(join(dir, 'dist'), target, { recursive: true })
}
console.log(`\nAssembled ${apps.length} apps into ${out}`)
