import { APP_FOLDERS, isAppId, type AppId } from './catalog'

/**
 * Cross-device deep links: `<origin>/apps/<folder>/#<kind>?<query>`.
 * Everything app-specific rides in the fragment, so it never reaches a server
 * log, and the link works when pasted into email/WhatsApp on another device.
 *
 * Legacy formats still parse:
 *   #ctl=<packet>            -> 04 CTL Relay   (kind 'ctl',   params.packet)
 *   #vault=<packet>          -> 02 Asset Vault (kind 'vault', params.packet)
 *   #?title=&category=&tags= -> 01 Timeline    (kind 'timeline/add')
 */

export type DeepLinkParamValue = string | number | boolean | readonly string[] | null | undefined
export type DeepLinkParams = Record<string, DeepLinkParamValue>

export interface ParsedDeepLink {
  /** e.g. 'timeline/add', 'affiliate/inbox', 'ctl', 'vault'. */
  kind: string
  /** First value of every param. */
  params: Record<string, string>
  /** Every value of every param (repeated keys such as tags). */
  all: Record<string, string[]>
  /** Folder in the URL path (/apps/<folder>/), or null on the hub / no path. */
  folder: string | null
  /** App the link is meant for, from the path or else from the kind. */
  target: AppId | null
  legacy: 'ctl' | 'vault' | 'timeline-query' | null
}

const KIND_RE = /^[a-z][a-z0-9-]*(\/[a-z0-9-]+)*$/

/** First kind segment -> app that handles it. */
export const KIND_PREFIX_TARGETS: Record<string, AppId> = {
  hub: '00',
  timeline: '01',
  vault: '02',
  voice: '03',
  ctl: '04',
  chat: '04',
  glowgrid: '05',
  invoice: '06',
  affiliate: '07',
}

export function folderOf(appId: AppId): string {
  return APP_FOLDERS[appId]
}

export function appIdOfFolder(folder: string): AppId | null {
  const m = /^(\d\d)-/.exec(folder)
  if (!m || !isAppId(m[1])) return null
  return APP_FOLDERS[m[1]] === folder ? m[1] : null
}

export function targetOfKind(kind: string): AppId | null {
  return KIND_PREFIX_TARGETS[kind.split('/')[0]] ?? null
}

function currentOrigin(): string {
  try {
    const o = globalThis.location?.origin
    return o && o !== 'null' ? o : ''
  } catch {
    return ''
  }
}

/** Path of an app on the shared origin: '/' for the hub, '/apps/<folder>/' otherwise. */
export function appPath(target: AppId | string): string {
  const folder = isAppId(target) ? APP_FOLDERS[target] : target
  if (!appIdOfFolder(folder)) throw new Error(`unknown app folder "${folder}"`)
  return folder === APP_FOLDERS['00'] ? '/' : `/apps/${folder}/`
}

/** Fragment only: '#<kind>?<query>'. */
export function buildDeepLinkHash(kind: string, params: DeepLinkParams = {}): string {
  if (!KIND_RE.test(kind)) throw new Error(`invalid deep link kind "${kind}"`)
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)))
    else search.set(key, String(value))
  }
  const q = search.toString()
  return q ? `#${kind}?${q}` : `#${kind}`
}

/**
 * Absolute link to `targetAppFolder` (folder name or two-digit id) that opens `kind`.
 * Pass origin '' for a same-origin relative link.
 */
export function buildDeepLink(
  targetAppFolder: string,
  kind: string,
  params: DeepLinkParams = {},
  opts: { origin?: string } = {},
): string {
  const origin = opts.origin ?? currentOrigin()
  return `${origin}${appPath(targetAppFolder)}${buildDeepLinkHash(kind, params)}`
}

function folderFromPath(pathname: string): string | null {
  const m = /\/apps\/(\d\d-[a-z0-9-]+)\/?/.exec(pathname)
  return m && appIdOfFolder(m[1]) ? m[1] : null
}

function collect(search: URLSearchParams): Pick<ParsedDeepLink, 'params' | 'all'> {
  const params: Record<string, string> = {}
  const all: Record<string, string[]> = {}
  search.forEach((value, key) => {
    if (!(key in params)) params[key] = value
    ;(all[key] ??= []).push(value)
  })
  return { params, all }
}

/**
 * Parse a deep link from a full URL, a '#fragment', or (default) the current location.
 * Returns null when there is no recognisable deep link.
 */
export function parseDeepLink(input?: string): ParsedDeepLink | null {
  let hash = ''
  let pathname = ''
  try {
    if (input === undefined) {
      hash = globalThis.location?.hash ?? ''
      pathname = globalThis.location?.pathname ?? ''
    } else if (input.startsWith('#')) {
      hash = input
    } else {
      const url = new URL(input, 'http://aurelia.invalid')
      hash = url.hash
      pathname = url.pathname
    }
  } catch {
    return null
  }
  if (!hash || hash === '#') return null
  const body = hash.slice(1)
  const folder = folderFromPath(pathname)
  const pathTarget = folder ? appIdOfFolder(folder) : null

  // Legacy encrypted packets: #ctl=<packet> / #vault=<packet>
  const legacy = /^(ctl|vault)=([^&]*)/.exec(body)
  if (legacy) {
    const kind = legacy[1] as 'ctl' | 'vault'
    return {
      kind,
      params: { packet: legacy[2] },
      all: { packet: [legacy[2]] },
      folder,
      target: pathTarget ?? targetOfKind(kind),
      legacy: kind,
    }
  }

  const q = body.indexOf('?')
  const kindPart = q === -1 ? body : body.slice(0, q)
  const query = q === -1 ? '' : body.slice(q + 1)
  const { params, all } = collect(new URLSearchParams(query))

  // Legacy 01 format: #?title=&category=&tags=
  if (kindPart === '') {
    if (!params.title) return null
    return { kind: 'timeline/add', params, all, folder, target: pathTarget ?? '01', legacy: 'timeline-query' }
  }
  if (!KIND_RE.test(kindPart)) return null
  return { kind: kindPart, params, all, folder, target: pathTarget ?? targetOfKind(kindPart), legacy: null }
}

/**
 * For a deep link that landed on the hub: the same-origin app URL to send it to
 * (fragment preserved verbatim), or null when it is not for another app.
 * Only known /apps/<folder>/ paths are ever returned, so this cannot open-redirect.
 */
export function resolveHubDeepLink(hash: string): string | null {
  const parsed = parseDeepLink(hash.startsWith('#') ? hash : `#${hash}`)
  if (!parsed || !parsed.target || parsed.target === '00') return null
  return `${appPath(parsed.target)}${hash.startsWith('#') ? hash : `#${hash}`}`
}
