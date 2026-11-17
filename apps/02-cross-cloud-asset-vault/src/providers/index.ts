import type { CloudProvider } from '../types'

export type CloudProviderConfig = {
  id: CloudProvider
  name: string
  platform: string
  authorizeUrl: string
  tokenUrl: string
  scopes: string[]
  clientId: string
  redirectUri: string
}

export type OAuthTokens = {
  accessToken: string
  tokenType: string
  expiresIn: number
}

// RFC 7636: 32 random bytes, base64url-encoded (43 characters, unbiased).
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A fresh random OAuth `state` for each sign-in attempt. */
export function generateOAuthState(): string {
  return generateCodeVerifier()
}

export async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  const hash = String.fromCharCode(...new Uint8Array(digest))
  return btoa(hash).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Client-side PKCE: code_challenge = BASE64URL(SHA256(code_verifier)).
// The verifier is held by the caller (in memory only) and presented at
// token-exchange time; no backend is involved in this stub flow.
export async function pkcePair(): Promise<{
  codeVerifier: string
  codeChallenge: string
}> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await sha256Base64Url(codeVerifier)
  return { codeVerifier, codeChallenge }
}

export {
  ICLOUD,
  icloudAuthorizeUrl,
  icloudExchangeCodeStub,
} from './icloud'
export {
  ONEDRIVE,
  onedriveAuthorizeUrl,
  onedriveExchangeCodeStub,
} from './onedrive'
export {
  GOOGLEDRIVE,
  googledriveAuthorizeUrl,
  googledriveExchangeCodeStub,
} from './googledrive'
