import { useState, useEffect } from 'react'
import { APPS } from './data'
import { SessionProvider, useSession } from './components/SessionProvider'
import { Header } from './components/Header'
import { AppCard } from './components/AppCard'
import { DeepLinkHandler } from './components/DeepLinkHandler'
import { DownloadCenter } from './components/DownloadCenter'
import { ActivityFeed } from './components/ActivityFeed'
import { hubDeepLinkTarget } from './utils/interlinks'
import { UpdateBanner } from '@aurelia/core/events'

function AppShell() {
  const [activeSection, setActiveSection] = useState<'dashboard' | 'deep-link' | 'download'>('dashboard')
  const [deepLinkTarget, setDeepLinkTarget] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    // Any deep link meant for an app (#ctl=, #vault=, #timeline/add?…, …) is routed there.
    if (hubDeepLinkTarget(hash)) {
      setActiveSection('deep-link')
      setDeepLinkTarget(hash.slice(1))
    }
  }, [])

  const { session, logout } = useSession()

  if (!session) return null

  if (activeSection === 'deep-link' && deepLinkTarget) {
    return (
      <div className="min-h-screen bg-aurelia-surface">
        <Header session={session} onLogout={logout} />
        <DeepLinkHandler target={deepLinkTarget} onBack={() => { setActiveSection('dashboard'); setDeepLinkTarget(null); window.location.hash = '' } } />
      </div>
    )
  }

  if (activeSection === 'download') {
    return (
      <div className="min-h-screen bg-aurelia-surface">
        <Header session={session} onLogout={logout} />
        <DownloadCenter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-aurelia-surface">
      <Header session={session} onLogout={logout} />
      <main className="px-6 py-8 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-aurelia-dark">Command Center</h2>
                <p className="text-slate-600">
                  Select an app to open. All apps share your session and passphrase.
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-medium text-blue-700">{APPS.length} apps online</span>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {APPS.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveSection('download') }}
                className="group block p-6 rounded-2xl border bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">📲</span>
                </div>
                <h3 className="font-bold text-indigo-900 mb-1 group-hover:text-indigo-800 transition-colors">
                  Download Center
                </h3>
                <p className="text-sm text-indigo-700 mb-4 line-clamp-2">Install as PWA, APK sideload, or iOS native</p>
              </a>
            </div>
          </div>

          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sticky top-24">
              <h3 className="font-bold text-aurelia-dark mb-4 flex items-center gap-2">
                👤 {session.name}
              </h3>
              <div className="mb-6">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Role</p>
                <p className="text-sm text-slate-700">{session.role}</p>
              </div>
              <div className="mb-6">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Shared Passphrase</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">
                    {session.passphrase ? session.passphrase.replace(/./g, '•') : '—'}
                  </span>
                  <span className="text-[10px] text-slate-400">never stored</span>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Cross-App Flows</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">→</span> Voice Studio → CTL Relay
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">→</span> Tax Invoice → Timeline
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">→</span> Affiliate Engine → Timeline
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">→</span> Asset Vault ← All apps
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-6">
              <ActivityFeed />
            </div>
          </div>
        </div>
      </main>
      <UpdateBanner />
    </div>
  )
}

export function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  )
}

export default App