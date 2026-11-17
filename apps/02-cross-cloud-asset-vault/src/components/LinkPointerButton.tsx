import { useCallback, useEffect, useState } from 'react'
import type { CloudPointer, CloudProvider } from '../types'
import { addPointer, getPointerStats } from '../lib/pointerIndex'
import { encryptPointer, pointerToUrlHash } from '../crypto'
import { CloudSelector } from './CloudSelector'

interface LinkPointerButtonProps {
  provider: CloudProvider | ''
  onProviderChange: (provider: CloudProvider) => void
  onLinked: () => void
}

export function LinkPointerButton({
  provider,
  onProviderChange,
  onLinked,
}: LinkPointerButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [fileId, setFileId] = useState('')
  const [webViewUrl, setWebViewUrl] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [seal, setSeal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [usage, setUsage] = useState<{
    totalBytes: number
    maxBytes: number
  } | null>(null)

  const refreshUsage = useCallback(async () => {
    const stats = await getPointerStats()
    setUsage({ totalBytes: stats.totalBytes, maxBytes: stats.maxBytes })
  }, [])

  useEffect(() => {
    refreshUsage()
  }, [refreshUsage])
  const handleLink = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!provider || !name || !fileId) {
      setMessage('Provider, pointer name and remote file ID are required.')
      return
    }
    if (webViewUrl) {
      let parsed: URL | null = null
      try {
        parsed = new URL(webViewUrl)
      } catch {
        parsed = null
      }
      if (!parsed || parsed.protocol !== 'https:') {
        setMessage('Web view URL must be an https:// link.')
        return
      }
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const base: Omit<CloudPointer, 'sizeBytes'> = {
        id: crypto.randomUUID(),
        provider,
        name,
        fileId,
        webViewUrl: webViewUrl || undefined,
        encrypted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const sizeBytes = new TextEncoder().encode(JSON.stringify(base)).byteLength
      let pointer: CloudPointer = { ...base, sizeBytes }
      if (seal && passphrase) {
        const sealed = await encryptPointer(pointer, passphrase)
        // Store ONLY the ciphertext: name, fileId and webViewUrl live inside
        // `sealed` and are not kept in plaintext beside it.
        pointer = {
          id: pointer.id,
          provider: pointer.provider,
          name: 'Sealed pointer',
          fileId: '',
          encrypted: true,
          sealed,
          sealedUrl: pointerToUrlHash(sealed),
          sizeBytes: 0,
          createdAt: pointer.createdAt,
          updatedAt: pointer.updatedAt,
        }
        pointer = {
          ...pointer,
          sizeBytes: new TextEncoder().encode(JSON.stringify(pointer)).byteLength,
        }
      }
      // addPointer enforces the 12 KB index cap.
      await addPointer(pointer)
      setMessage(seal ? 'Pointer linked and sealed.' : 'Pointer linked.')
      setName('')
      setFileId('')
      setWebViewUrl('')
      setPassphrase('')
      setSeal(false)
      setOpen(false)
      onLinked()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to link pointer.')
    } finally {
      setSubmitting(false)
    }
  }

  const usageText = usage
    ? `Index usage: ${(usage.totalBytes / 1024).toFixed(2)} KB / 12 KB`
    : 'Index usage: — / 12 KB'

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-vault-primary text-white font-semibold py-3 rounded-xl shadow-sm hover:bg-vault-accent/90 transition-colors"
        aria-label="Link a new cloud pointer"
      >
        + Link Cloud Pointer
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative z-10">
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              Link cloud pointer
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Pointer metadata only — no asset bytes are uploaded.
            </p>
            <CloudSelector value={provider} onChange={onProviderChange} />
            <form onSubmit={handleLink} className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Pointer name
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Project brief"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-primary"
              />
              <label className="block text-xs font-semibold text-slate-700">
                Remote file ID
              </label>
              <input
                value={fileId}
                onChange={(event) => setFileId(event.target.value)}
                placeholder="Provider resource id (pointer only)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-primary"
              />
              <label className="block text-xs font-semibold text-slate-700">
                Web view URL (optional)
              </label>
              <input
                value={webViewUrl}
                onChange={(event) => setWebViewUrl(event.target.value)}
                placeholder="https://..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-primary"
              />
              <div className="flex items-start gap-3">
                <input
                  id="seal"
                  type="checkbox"
                  checked={seal}
                  onChange={() => setSeal(!seal)}
                  className="mt-1 rounded text-vault-primary focus:ring-vault-primary"
                />
                <label htmlFor="seal" className="text-sm text-slate-700 leading-snug">
                  Encrypt pointer with passphrase (shared with 04 CTL Relay)
                </label>
              </div>
              {seal && (
                <>
                  <label className="block text-xs font-semibold text-slate-700">
                    Passphrase
                  </label>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-primary"
                  />
                </>
              )}
              <p className="text-xs text-slate-500">{usageText}</p>
              {message && (
                <p
                  className={`text-sm rounded-lg p-2 ${
                    message.startsWith('Failed')
                      ? 'bg-red-50 text-red-800'
                      : 'bg-green-50 text-green-800'
                  }`}
                >
                  {message}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setMessage(null)
                  }}
                  className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-vault-primary text-white disabled:opacity-50"
                >
                  {submitting ? 'Linking…' : 'Link pointer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

