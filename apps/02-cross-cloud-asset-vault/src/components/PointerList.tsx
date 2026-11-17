import { useCallback, useEffect, useState } from 'react'
import type { CloudPointer, CloudProvider } from '../types'
import {
  addPointer,
  getAllPointers,
  getPointerStats,
  removePointer,
} from '../lib/pointerIndex'
import { decryptPointer } from '../crypto'

interface PointerListProps {
  provider: CloudProvider | ''
}

const BADGE_FOR: Record<CloudProvider, string> = {
  icloud: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  onedrive: 'bg-blue-50 text-blue-700 border-blue-200',
  googledrive: 'bg-blue-50 text-blue-700 border-blue-200',
}

export function PointerList({ provider }: PointerListProps) {
  const [pointers, setPointers] = useState<CloudPointer[]>([])
  const [stats, setStats] = useState<{
    count: number
    totalBytes: number
    maxBytes: number
  }>({ count: 0, totalBytes: 0, maxBytes: 0 })
  const [decryptTarget, setDecryptTarget] = useState<CloudPointer | null>(null)
  const [decryptPassphrase, setDecryptPassphrase] = useState('')
  const [decrypting, setDecrypting] = useState(false)
  const [decrypted, setDecrypted] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const list = await getAllPointers()
    const s = await getPointerStats()
    setPointers(list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    setStats(s)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleRemove = async (id: string) => {
    if (!window.confirm('Remove this pointer from the index?')) return
    try {
      await removePointer(id)
      setError(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove pointer.')
    }
  }

  const handleDecrypt = async () => {
    if (!decryptTarget?.sealed) return
    setDecrypting(true)
    setError(null)
    setDecrypted(null)
    try {
      const result = await decryptPointer(decryptTarget.sealed, decryptPassphrase)
      if (!result) {
        setError('Decryption failed — incorrect passphrase or corrupted pointer.')
        return
      }
      setDecrypted(JSON.stringify(result, null, 2))
    } finally {
      setDecrypting(false)
    }
  }

  const handleIcsFile = async (file: File) => {
    if (!provider) {
      setError('Select a cloud provider before importing a .ics export.')
      return
    }
    setError(null)
    try {
      const text = await file.text()
      const eventCount = (text.match(/BEGIN:VEVENT/g) || []).length
      const base = {
        id: crypto.randomUUID(),
        provider,
        sourceApp: '01-daily-command-timeline',
        name: `ics: ${file.name}`,
        fileId: `ics://${file.name}`,
        encrypted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const pointer: CloudPointer = {
        ...base,
        webViewUrl: undefined,
        sizeBytes: new TextEncoder().encode(JSON.stringify(base)).byteLength,
      }
      // addPointer enforces the 12 KB index cap.
      await addPointer(pointer)
      setMessage(
        `.ics imported as a pointer (${eventCount} events). Pointer only — no calendar bytes stored.`
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import .ics export.')
    }
  }

  const copySealUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setMessage('Seal URL copied to clipboard.')
    } catch {
      setMessage('Could not copy to clipboard.')
    }
  }

  const usagePercent = stats.maxBytes
    ? Math.min(100, (stats.totalBytes / stats.maxBytes) * 100)
    : 0

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Pointer index</h2>
          <p className="text-xs text-slate-500">
            {stats.count} pointer(s) •{' '}
            {(stats.totalBytes / 1024).toFixed(2)} KB / 12 KB
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const input = document.getElementById(
                'ics-import'
              ) as HTMLInputElement | null
              input?.click()
            }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            aria-label="Import .ics export from 01 Timeline"
          >
            Import .ics from 01 Timeline
          </button>
          <input
            id="ics-import"
            type="file"
            accept=".ics"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleIcsFile(file)
            }}
          />
        </div>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2 mb-1">
        <div
          className="bg-vault-primary h-2 rounded-full"
          style={{ width: `${usagePercent}%` }}
          role="progressbar"
          aria-valuenow={usagePercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          {message}
        </div>
      )}
      {pointers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-slate-500 text-sm">
            No pointers indexed yet. Use "+ Link Cloud Pointer" to add one.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="pb-2 text-xs font-semibold text-slate-500">
                  Provider
                </th>
                <th className="pb-2 text-xs font-semibold text-slate-500">
                  Name
                </th>
                <th className="pb-2 text-xs font-semibold text-slate-500">
                  Source
                </th>
                <th className="pb-2 text-xs font-semibold text-slate-500 text-right">
                  Size
                </th>
                <th className="pb-2 text-xs font-semibold text-slate-500">
                  Encrypted
                </th>
                <th className="pb-2 text-xs font-semibold text-slate-500">
                  Added
                </th>
                <th className="pb-2 text-xs font-semibold text-slate-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>

              {pointers.map((pointer) => (
                <tr key={pointer.id} className="border-b border-slate-100">
                  <td className="py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${BADGE_FOR[pointer.provider]}`}
                    >
                      {pointer.provider}
                    </span>
                  </td>
                  <td className="py-3 font-medium text-slate-900">
                    {pointer.name}
                    {pointer.sourceApp && (
                      <span className="ml-2 text-[10px] text-slate-400">
                        {pointer.sourceApp}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-slate-500">
                    {pointer.fileId.length > 28
                      ? `${pointer.fileId.slice(0, 24)}…`
                      : pointer.fileId}
                  </td>
                  <td className="py-3 text-right text-slate-500">
                    {(pointer.sizeBytes / 1024).toFixed(2)} KB
                  </td>
                  <td className="py-3">
                    {pointer.encrypted ? (
                      <span className="text-[10px] font-semibold text-amber-700">
                        Yes
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">No</span>
                    )}
                  </td>
                  <td className="py-3 text-slate-500">
                    {new Date(pointer.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    {pointer.encrypted && pointer.sealedUrl ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => copySealUrl(pointer.sealedUrl!)}
                          className="text-xs text-vault-primary hover:underline"
                          aria-label="Copy seal URL"
                        >
                          Seal URL
                        </button>
                        <button
                          onClick={() => {
                            setDecryptTarget(pointer)
                            setDecryptPassphrase('')
                            setDecrypted(null)
                            setError(null)
                          }}
                          className="text-xs text-vault-primary hover:underline"
                          aria-label="Decrypt pointer"
                        >
                          Decrypt
                        </button>
                      </div>
                    ) : null}
                    <button
                      onClick={() => handleRemove(pointer.id)}
                      className="mt-1 text-xs text-slate-500 hover:text-red-600 underline"
                      aria-label="Remove pointer"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {decryptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 mt-8">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDecryptTarget(null)}
          />
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative z-10">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Decrypt pointer
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter the passphrase used to seal "{decryptTarget.name}".
            </p>
            <input
              type="password"
              value={decryptPassphrase}
              onChange={(event) => setDecryptPassphrase(event.target.value)}
              placeholder="••••••••"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-vault-primary"
            />
            {error && (
              <p className="mb-3 text-xs text-red-700 bg-red-50 rounded p-2">
                {error}
              </p>
            )}
            {decrypted ? (
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-700 mb-1">
                  Decrypted pointer
                </p>
                <pre className="text-[10px] text-slate-600 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 max-h-48">
                  {decrypted}
                </pre>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDecryptTarget(null)}
                className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDecrypt}
                disabled={decrypting}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-vault-primary text-white disabled:opacity-50"
              >
                {decrypting ? 'Decrypting…' : 'Decrypt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

