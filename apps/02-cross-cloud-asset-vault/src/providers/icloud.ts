import { oauthRedirectUri } from './redirect'
import type { CloudProviderConfig, OAuthTokens } from './index'

export const ICLOUD: CloudProviderConfig = {
  id: 'icloud',
  name: 'Apple iCloud',
  platform: 'iOS / macOS',
  authorizeUrl: 'https://appleid.apple.com/auth/authorize',
  tokenUrl: 'https://appleid.apple.com/auth/token',
  scopes: ['name', 'email'],
  clientId: 'REPLACE_WITH_ICLOUD_CLIENT_ID',
  get redirectUri() {
    return oauthRedirectUri()
  },
}

export async function icloudAuthorizeUrl(
  state: string,
  codeChallenge: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: ICLOUD.clientId,
    response_type: 'code',
    redirect_uri: ICLOUD.redirectUri,
    scope: ICLOUD.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${ICLOUD.authorizeUrl}?${params.toString()}`
}

export async function icloudExchangeCodeStub(): Promise<OAuthTokens> {
  // CLIENT-SIDE STUB: Apple's token endpoint is not CORS-open to SPAs, so a
  // real authorization-code exchange is handled by a backend. Replace this
  // stub with your configured server-side exchange when credentials exist.
  return {
    accessToken: `stub_icloud_${crypto.randomUUID()}`,
    tokenType: 'Bearer',
    expiresIn: 3600,
  }
}
