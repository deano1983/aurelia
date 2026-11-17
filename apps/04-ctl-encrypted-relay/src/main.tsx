import React, { type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { AureliaAuthProvider, RequireSession, useSession } from '@aurelia/core/auth'
import { ChatBackendProvider } from '@aurelia/core/chat'
import App from './App'
import './index.css'

/** Hands the signed-in user's Supabase client to encrypted chat and packet signing. */
function ChatWiring({ children }: { children: ReactNode }) {
  const { supabase, user } = useSession()
  if (!supabase || !user) return <>{children}</>
  return (
    <ChatBackendProvider supabase={supabase} userId={user.id}>
      {children}
    </ChatBackendProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AureliaAuthProvider>
      <RequireSession appName="CTL Encrypted Relay">
        <ChatWiring>
          <App />
        </ChatWiring>
      </RequireSession>
    </AureliaAuthProvider>
  </React.StrictMode>,
)
