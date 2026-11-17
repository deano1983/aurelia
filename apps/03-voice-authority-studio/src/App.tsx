import { useCallback, useMemo, useState } from 'react'
import type { Audience, Draft, ProofPointer, VoiceStyle } from './types'
import { generateDrafts } from './drafts/generateDrafts'
import { buildCtlLink } from './utils/ctlLink'
import { VoiceRecorder } from './components/VoiceRecorder'
import { DraftCards } from './components/DraftCards'
import { StyleSelector } from './components/StyleSelector'
import { AudienceSelector } from './components/AudienceSelector'

const EMPTY_PROOF: ProofPointer = { source: 'manual', url: '', label: '' }

export default function App() {
  const [style, setStyle] = useState<VoiceStyle>('executive')
  const [audience, setAudience] = useState<Audience>('linkedin-executives')
  const [proofPointer, setProofPointer] = useState<ProofPointer>({
    ...EMPTY_PROOF,
  })
  const [passphrase, setPassphrase] = useState('')
  const [status, setStatus] = useState<
    'idle' | 'recording' | 'transcribing' | 'generating' | 'drafts' | 'sending'
  >('idle')
  const [transcript, setTranscript] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ctlLink, setCtlLink] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const selectedDraft = useMemo(
    () => drafts.find((d) => d.id === selectedId) ?? null,
    [drafts, selectedId],
  )

  const handleTranscriptReady = useCallback(
    (next: string) => {
      setTranscript(next)
      setStatus('generating')
      const nextDrafts = generateDrafts(next, audience)
      const edited = nextDrafts.map((d) => ({ ...d }))
      setDrafts(edited)
      setSelectedId(edited[0]?.id ?? null)
      setStatus('drafts')
    },
    [audience],
  )

  const handleEdit = useCallback(
    (id: string, body: string) => {
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, body } : d)),
      )
    },
    [],
  )

  const handleSendToCtl = useCallback(async () => {
    if (!selectedDraft) return
    if (!passphrase || passphrase.length < 6) {
      setLinkError('Set a shared passphrase (min 6 chars) to seal the CTL packet.')
      return
    }
    setStatus('sending')
    setLinkError(null)
    try {
      const link = await buildCtlLink({
        draft: selectedDraft,
        proofPointer: proofPointer.url ? proofPointer : null,
        passphrase,
      })
      setCtlLink(link)
      setStatus('drafts')
    } catch {
      setLinkError('Failed to build CTL deep link.')
      setStatus('drafts')
    }
  }, [selectedDraft, proofPointer, passphrase])

  const handleCopyLink = useCallback(async () => {
    if (!ctlLink) return
    await navigator.clipboard.writeText(ctlLink)
    setCopied('link')
    setTimeout(() => setCopied(null), 1500)
  }, [ctlLink])

  const handleOpenCtl = useCallback(() => {
    if (!ctlLink) return
    window.open(ctlLink, '_blank')
  }, [ctlLink])

  const hasDrafts = drafts.length > 0
  const canSend = hasDrafts && !!selectedDraft && !!selectedDraft.body.trim()

  return (
    <div className="min-h-screen bg-voice-surface">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-lg">
              🎙️
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Velvet Cadence
              </h1>
              <p className="text-[11px] text-slate-500 font-medium tracking-wider uppercase">
                Voice-to-Authority Studio
              </p>
            </div>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
              status === 'idle'
                ? 'bg-slate-100 text-slate-500'
                : 'bg-violet-100 text-violet-700'
            }`}
          >
            App 03
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 gap-6">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left: configuration + capture */}
          <div className="lg:col-span-4 space-y-6">
            <StyleSelector style={style} onChange={setStyle} />
            <AudienceSelector audience={audience} onChange={setAudience} />

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Cross-Cloud Proof Pointer (from 02 Asset Vault)
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    value={proofPointer.url}
                    onChange={(e) =>
                      setProofPointer({ ...proofPointer, url: e.target.value })
                    }
                    placeholder="https://vault.example/assets/…"
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                  <select
                    value={proofPointer.source}
                    onChange={(e) =>
                      setProofPointer({
                        ...proofPointer,
                        source: e.target.value as ProofPointer['source'],
                      })
                    }
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    <option value="manual">Manual</option>
                    <option value="02-asset-vault">02 Asset Vault</option>
                  </select>
                </div>
                <input
                  value={proofPointer.label}
                  onChange={(e) =>
                    setProofPointer({ ...proofPointer, label: e.target.value })
                  }
                  placeholder="Label (e.g. Q3 board deck)"
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
                <p className="text-[10px] text-slate-400">
                  Attached to the CTL packet as the cloud proof pointer.
                </p>
              </div>
            </section>

            <VoiceRecorder
              onTranscriptReady={handleTranscriptReady}
              onAudioReady={() => {}}
            />
          </div>

          {/* Right: drafts + CTL send */}
          <div className="lg:col-span-8 space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Generated Drafts
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Three editable authority drafts from your transcript
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                    transcript ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {transcript ? 'Transcript captured' : 'No transcript yet'}
                </span>
              </div>

              {transcript && (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {transcript}
                </div>
              )}

              <DraftCards
                drafts={drafts}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onEdit={handleEdit}
                onCopy={(id) => {
                  setCopied(id)
                  setTimeout(() => setCopied(null), 1200)
                }}
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">
                  Send to 04 C.T.L. Relay
                </h3>
              </div>
              <div className="space-y-3">
                <input
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  type="password"
                  placeholder="Shared passphrase (min 6 chars)"
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50 w-full"
                />
                <button
                  onClick={handleSendToCtl}
                  disabled={!canSend || !passphrase || passphrase.length < 6}
                  className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 ${
                    canSend && passphrase.length >= 6
                      ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-600/30'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {status === 'sending' ? 'Sealing packet…' : 'Seal & Build #ctl= Link'}
                </button>
                {linkError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                    {linkError}
                  </div>
                )}
              </div>
              {ctlLink && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Deep link (#ctl=)
                    </h4>
                    {copied === 'link' && (
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                        Copied
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input
                      readOnly
                      value={ctlLink}
                      className="flex-1 text-xs text-slate-600 break-all border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Copy
                    </button>
                    <button
                      onClick={handleOpenCtl}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700"
                    >
                      Open in 04 CTL Relay
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    The sealed packet carries your selected draft as the
                    confidentialNote and the attached proof pointer. Open the
                    link in App 04 and enter the same passphrase to decrypt.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="border-t border-slate-200 bg-white p-6 mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[11px] text-slate-400">
              Interlinks: drafts → <strong>04 CTL Relay</strong> · proof pointer
              ← <strong>02 Asset Vault</strong> · distribution →{' '}
              <strong>07 Affiliate Engine</strong> · deadlines →{' '}
              <strong>01 Timeline</strong>
            </p>
            <p className="text-[11px] text-slate-400">
              Client-side only: Web Audio API · MediaRecorder · Web Speech API ·
              Web Crypto (PBKDF2-SHA256 + AES-256-GCM)
            </p>
          </div>
        </footer>
      </main>
    </div>
  )
}
