import { type AppModule } from '../types'
import { APPS } from '../data'

type AppCardProps = {
  app: AppModule
}

export function AppCard({ app }: AppCardProps) {
  const depNames = app.dependencies
    .map((id) => {
      const found = APPS.find((a) => a.id === id)
      return found ? found.name : null
    })
    .filter(Boolean) as string[]

  const external = app.kind === 'external'

  return (
    <a
      href={app.route}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      data-app-id={app.id}
      className={`group block p-6 rounded-2xl border ${app.color} hover:bg-white/50 transition-all cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xl">{app.icon}</span>
        {external && (
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            external ↗
          </span>
        )}
        {app.status === 'planned' && (
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            planned
          </span>
        )}
      </div>
      <h3 className="font-bold text-aurelia-dark mb-1 group-hover:text-blue-600 transition-colors">
        {app.name}
      </h3>
      <p className="text-sm text-slate-600 mb-4 line-clamp-2">{app.tagline}</p>
      {depNames.length > 0 && <div className="flex items-center gap-1 mt-2">
        <span className="text-xs font-medium text-slate-500">Links:</span>
        {depNames.map((name, i) => (
          <span key={i} className="text-xs text-blue-600 hover:underline">
            {name}{i < depNames.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>}
    </a>
  )
}