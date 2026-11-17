import { useState } from 'react'
import { APPS, HUB } from '../data'
import type { AppModule } from '../types'

// From the manifest registry: the hub and the seven internal apps (external
// sites have no PWA/APK of ours to install).
const APPS_DOWNLOAD: AppModule[] = [...(HUB ? [HUB] : []), ...APPS.filter((a) => a.kind === 'internal')]

export function DownloadCenter() {
  const [selectedModal, setSelectedModal] = useState<{ app: AppModule; platform: 'apk' | 'ios' } | null>(null)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(text)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <button
            onClick={() => (window.location.href = '/')}
            className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-medium"
          >
            ← Back to Hub
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              📲
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Download & Sideload Center</h1>
              <p className="text-xs text-slate-500">Choose WebApp (PWA), Android APK, or iOS</p>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-8 bg-white rounded-2xl shadow border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-2">How to install</h2>
          <p className="text-slate-600 mb-4">
            Every app is a <strong>Progressive Web App (PWA)</strong> — works offline, installs from the browser, no app store required.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-1">🌐 WebApp (PWA)</h3>
              <p className="text-sm text-blue-700 mb-3">Open any app link in Chrome or Safari.</p>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• Android: Chrome → menu → "Add to Home Screen"</li>
                <li>• iOS: Safari → Share → "Add to Home Screen"</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <h3 className="font-bold text-amber-900 mb-1">📱 Android APK (Sideload)</h3>
              <p className="text-sm text-amber-700 mb-3">Build native APK via Capacitor + Android Studio.</p>
              <ul className="text-xs text-amber-600 space-y-1">
                <li>• `npx cap add android`</li>
                <li>• `npx cap open android`</li>
                <li>• Build → Generate Signed APK</li>
                <li>• `adb install app-release.apk`</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
              <h3 className="font-bold text-purple-900 mb-1">🍎 iOS (Native / PWA)</h3>
              <p className="text-sm text-purple-700 mb-3">PWA via Safari, or native via Xcode.</p>
              <ul className="text-xs text-purple-600 space-y-1">
                <li>• Safari → Share → "Add to Home Screen"</li>
                <li>• Native: `npx cap add ios`</li>
                <li>• `npx cap open ios` → Archive → Export</li>
              </ul>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-6">All 8 Sovereign Suite Apps</h3>
        <div className="space-y-4">
          {APPS_DOWNLOAD.map((app) => (
            <div key={app.id} className="bg-white rounded-2xl shadow border border-slate-200 p-6 flex flex-col lg:flex-row items-center gap-6">
              <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl">
                {app.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">{app.name}</h3>
                <p className="text-xs font-mono text-slate-500">{app.nativeId} · /{app.folder}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <a
                  href={app.route}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl text-center transition-colors"
                >
                  🌐 Open WebApp
                </a>
                <button
                  onClick={() => setSelectedModal({ app, platform: 'apk' })}
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl text-center transition-colors"
                >
                  📱 APK Sideload
                </button>
                <button
                  onClick={() => setSelectedModal({ app, platform: 'ios' })}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-xl text-center transition-colors"
                >
                  🍎 iOS Install
                </button>
              </div>
            </div>
          ))}
        </div>

        {selectedModal && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedModal.platform === 'apk' ? '📱 Android APK Sideload' : '🍎 iOS App Install'} — {selectedModal.app.shortName}
                </h3>
                <button onClick={() => setSelectedModal(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
              </div>

              {selectedModal.platform === 'apk' ? (
                <div className="space-y-4 text-sm text-slate-700">
                  <p>
                    Pre-generated Android Studio project: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">{selectedModal.app.folder}/android</code>
                  </p>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs space-y-2">
                    <div className="text-slate-400"># Open in Android Studio</div>
                    <div>cd {selectedModal.app.folder} && npx cap open android</div>
                    <div className="text-slate-400 pt-2"># Or build sideloadable APK via CLI</div>
                    <div>cd {selectedModal.app.folder}/android && ./gradlew assembleDebug</div>
                    <div className="text-emerald-400 pt-1">
                      # Output: {selectedModal.app.folder}/android/app/build/outputs/apk/debug/app-debug.apk
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(`cd ${selectedModal.app.folder}/android && ./gradlew assembleDebug`)}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl"
                    >
                      {copiedCmd ? '✓ Copied Command' : 'Copy Gradle APK Build Command'}
                    </button>
                    <button onClick={() => setSelectedModal(null)} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl">Close</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-sm text-slate-700">
                  <p>
                    <strong>1. Instant iOS WebApp:</strong> Open <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">{window.location.origin}{selectedModal.app.route}</code> in Safari → Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
                  </p>
                  <p>
                    <strong>2. Xcode Native App:</strong> Pre-generated at <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">{selectedModal.app.folder}/ios/App</code>.
                  </p>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs">
                    <div>cd {selectedModal.app.folder} && npx cap open ios</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(`cd ${selectedModal.app.folder} && npx cap open ios`)}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl"
                    >
                      {copiedCmd ? '✓ Copied Command' : 'Copy Xcode Open Command'}
                    </button>
                    <button onClick={() => setSelectedModal(null)} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl">Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}