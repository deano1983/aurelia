import { useEffect, useState } from 'react'
import {
  ChatClient,
  IndexedDbKeyStore,
  createSupabaseChatTransport,
  useChatBackend,
} from '@aurelia/core/chat'

export type ChatClientState =
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; client: ChatClient }

export const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

function deviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Device'
  return `C.T.L. Relay on ${os}`
}

/**
 * The signed-in user's chat client (this device's identity), when Supabase is
 * configured and the auth layer provides a ChatBackendProvider.
 */
export function useChatClient(): ChatClientState {
  const backend = useChatBackend()
  const [state, setState] = useState<ChatClientState>(() =>
    !supabaseConfigured ? { status: 'not-configured' } : backend ? { status: 'loading' } : { status: 'signed-out' },
  )

  useEffect(() => {
    if (!supabaseConfigured) return setState({ status: 'not-configured' })
    if (!backend) return setState({ status: 'signed-out' })
    let cancelled = false
    setState({ status: 'loading' })
    const client = new ChatClient({
      transport: createSupabaseChatTransport(backend.supabase, backend.userId),
      keyStore: new IndexedDbKeyStore(),
      userId: backend.userId,
      deviceLabel: backend.deviceLabel ?? deviceLabel(),
    })
    client
      .init()
      .then(() => !cancelled && setState({ status: 'ready', client }))
      .catch((e: unknown) => !cancelled && setState({ status: 'error', message: e instanceof Error ? e.message : 'Chat unavailable' }))
    return () => {
      cancelled = true
    }
  }, [backend])

  return state
}
