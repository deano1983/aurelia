import { useState } from 'react'
import type { CloudProvider } from '../types'
import { addPointer } from '../lib/pointerIndex'
import { announcePointer, pointerFromPending, type PendingPointer } from '../utils/interlinks'

interface PendingPointersProps {
  pending: PendingPointer[]
  provider: CloudProvider | ''
  onRemove: (id: string) => void
  onLinked: (message: string) => void
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

/** Invoice PDFs exported in 06, waiting to be linked as cloud proof pointers. */
export function PendingPointers({ pending, provider, onRemove, onLinked }: PendingPointersProps) {
  const [error, setError] = useState<string | null>(null)
  if (pending.length === 0) return null

  const link = async (item: PendingPointer) => {
    if (!provider) {
      setError('Select a cloud provider first.')
      return
    }
    try {
      const pointer = pointerFromPending(item, provider)
      await addPointer(pointer)
      announcePointer(pointer)
      onRemove(item.id)
      setError(null)
      onLinked(`Linked ${item.fileName}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link pointer.')
    }
  }

  return (
    <section aria-label="Pending pointers" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-vault-dark mb-2">Pending pointers ({pending.length})</h2>
      <ul className="space-y-2">
        {pending.map((item) => (
          <li key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
            <span className="flex-1 min-w-0 break-words text-slate-700">
              {item.fileName} <span className="text-xs text-slate-500">from 06 Tax Invoice · {kb(item.sizeBytes)}</span>
            </span>
            <span className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void link(item)}
                className="px-3 py-1.5 rounded-lg bg-vault-primary text-white text-xs font-semibold"
              >
                Link{provider ? ` to ${provider}` : ''}
              </button>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold"
              >
                Dismiss
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </section>
  )
}
