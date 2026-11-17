// Registry-wide manifest test: lives with the hub because the hub builds its
// app grid from these files, but it iterates every apps/<folder>/aurelia.app.json
// and registry.external.json. scripts/check-manifests.mjs runs the same checks in CI.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  EVENT_CATALOG,
  LEGACY_STORAGE_KEYS,
  validateManifest,
  type AppManifest,
} from '../../../packages/core/src/manifest/index.ts'
import { checkRegistryOnDisk } from '../../../packages/core/src/manifest/node.ts'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const result = checkRegistryOnDisk(root)
const internal = result.entries.filter((e) => e.diskFolder !== undefined)

describe('aurelia.app.json registry', () => {
  it('has a manifest for each of the 8 app folders', () => {
    expect(internal.map((e) => e.diskFolder)).toHaveLength(8)
  })

  it('validates with no errors', () => {
    expect(result.errors).toEqual([])
  })

  it('has unique ids, folders and native ids', () => {
    const ms = result.manifests
    for (const field of ['id', 'folder', 'slug', 'nativeId'] as const) {
      const values = ms.map((m) => m[field]).filter(Boolean)
      expect(new Set(values).size, field).toBe(values.length)
    }
  })

  it('only warns about storage keys on the legacy allow-list', () => {
    for (const w of result.warnings) {
      const key = /storage key "([^"]+)"/.exec(w)?.[1]
      expect(key, w).toBeDefined()
      expect(Object.values(LEGACY_STORAGE_KEYS).flat()).toContain(key)
    }
  })

  it('every catalog event has at least one accepting app', () => {
    for (const event of Object.keys(EVENT_CATALOG)) {
      expect(result.manifests.some((m) => m.accepts.includes(event)), event).toBe(true)
    }
  })
})

describe.each(internal.map((e) => [e.diskFolder as string, e.manifest as AppManifest] as const))(
  'apps/%s/aurelia.app.json',
  (folder, manifest) => {
    it('validates on its own', () => {
      expect(validateManifest(manifest, folder).errors).toEqual([])
    })

    it('folder and slug match the directory', () => {
      expect(manifest.folder).toBe(folder)
      expect(`${manifest.id}-${manifest.slug}`).toBe(folder)
      expect(manifest.route).toBe(manifest.id === '00' ? '/' : `/apps/${folder}/`)
    })

    it('nativeId matches capacitor.config.ts appId', () => {
      const cap = readFileSync(join(root, 'apps', folder, 'capacitor.config.ts'), 'utf8')
      expect(/appId:\s*['"]([^'"]+)['"]/.exec(cap)?.[1]).toBe(manifest.nativeId)
    })

    it('icon exists under public/', () => {
      expect(existsSync(join(root, 'apps', folder, 'public', manifest.icon as string))).toBe(true)
    })

    it('emits and accepts only catalog events', () => {
      for (const e of [...(manifest.emits ?? []), ...(manifest.accepts ?? [])]) {
        expect(Object.keys(EVENT_CATALOG), e).toContain(e)
      }
    })

    it('storage keys use aurelia.<id>. or are on the legacy list', () => {
      const legacy = LEGACY_STORAGE_KEYS[manifest.id] ?? []
      for (const key of manifest.storageKeys ?? []) {
        if (!key.startsWith(`aurelia.${manifest.id}.`)) expect(legacy, key).toContain(key)
      }
    })
  },
)
