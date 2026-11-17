/**
 * Aurelia app manifests (apps/<folder>/aurelia.app.json and the root
 * registry.external.json): types plus a hand-written validator that mirrors
 * packages/core/app.schema.json. No runtime dependencies, so it runs in the
 * browser, in vitest and in plain node (scripts/check-manifests.mjs).
 */
import { EVENT_CATALOG, isEventType } from './events-catalog.ts'

export * from './events-catalog.ts'

export const ACCENTS = ['cyan', 'violet', 'emerald', 'pink', 'gold'] as const
export type Accent = (typeof ACCENTS)[number]
export type AppStatus = 'active' | 'planned'
export type AppKind = 'internal' | 'external'

/** A manifest as written on disk (optional fields may be missing). */
export type AppManifest = {
  $schema?: string
  id: string
  slug: string
  folder: string
  name: string
  shortName?: string
  tagline: string
  version: string
  status: AppStatus
  kind?: AppKind
  url?: string
  icon?: string
  emoji?: string
  accent: Accent
  route?: string
  nativeId?: string
  emits?: string[]
  accepts?: string[]
  deepLinks?: string[]
  storageKeys?: string[]
  dependencies?: string[]
  notes?: string
}

/** A manifest with defaults applied. */
export type ResolvedManifest = Omit<
  AppManifest,
  'kind' | 'emits' | 'accepts' | 'deepLinks' | 'storageKeys' | 'dependencies' | 'shortName'
> & {
  kind: AppKind
  shortName: string
  /** Where a card links: route for internal apps, url for external ones. */
  href: string
  emits: string[]
  accepts: string[]
  deepLinks: string[]
  storageKeys: string[]
  dependencies: string[]
}

/**
 * Storage keys that predate the `aurelia.<id>.` rule. They produce warnings,
 * not errors, until the storage migration renames them; remove an entry here
 * once its app reads and writes the new key.
 */
export const LEGACY_STORAGE_KEYS: Readonly<Record<string, readonly string[]>> = {
  '00': ['aurelia_session'],
  '01': ['aurelia-timeline-items'],
  '02': ['aurelia-vault'],
  '05': ['glowgrid:creator', 'glowgrid:streak'],
  '07': ['affiliate-partners', 'affiliate-ledger', 'affiliate-pitches'],
}

export type ValidationResult = { errors: string[]; warnings: string[] }

