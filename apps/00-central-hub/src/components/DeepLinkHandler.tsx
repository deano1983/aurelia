import { type DeepLinkHandlerProps } from '../types'

export function DeepLinkHandler({ target, onBack }: DeepLinkHandlerProps) {
  const isCtl = target.startsWith('ctl=')
  const isVault = target.startsWith('vault=')
  const fragment = isCtl ? target.slice(4) : isVault ? target.slice(6) : target

  return (
    <div className="min-h-screen bg-aurelia-surface flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            🔗
          </div>
          <h2 className="text-xl font-bold text-aurelia-dark">Deep Link Received</h2>
        </div>
        <p className="text-slate-600 mb-6">
          You opened a{' '}
          <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono">
            #{isCtl ? 'ctl=' : 'vault='}{fragment.slice(0, 20)}…
          </code>
          . The target app will handle decryption and routing.
        </p>
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Ciphertext fragment:</p>
          <pre className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm font-mono overflow-x-auto break-all">
            {fragment}
          </pre>
          <button
            onClick={onBack}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}