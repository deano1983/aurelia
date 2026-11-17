import { useState } from 'react'
import type { CloudProvider } from './types'
import {
  GOOGLEDRIVE,
  ICLOUD,
  ONEDRIVE,
  googledriveAuthorizeUrl,
  icloudAuthorizeUrl,
  onedriveAuthorizeUrl,
  icloudExchangeCodeStub,
  onedriveExchangeCodeStub,
  googledriveExchangeCodeStub,
  pkcePair,
  type CloudProviderConfig,
  type OAuthTokens,
} from './providers'
import { CloudSelector } from './components/CloudSelector'
import { LinkPointerButton } from './components/LinkPointerButton'
import { PointerList } from './components/PointerList'
import { ProviderCards } from './components/ProviderCards'
import { PendingPointers } from './components/PendingPointers'
import { usePendingPointers } from './utils/interlinks'
import { UpdateBanner } from '@aurelia/core/events'

const PROVIDER_CONFIGS: Record<CloudProvider, CloudProviderConfig> = {
  icloud: ICLOUD,
  onedrive: ONEDRIVE,
  googledrive: GOOGLEDRIVE,
}

const AUTHORIZE_FNS: Record<
  CloudProvider,
  (state: string, challenge: string) => Promise<string>
> = {
  icloud: icloudAuthorizeUrl,
  onedrive: onedriveAuthorizeUrl,
  googledrive: googledriveAuthorizeUrl,
}

const EXCHANGE_STUBS: Record<CloudProvider, () => Promise<OAuthTokens>> = {
  icloud: icloudExchangeCodeStub,
  onedrive: onedriveExchangeCodeStub,
  googledrive: googledriveExchangeCodeStub,
}

export default function App() {
  const [provider, setProvider] = useState<CloudProvider | ''>('')
  const [connecting, setConnecting] = useState<CloudProvider | null>(null)
  const [verifier, setVerifier] = useState<string | null>(null)
  const [pendingCode, setPendingCode] = useState('')
  const [exchanging, setExchanging] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  // Invoice PDFs from 06 (invoice.pdf_exported) waiting to become pointers.
  const { pending, remove: dropPending } = usePendingPointers()
  const [pointerVersion, setPointerVersion] = useState(0)


  const handleConnect = async (selected: CloudProvider) => {
    const config = PROVIDER_CONFIGS[selected]
    const { codeVerifier, codeChallenge } = await pkcePair()
    setVerifier(codeVerifier)
    setConnecting(selected)
    setPendingCode('')
    const url = await AUTHORIZE_FNS[selected]('aurelia-vault', codeChallenge)
    window.open(url, '_blank')
    setStatus(`Connecting to ${config.name}: complete sign-in, then paste the authorization code.`)
    setMessage(null)
  }
  const handleCompleteConnect = async () => {
    if (!connecting || !verifier || !pendingCode) return
    setExchanging(true)
    try {
      await EXCHANGE_STUBS[connecting]()
      const config = PROVIDER_CONFIGS[connecting]
      setConnecting(null)
      setVerifier(null)
      setPendingCode('')
      setStatus(null)
      setMessage(`Connected to ${config.name} (stub token issued).`)
    } finally {
      setExchanging(false)
    }
  }

  const handleLinked = () => {
    setMessage('Pointer linked.')
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-vault-primary flex items-center justify-center text-white font-bold">
              V
            </div>
            <div>
              <h1 className="text-lg font-bold text-vault-dark">
                Cross-Cloud Asset Vault
              </h1>
              <p className="text-xs text-slate-500">
                Zero egress • 12 KB pointer index • PBKDF2 + AES-GCM
              </p>
            </div>
          </div>
          {message && <span className="text-xs text-slate-500">{message}</span>}
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <CloudSelector value={provider} onChange={setProvider} />
            <LinkPointerButton
              provider={provider}
              onProviderChange={setProvider}
              onLinked={handleLinked}
            />
          </div>
        </div>
        {connecting && (
          <div className="mb-6 p-4 rounded-lg border border-vault-primary/20 bg-vault-primary/5">
            <p className="text-sm text-vault-dark">{status}</p>
            <input
              value={pendingCode}
              onChange={(event) => setPendingCode(event.target.value)}
              placeholder="Paste authorization code from redirect URL"
              className="mt-2 block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-primary"
            />
            <button
              onClick={handleCompleteConnect}
              disabled={exchanging || !pendingCode}
              className={`mt-2 px-3 py-1.5 text-sm rounded-lg ${
                exchanging
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-vault-primary text-white'
              }`}
            >
              {exchanging ? 'Exchanging…' : 'Complete exchange (stub)'}
            </button>
            <p className="mt-2 text-[10px] text-slate-400">
              Client-side PKCE stub. The code verifier is held in memory only;
              no credentials are stored or uploaded.
            </p>
          </div>
        )}
        <PendingPointers
          pending={pending}
          provider={provider}
          onRemove={dropPending}
          onLinked={(text) => {
            setMessage(text)
            setPointerVersion((v) => v + 1)
          }}
        />
        <ProviderCards onConnect={handleConnect} connecting={connecting} />
        <div className="mt-8">
          <PointerList key={pointerVersion} provider={provider} />
        </div>
        <footer className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-400 leading-relaxed">
            Interlinks: stores cloud proof pointers for{' '}
            <strong>03 Voice Studio</strong> and <strong>04 CTL Relay</strong> • receives{' '}
            <strong>.ics</strong> exports from <strong>01 Timeline</strong> as pointer assets • shares
            passphrase-derived encryption keys (PBKDF2-SHA256 + AES-256-GCM) with{' '}
            <strong>04 CTL Relay</strong>.
          </p>
        </footer>
      </main>
      <UpdateBanner />
    </div>
  )
}

