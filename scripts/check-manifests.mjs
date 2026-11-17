// Validates every apps/<folder>/aurelia.app.json and registry.external.json
// against packages/core/app.schema.json rules and the event catalog.
// Exits 1 on any error; legacy storage keys are printed as warnings.
// Runs the TypeScript validator directly (Node >= 22.18 strips types natively).
import { fileURLToPath } from 'node:url'
import { checkRegistryOnDisk } from '../packages/core/src/manifest/node.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const { errors, warnings, manifests } = checkRegistryOnDisk(root)

for (const w of warnings) console.warn(`warn  ${w}`)
for (const e of errors) console.error(`error ${e}`)

const internal = manifests.filter((m) => m.kind === 'internal').length
const external = manifests.length - internal
if (errors.length > 0) {
  console.error(`\ncheck:manifests failed: ${errors.length} error(s), ${warnings.length} warning(s)`)
  process.exit(1)
}
console.log(`check:manifests ok: ${internal} internal + ${external} external manifest(s), ${warnings.length} warning(s)`)
