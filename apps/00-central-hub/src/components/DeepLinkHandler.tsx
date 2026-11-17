import { useEffect } from 'react'
import { type DeepLinkHandlerProps } from '../types'
import { APP_SHORT_NAMES, hubDeepLinkTarget } from '../utils/interlinks'

/**
 * A deep link landed on the hub (/#ctl=…, /#vault=…, /#timeline/add?…, …).
 * Route it to the owning app on the same origin, keeping the fragment intact so
 * the app can decrypt / prefill. Never displays ciphertext.
 */
export function DeepLinkHandler({ target, onBack }: DeepLinkHandlerProps) {
  const route = hubDeepLinkTarget(`#${target.replace(/^#/, '')}`)

  useEffect(() => {
    if (route) window.location.replace(route.url)
  }, [route?.url])

  return (
    <div className="min-h-screen bg-aurelia-surface flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            🔗
          </div>
          <h2 className="text-xl font-bold text-aurelia-dark">
            {route ? `Opening ${APP_SHORT_NAMES[route.appId]}…` : 'Link not recognised'}
          </h2>
        </div>
        {route ? (
          <p className="text-slate-600 mb-6">
            This link belongs to {route.appId} {APP_SHORT_NAMES[route.appId]}. If nothing happens,{' '}
            <a href={route.url} className="text-blue-700 underline">
              open it here
            </a>
            .
          </p>
        ) : (
          <p className="text-slate-600 mb-6">This link does not point to an Aurelia app.</p>
        )}
        <button
          onClick={onBack}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  )
}
