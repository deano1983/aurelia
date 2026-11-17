/**
 * Node-only helpers: read every apps/<folder>/aurelia.app.json plus the root
 * registry.external.json from disk and validate them together. Shared by
 * scripts/check-manifests.mjs (CI) and the vitest manifest tests.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateRegistry, type ResolvedManifest, type ValidationResult } from './index.ts'

export type DiskEntry = { manifest: unknown; where: string; diskFolder?: string }

const APP_FOLDER_RE = /^\d\d-/

function readJson(path: string, where: string, errors: string[]): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    errors.push(`${where}: cannot parse JSON (${(e as Error).message})`)
    return undefined
  }
}

/** Read manifests from a repo root without validating them. */
export function readRegistryFromDisk(root: string): { entries: DiskEntry[]; errors: string[] } {
  const errors: string[] = []
  const entries: DiskEntry[] = []
  const appsDir = join(root, 'apps')
  for (const folder of readdirSync(appsDir).filter((d) => APP_FOLDER_RE.test(d)).sort()) {
    const where = `apps/${folder}/aurelia.app.json`
    const path = join(appsDir, folder, 'aurelia.app.json')
    if (!existsSync(path)) {
      errors.push(`${where}: missing`)
      continue
    }
    const manifest = readJson(path, where, errors)
    if (manifest !== undefined) entries.push({ manifest, where, diskFolder: folder })
  }

  const externalPath = join(root, 'registry.external.json')
  if (existsSync(externalPath)) {
    const list = readJson(externalPath, 'registry.external.json', errors)
    if (list !== undefined && !Array.isArray(list)) {
      errors.push('registry.external.json: must be a JSON array of manifests')
    } else if (Array.isArray(list)) {
      list.forEach((manifest, i) => {
        const where = `registry.external.json[${i}]`
        const kind = (manifest as { kind?: unknown } | null)?.kind
        if (kind !== 'external') errors.push(`${where}: "kind" must be "external"`)
        entries.push({ manifest, where })
      })
    }
  }
  return { entries, errors }
}

/** Read and validate everything; errors include read/parse problems. */
export function checkRegistryOnDisk(root: string): ValidationResult & { manifests: ResolvedManifest[]; entries: DiskEntry[] } {
  const { entries, errors: readErrors } = readRegistryFromDisk(root)
  const result = validateRegistry(entries)
  return { ...result, errors: [...readErrors, ...result.errors], entries }
}
