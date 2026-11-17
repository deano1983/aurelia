import type { CloudProvider } from '../types'

interface CloudSelectorProps {
  value: CloudProvider | ''
  onChange: (provider: CloudProvider) => void
}

const PROVIDER_LABELS: Record<CloudProvider, { label: string; platform: string }> = {
  icloud: { label: 'Apple iCloud', platform: 'iOS / macOS' },
  onedrive: { label: 'Microsoft OneDrive', platform: 'Windows' },
  googledrive: { label: 'Google Drive', platform: 'Android / Workspace' },
}

export function CloudSelector({ value, onChange }: CloudSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Cloud provider
      </span>
      <select
        value={value}
        onChange={(event) =>
          onChange((event.target.value as CloudProvider))
        }
        className="bg-white border border-slate-200 text-slate-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-vault-primary"
      >
        <option value="">Select a provider</option>
        {Object.entries(PROVIDER_LABELS).map(([id, label]) => (
          <option key={id} value={id}>
            {label.label} — {label.platform}
          </option>
        ))}
      </select>
    </div>
  )
}
