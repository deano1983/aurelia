/** One card in the hub, derived from an aurelia.app.json manifest (see data.ts). */
export type AppModule = {
  /** Two-digit manifest id, e.g. "04". */
  id: string
  folder: string
  name: string
  shortName: string
  tagline: string
  /** Where the card links: /apps/<folder>/ (hub: /), or the https url of an external site. */
  route: string
  /** Glyph shown on the card (manifest "emoji"). */
  icon: string
  /** Same-origin URL of the manifest icon image, internal apps only. */
  iconPath?: string
  /** Tailwind classes for the card, from the manifest accent. */
  color: string
  accent: 'cyan' | 'violet' | 'emerald' | 'pink' | 'gold'
  status: 'active' | 'planned'
  kind: 'internal' | 'external'
  nativeId?: string
  /** Ids of related apps. */
  dependencies: string[]
}

export type UserSession = {
  name: string
  role: string
  avatar: string
  passphrase: string | null
  isAuthenticated: boolean
}

export type DeepLinkHandlerProps = {
  target: string
  onBack: () => void
}