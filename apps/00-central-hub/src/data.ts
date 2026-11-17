// The hub's app registry, built at build time from every
// apps/<folder>/aurelia.app.json plus the root registry.external.json.
// To add or change an app, edit its manifest; nothing here is hand-listed.
import {
  validateManifest,
  resolveManifest,
  type Accent,
  type AppManifest,
  type ResolvedManifest,
} from '../../../packages/core/src/manifest/index.ts'
import externalRegistry from '../../../registry.external.json'
import type { AppModule } from './types'

const manifestFiles = import.meta.glob<AppManifest>('../../*/aurelia.app.json', {
  eager: true,
  import: 'default',
})

// Literal class strings so Tailwind's content scan keeps them.
export const ACCENT_CLASSES: Record<Accent, string> = {
  cyan: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  violet: 'bg-violet-50 text-violet-800 border-violet-200',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  pink: 'bg-pink-50 text-pink-800 border-pink-200',
  gold: 'bg-amber-50 text-amber-800 border-amber-200',
}

function load(entries: [string, unknown][]): ResolvedManifest[] {
  const out: ResolvedManifest[] = []
  for (const [where, manifest] of entries) {
    const { errors } = validateManifest(manifest, where)
    if (errors.length) {
      // CI (npm run check:manifests) blocks this; never break the hub over it.
      console.warn(`[aurelia] skipping invalid manifest`, errors)
      continue
    }
    out.push(resolveManifest(manifest as AppManifest))
  }
  return out
}

/** Every manifest, hub included, internal apps first then external, by id. */
export const MANIFESTS: ResolvedManifest[] = [
  ...load(Object.entries(manifestFiles)).filter((m) => m.kind === 'internal'),
  ...load((externalRegistry as unknown[]).map((m, i) => [`registry.external.json[${i}]`, m])).filter(
    (m) => m.kind === 'external',
  ),
].sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'internal' ? -1 : 1))

export function toAppModule(m: ResolvedManifest): AppModule {
  return {
    id: m.id,
    folder: m.folder,
    name: m.name,
    shortName: m.shortName,
    tagline: m.tagline,
    route: m.href,
    icon: m.emoji ?? m.name.slice(0, 1),
    iconPath: m.icon && m.kind === 'internal' ? `${m.route}${m.icon}` : undefined,
    color: ACCENT_CLASSES[m.accent],
    accent: m.accent,
    status: m.status,
    kind: m.kind,
    nativeId: m.nativeId,
    dependencies: m.dependencies,
  }
}

/** The hub itself (id 00). */
export const HUB: AppModule | undefined = MANIFESTS.filter((m) => m.id === '00').map(toAppModule)[0]

/** Cards on the hub grid: the seven internal apps, then any external sites. */
export const APPS: AppModule[] = MANIFESTS.filter((m) => m.id !== '00').map(toAppModule)

export const EXTERNAL_APPS: AppModule[] = APPS.filter((a) => a.kind === 'external')
