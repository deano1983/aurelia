// OAuth redirect back to this app on whatever origin serves it (https in
// production), instead of a hard-coded http://localhost (pentest F-09).
export function oauthRedirectUri(): string {
  const base = import.meta.env?.BASE_URL ?? '/'
  const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost:5176'
  return new URL('oauth/callback', origin + base).href
}
