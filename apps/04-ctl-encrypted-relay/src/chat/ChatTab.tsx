import { useState, type ReactNode } from 'react'
import { ChatView, LockIcon } from './ChatView'
import { createDemo, type DemoPerson } from './demo'
import type { ChatClientState } from './useChatClient'

type Props = {
  chat: ChatClientState
  onOpenInRelay: (hash: string) => void
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow border border-slate-200 p-6" data-testid="chat-notice">
      <h2 className="font-bold text-slate-900 flex items-center gap-2">
        <LockIcon className="w-4 h-4" /> {title}
      </h2>
      <div className="mt-2 text-sm text-slate-600 space-y-2">{children}</div>
    </div>
  )
}

export function ChatTab({ chat, onOpenInRelay }: Props) {
  const [demo, setDemo] = useState<DemoPerson[] | null>(null)
  const [demoUser, setDemoUser] = useState(0)
  const [demoError, setDemoError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const startDemo = async () => {
    setStarting(true)
    setDemoError(null)
    try {
      setDemo((await createDemo()).people)
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : 'Demo failed to start')
    } finally {
      setStarting(false)
    }
  }

  if (chat.status === 'ready') {
    return <ChatView client={chat.client} onOpenInRelay={onOpenInRelay} />
  }

  if (demo) {
    const person = demo[demoUser]
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          <span className="font-semibold">Local demo</span>
          <span className="text-xs">In-memory server in this tab only; real encryption, nothing leaves the browser.</span>
          <label className="ml-auto text-xs flex items-center gap-1">
            Viewing as
            <select
              className="border border-amber-300 rounded px-2 py-1 bg-white"
              value={demoUser}
              onChange={(e) => setDemoUser(Number(e.target.value))}
              aria-label="Viewing as"
            >
              {demo.map((p, i) => (
                <option key={p.userId} value={i}>
                  {p.name} — {p.email}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ChatView
          key={person.userId}
          client={person.client}
          nameOf={(id) => demo.find((p) => p.userId === id)?.name}
          onOpenInRelay={onOpenInRelay}
        />
      </div>
    )
  }

  const demoButton = (
    <button
      onClick={startDemo}
      disabled={starting}
      className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-white disabled:opacity-50"
    >
      {starting ? 'Starting…' : 'Try the local demo'}
    </button>
  )

  return (
    <div className="max-w-2xl">
      {chat.status === 'not-configured' && (
        <Notice title="Encrypted chat is not configured">
          <p>
            This build has no Supabase project (<code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>
            ), so rooms cannot be synced between people. The C.T.L. relay on the other tab works fully offline.
          </p>
          {demoButton}
        </Notice>
      )}
      {chat.status === 'signed-out' && (
        <Notice title="Sign in to use encrypted chat">
          <p>Sign in to Aurelia from the hub, then return here. Your device keys are created on first use.</p>
          {demoButton}
        </Notice>
      )}
      {chat.status === 'loading' && <Notice title="Preparing this device's keys…">{null}</Notice>}
      {chat.status === 'error' && (
        <Notice title="Chat is unavailable">
          <p>{chat.message}</p>
        </Notice>
      )}
      {demoError && <p className="mt-3 text-sm text-red-700">{demoError}</p>}
    </div>
  )
}
