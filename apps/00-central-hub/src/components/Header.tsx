import { type UserSession } from '../types'

type HeaderProps = {
  session: UserSession
  onLogout: () => void
}

export function Header({ session, onLogout }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            A
          </div>
          <div>
            <h1 className="text-lg font-bold text-aurelia-dark">Aurelia OS</h1>
            <p className="text-xs text-slate-500">
              Sovereign Command Suite · {session.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full text-xs text-slate-600 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Session active</span>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}