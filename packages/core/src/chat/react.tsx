// Wiring point between the auth layer and chat UIs. The auth package (or an
// app's main.tsx) wraps the tree once a session exists:
//
//   <ChatBackendProvider supabase={client} userId={session.user.id}>
//     <App />
//   </ChatBackendProvider>
//
// Chat UIs call useChatBackend() and render a "sign in" notice when it is null.
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ChatBackend = {
  supabase: SupabaseClient
  userId: string
  /** Optional label published with this device's public keys. */
  deviceLabel?: string
}

const ChatBackendContext = createContext<ChatBackend | null>(null)

export function ChatBackendProvider(props: ChatBackend & { children: ReactNode }) {
  const { supabase, userId, deviceLabel, children } = props
  const value = useMemo(() => ({ supabase, userId, deviceLabel }), [supabase, userId, deviceLabel])
  return <ChatBackendContext.Provider value={value}>{children}</ChatBackendContext.Provider>
}

export function useChatBackend(): ChatBackend | null {
  return useContext(ChatBackendContext)
}
