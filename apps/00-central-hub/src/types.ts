export type AppModule = {
  id: string
  name: string
  tagline: string
  route: string
  icon: string
  color: string
  status: 'active' | 'planned'
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