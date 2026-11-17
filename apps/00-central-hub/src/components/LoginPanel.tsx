import { useEffect, useState, type FormEvent } from 'react'
import { useSession, MIN_PASSPHRASE_LENGTH } from '@aurelia/core/auth'

export const ROLE_OPTIONS = [
  'Executive',
  'Executive Assistant',
  'Board Chair',
  'Ghostwriter',
  'Creator',
  'Personal / Life',
] as const

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none'

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Try again.'
}

/** Sign-in screen: email magic link or Google, via Supabase Auth. */
export function LoginPanel() {
  const { signInWithEmail, signInWithGoogle } = useSession()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sendLink = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInWithEmail(email)
      setSentTo(email.trim())
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(message(err))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-aurelia-dark p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-xl">🔑</div>
          <h2 className="text-xl font-bold text-aurelia-dark">Aurelia OS</h2>
        </div>

        {sentTo ? (
          <div className="space-y-4">
            <p className="text-slate-700">
              Check <span className="font-semibold">{sentTo}</span> for a sign-in link.
            </p>
            <p className="text-sm text-slate-500">
              Open the link in this same browser. Every Aurelia app picks up the session once you are in.
            </p>
            <button
              onClick={() => setSentTo(null)}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <p className="text-slate-600 mb-6">Sign in once to open the Command Suite and all seven apps.</p>
            <form onSubmit={sendLink} className="space-y-3">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={busy || email.trim().length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {busy ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <button
              onClick={google}
              className="w-full border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold py-3 rounded-lg transition-colors"
            >
              Continue with Google
            </button>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

/** Name and role editing for the signed-in user (stored in the profiles table). */
export function ProfileEditor() {
  const { user, updateProfile, profileError } = useSession()
  const [name, setName] = useState(user?.name ?? '')
  const [role, setRole] = useState(user?.role ?? ROLE_OPTIONS[0])
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(user?.name ?? '')
    setRole(user?.role ?? ROLE_OPTIONS[0])
  }, [user?.name, user?.role])

  if (!user) return null
  const dirty = name.trim() !== user.name || role !== user.role
  const roles: string[] = ROLE_OPTIONS.includes(role as (typeof ROLE_OPTIONS)[number])
    ? [...ROLE_OPTIONS]
    : [role, ...ROLE_OPTIONS]

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setState('saving')
    setError(null)
    try {
      await updateProfile({ name, role })
      setState('saved')
    } catch (err) {
      setError(message(err))
      setState('idle')
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <p className="text-xs text-slate-500 break-all">{user.email}</p>
      <div>
        <label htmlFor="profile-name" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
          Name
        </label>
        <input
          id="profile-name"
          className={inputClass}
          value={name}
          maxLength={80}
          onChange={(e) => {
            setName(e.target.value)
            setState('idle')
          }}
        />
      </div>
      <div>
        <label htmlFor="profile-role" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
          Role
        </label>
        <select
          id="profile-role"
          className={inputClass}
          value={role}
          onChange={(e) => {
            setRole(e.target.value)
            setState('idle')
          }}
        >
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={!dirty || state === 'saving' || name.trim().length === 0}
        className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      >
        {state === 'saving' ? 'Saving…' : state === 'saved' && !dirty ? 'Saved' : 'Save profile'}
      </button>
      {(error || profileError) && (
        <p role="alert" className="text-xs text-red-600">
          {error ?? `Profile unavailable: ${profileError}`}
        </p>
      )}
    </form>
  )
}

/** Unlock / lock the in-memory room key. The passphrase is never stored. */
export function RoomLockPanel() {
  const { roomKey, unlockRoom, lockRoom } = useSession()
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (roomKey) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-emerald-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Room unlocked
        </p>
        <p className="text-[11px] text-slate-400">Key held in memory only. Locks after 30 minutes idle.</p>
        <button onClick={lockRoom} className="text-sm font-medium text-slate-700 hover:underline">
          Lock now
        </button>
      </div>
    )
  }

  const unlock = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await unlockRoom(passphrase)
    } catch (err) {
      setError(message(err))
    } finally {
      setPassphrase('')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={unlock} className="space-y-2">
      <input
        type="password"
        autoComplete="off"
        aria-label="Room passphrase"
        className={inputClass}
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        placeholder={`Passphrase (min ${MIN_PASSPHRASE_LENGTH} chars)`}
      />
      <button
        type="submit"
        disabled={busy || passphrase.length < MIN_PASSPHRASE_LENGTH}
        className="px-4 py-2 text-sm font-semibold bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      >
        {busy ? 'Unlocking…' : 'Unlock room'}
      </button>
      <p className="text-[11px] text-slate-400">Never stored. Unlock again after a reload or in another app.</p>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}