const ALLOWED_KEYS = new Set([
  '$schema', 'id', 'slug', 'folder', 'name', 'shortName', 'tagline', 'version', 'status', 'kind',
  'url', 'icon', 'emoji', 'accent', 'route', 'nativeId', 'emits', 'accepts', 'deepLinks',
  'storageKeys', 'dependencies', 'notes',
])
const ID_RE = /^\d\d$/
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const FOLDER_RE = /^\d\d-[a-z0-9]+(-[a-z0-9]+)*$/
const VERSION_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
const ICON_RE = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*\.(png|svg|webp|ico)$/
const NATIVE_ID_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/
const EVENT_RE = /^[a-z]+\.[a-z_]+$/
const DEEP_LINK_RE = /^[^#\s]{2,}$/

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/**
 * Validate one manifest on its own (schema + per-manifest rules).
 * `where` prefixes every message, e.g. the file path.
 */
export function validateManifest(input: unknown, where = 'manifest'): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const err = (m: string) => errors.push(`${where}: ${m}`)
  const warn = (m: string) => warnings.push(`${where}: ${m}`)

  if (!isObject(input)) {
    err('must be a JSON object')
    return { errors, warnings }
  }
  const m = input

  for (const key of Object.keys(m)) if (!ALLOWED_KEYS.has(key)) err(`unknown field "${key}"`)

  const str = (key: string, re?: RegExp, required = true): string | undefined => {
    const v = m[key]
    if (v === undefined) {
      if (required) err(`"${key}" is required`)
      return undefined
    }
    if (!isNonEmptyString(v)) {
      err(`"${key}" must be a non-empty string`)
      return undefined
    }
    if (re && !re.test(v)) err(`"${key}" ${JSON.stringify(v)} does not match ${re}`)
    return v
  }
  const list = (key: string, itemRe?: RegExp): string[] => {
    const v = m[key]
    if (v === undefined) return []
    if (!Array.isArray(v)) {
      err(`"${key}" must be an array`)
      return []
    }
    const out: string[] = []
    v.forEach((item, i) => {
      if (!isNonEmptyString(item)) return err(`"${key}[${i}]" must be a non-empty string`)
      if (itemRe && !itemRe.test(item)) err(`"${key}[${i}]" ${JSON.stringify(item)} does not match ${itemRe}`)
      if (out.includes(item)) err(`"${key}" has duplicate ${JSON.stringify(item)}`)
      out.push(item)
    })
    return out
  }

  const id = str('id', ID_RE)
  const slug = str('slug', SLUG_RE)
  const folder = str('folder', FOLDER_RE)
  str('name')
  str('shortName', undefined, false)
  str('tagline')
  str('version', VERSION_RE)
  str('notes', undefined, false)
  str('$schema', undefined, false)
  const emoji = str('emoji', undefined, false)
  if (emoji && emoji.length > 16) err('"emoji" must be at most 16 characters')

  const status = m.status
  if (status === undefined) err('"status" is required')
  else if (status !== 'active' && status !== 'planned') err(`"status" must be "active" or "planned"`)

  const kind = m.kind ?? 'internal'
  if (kind !== 'internal' && kind !== 'external') err(`"kind" must be "internal" or "external"`)

  const accent = m.accent
  if (accent === undefined) err('"accent" is required')
  else if (!(ACCENTS as readonly unknown[]).includes(accent)) err(`"accent" must be one of ${ACCENTS.join(', ')}`)

  if (id && slug && folder && folder !== `${id}-${slug}`) {
    err(`"folder" must be "${id}-${slug}" (id-slug), got "${folder}"`)
  }

  if (kind === 'external') {
    const url = str('url')
    if (url && !/^https:\/\/[^\s/]+/.test(url)) err('"url" must be an https:// URL')
    if (m.route !== undefined) err('"route" is not allowed for external apps (use "url")')
    if (m.nativeId !== undefined) err('"nativeId" is not allowed for external apps')
    str('icon', ICON_RE, false)
    if (id && Number(id) < 50) warn('external apps should use ids 50-99 so they never clash with internal apps')
  } else {
    if (m.url !== undefined) err('"url" is only allowed for external apps')
    str('icon', ICON_RE)
    str('nativeId', NATIVE_ID_RE)
    const route = str('route')
    if (route && folder) {
      const expected = id === '00' ? '/' : `/apps/${folder}/`
      if (route !== expected) err(`"route" must be "${expected}", got "${route}"`)
    }
  }

  const emits = list('emits', EVENT_RE)
  const accepts = list('accepts', EVENT_RE)
  for (const e of emits) if (!isEventType(e)) err(`emits unknown event "${e}" (not in EVENT_CATALOG)`)
  for (const e of accepts) if (!isEventType(e)) err(`accepts unknown event "${e}" (not in EVENT_CATALOG)`)
  if (id) {
    for (const e of emits) {
      if (!isEventType(e)) continue
      const { from } = EVENT_CATALOG[e]
      if (from !== 'any' && !(from as readonly string[]).includes(id)) {
        err(`emits "${e}" but the catalog says it comes from ${from.join(', ')}`)
      }
    }
    for (const e of accepts) {
      if (!isEventType(e)) continue
      const { to } = EVENT_CATALOG[e]
      if (to !== 'all' && !(to as readonly string[]).includes(id)) {
        err(`accepts "${e}" but the catalog routes it to ${to.join(', ')}`)
      }
    }
  }

  list('deepLinks', DEEP_LINK_RE)

  const deps = list('dependencies', ID_RE)
  if (id && deps.includes(id)) err('"dependencies" must not include the app itself')

  const keys = list('storageKeys')
  if (id) {
    const legacy = LEGACY_STORAGE_KEYS[id] ?? []
    for (const key of keys) {
      if (key.startsWith(`aurelia.${id}.`) && key.length > `aurelia.${id}.`.length) continue
      const msg = `storage key "${key}" does not start with "aurelia.${id}."`
      if (legacy.includes(key)) warn(`${msg} (legacy, pending migration)`)
      else err(msg)
    }
  }

  return { errors, warnings }
}

