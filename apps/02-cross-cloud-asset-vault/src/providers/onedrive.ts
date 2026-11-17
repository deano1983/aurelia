import { oauthRedirectUri } from './redirect'
import type { CloudProviderConfig, OAuthTokens } from './index'

export const ONEDRIVE: CloudProviderConfig = {
  id: 'onedrive',
  name: 'Microsoft OneDrive',
  platform: 'Windows',
  authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: ['Files.ReadWrite.All', 'offline_access'],
  clientId: 'REPLACE_WITH_ONEDRIVE_CLIENT_ID',
  get redirectUri() {
    return oauthRedirectUri()
  },
}

export async function onedriveAuthorizeUrl(
  state: string,
  codeChallenge: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: ONEDRIVE.clientId,
    response_type: 'code',
    redirect_uri: ONEDRIVE.redirectUri,
    scope: ONEDRIVE.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${ONEDRIVE.authorizeUrl}?${params.toString()}`
}

export async function onedriveExchangeCodeStub(): Promise<OAuthTokens> {
  // CLIENT-SIDE STUB: replace with a server-side authorization-code exchange
  // using your registered Microsoft Entra app credentials.
  return {
    accessToken: `stub_onedrive_${crypto.randomUUID()}`,
    tokenType: 'Bearer',
    expiresIn: 3600,
  }
}
