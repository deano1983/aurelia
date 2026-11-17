import type { CloudProvider } from '../types'
import type { CloudProviderConfig } from '../providers'
import { ICLOUD, ONEDRIVE, GOOGLEDRIVE } from '../providers'

interface ProviderCardsProps {
  onConnect: (provider: CloudProvider) => void
  connecting: CloudProvider | null
}

const CARDS: { id: CloudProvider; config: CloudProviderConfig; icon: string }[] = [
  { id: 'icloud', config: ICLOUD, icon: '☁️' },
  { id: 'onedrive', config: ONEDRIVE, icon: '🪟' },
  { id: 'googledrive', config: GOOGLEDRIVE, icon: '📁' },
]

export function ProviderCards({ onConnect, connecting }: ProviderCardsProps) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
        Cloud providers
      </h2>
      <div className="grid md:grid-cols-3 gap-4">
        {CARDS.map(({ id, config, icon }) => (
          <div
            key={id}
            className={`rounded-xl p-5 ${
              connecting === id
                ? 'border-vault-primary bg-vault-primary/5'
                : 'border-slate-200 bg-white hover:border-slate-300 transition-colors'
            } border`}
          >
            <div className="text-2xl mb-3">{icon}</div>
            <h3 className="font-bold text-slate-900">{config.name}</h3>
            <p className="text-xs text-slate-500 mb-4">{config.platform}</p>
            <button
              onClick={() => onConnect(id)}
              disabled={connecting !== null}
              className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                connecting === id
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-vault-primary text-white hover:bg-vault-accent/90'
              }`}
            >
              {connecting === id ? 'Authorizing…' : 'Connect'}
            </button>
            <p className="mt-3 text-[10px] text-slate-400">
              $0.00 egress • OAuth PKCE
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
