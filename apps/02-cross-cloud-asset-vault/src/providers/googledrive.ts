import type { CloudProviderConfig, OAuthTokens } from './index'

export const GOOGLEDRIVE: CloudProviderConfig = {
  id: 'googledrive',
  name: 'Google Drive',
  platform: 'Android / Workspace',
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  clientId: 'REPLACE_WITH_GOOGLE_DRIVE_CLIENT_ID',
  redirectUri: 'http://localhost:5176/oauth/callback',
}

export async function googledriveAuthorizeUrl(
  state: string,
  codeChallenge: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: GOOGLEDRIVE.clientId,
    response_type: 'code',
    redirect_uri: GOOGLEDRIVE.redirectUri,
    scope: GOOGLEDRIVE.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${GOOGLEDRIVE.authorizeUrl}?${params.toString()}`
}

export async function googledriveExchangeCodeStub(): Promise<OAuthTokens> {
  // CLIENT-SIDE STUB: replace with a server-side authorization-code exchange
  // using your registered Google Cloud project credentials.
  return {
    accessToken: `stub_googledrive_${crypto.randomUUID()}`,
    tokenType: 'Bearer',
    expiresIn: 3600,
  }
}