/** Apply defaults. Call only on a manifest that validated. */
export function resolveManifest(m: AppManifest): ResolvedManifest {
  const kind = m.kind ?? 'internal'
  return {
    ...m,
    kind,
    shortName: m.shortName ?? m.name,
    href: kind === 'external' ? (m.url as string) : (m.route as string),
    emits: m.emits ?? [],
    accepts: m.accepts ?? [],
    deepLinks: m.deepLinks ?? [],
    storageKeys: m.storageKeys ?? [],
    dependencies: m.dependencies ?? [],
  }
}

export type RegistryEntry = { manifest: unknown; where: string }

/**
 * Validate a whole registry: each manifest, then the cross-manifest rules
 * (unique ids/folders/slugs/nativeIds, dependencies resolve, every catalog
 * route is declared by the apps it names, deep-link prefixes are unique).
 * `diskFolder` gives the on-disk folder for internal manifests so it can be
 * compared with the manifest's own "folder" field.
 */
export function validateRegistry(
  entries: readonly (RegistryEntry & { diskFolder?: string })[],
): ValidationResult & { manifests: ResolvedManifest[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const valid: { m: ResolvedManifest; where: string }[] = []

  for (const { manifest, where, diskFolder } of entries) {
    const r = validateManifest(manifest, where)
    errors.push(...r.errors)
    warnings.push(...r.warnings)
    if (r.errors.length === 0) {
      const m = resolveManifest(manifest as AppManifest)
      if (diskFolder !== undefined && m.folder !== diskFolder) {
        errors.push(`${where}: "folder" is "${m.folder}" but the file lives in apps/${diskFolder}/`)
      }
      if (diskFolder !== undefined && m.kind === 'external') {
        errors.push(`${where}: apps/ folders hold internal apps; list external sites in registry.external.json`)
      }
      valid.push({ m, where })
    }
  }

  const seen = (field: 'id' | 'folder' | 'slug' | 'nativeId') => {
    const byValue = new Map<string, string>()
    for (const { m, where } of valid) {
      const v = m[field]
      if (v === undefined) continue
      const prev = byValue.get(v)
      if (prev) errors.push(`${where}: duplicate ${field} "${v}" (also in ${prev})`)
      else byValue.set(v, where)
    }
  }
  seen('id')
  seen('folder')
  seen('slug')
  seen('nativeId')

  const ids = new Set(valid.map(({ m }) => m.id))
  for (const { m, where } of valid) {
    for (const dep of m.dependencies) {
      if (!ids.has(dep)) errors.push(`${where}: dependency "${dep}" is not a known app id`)
    }
  }

  const internal = valid.filter(({ m }) => m.kind === 'internal')
  const byId = new Map(internal.map(({ m }) => [m.id, m]))
  for (const [event, route] of Object.entries(EVENT_CATALOG)) {
    if (route.from !== 'any') {
      for (const from of route.from) {
        const app = byId.get(from)
        if (app && !app.emits.includes(event)) errors.push(`app ${from}: catalog says it emits "${event}" but its manifest does not list it`)
      }
    }
    const targets = route.to === 'all' ? [...byId.keys()].filter((id) => !(route.from as readonly string[]).includes(id)) : route.to
    for (const to of targets) {
      const app = byId.get(to)
      if (app && !app.accepts.includes(event)) errors.push(`app ${to}: catalog routes "${event}" to it but its manifest does not accept it`)
    }
  }

  const prefixOwner = new Map<string, string>()
  for (const { m } of internal) {
    if (m.id === '00') continue // the hub forwards other apps' deep links
    for (const p of m.deepLinks) {
      const prev = prefixOwner.get(p)
      if (prev) errors.push(`apps ${prev} and ${m.id} both claim deep link "#${p}"`)
      else prefixOwner.set(p, m.id)
    }
  }

  return { errors, warnings, manifests: valid.map(({ m }) => m) }
}
