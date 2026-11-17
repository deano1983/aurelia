import { useState, useCallback, useEffect } from 'react'
import type { DistributionChannel, PitchHistory } from '../types'
import { CopyButton } from './CopyButton'
import { channelLabel } from '../utils/commissionCalc'
import { loadJSON, saveJSON, STORAGE_KEYS } from '../utils/storage'

interface PitchTemplatesProps {
  channel: DistributionChannel
  /** Prefill the draft link field from an inbound 04 CTL Relay deep link. */
  prefillDraft?: string | null
  /** Prefill the partner name field from an inbound 05/06 deep link. */
  prefillPartner?: string | null
}

const TEMPLATES: Record<
  DistributionChannel,
  { id: string; name: string; subject: string; body: string }
> = {
  'velvet-cadence': {
    id: 'vc-linkedin',
    name: 'LinkedIn Ghostwriter Outreach',
    subject:
      'Partner pitch: 30% recurring — Velvet Cadence × Aurelia OS',
    body:
      "Hi {{partner_name}},\n\nI've been running my LinkedIn executive presence on Aurelia OS and think the Velvet Cadence ghostwriter network is a perfect fit. You earn 30% recurring commission on every referral, with approved LinkedIn drafts ready to share.\n\nBest,\n{{your_name}}\n{{draft_link}}",
  },
  'sovereign-brief': {
    id: 'sb-ea',
    name: 'EA Network Outreach',
    subject:
      'Partner pitch: $100 bounty + 25% recurring — Sovereign Brief × Aurelia OS',
    body:
      'Hi {{partner_name}},\n\nSovereign Brief EAs and virtual PAs can earn a $100 one-time bounty plus 25% recurring commission on every executive referral to Aurelia OS.\n\nBest,\n{{your_name}}',
  },
  'glowgrid-studio': {
    id: 'gg-ugc',
    name: 'UGC Creator Coach Outreach',
    subject:
      'Partner pitch: 35% recurring — GlowGrid Studio × Aurelia OS',
    body:
      'Hi {{partner_name}},\n\nGlowGrid creators get 35% recurring commission on UGC creator referrals to Aurelia OS — copy your one-click pitch below and start your viral loop.\n\nBest,\n{{your_name}}',
  },
}

const VARIABLES = ['partner_name', 'your_name', 'draft_link'] as const

const EMPTY_FORM: Record<string, string> = {
  partner_name: '',
  your_name: '',
  draft_link: '',
}

export function PitchTemplates({
  channel,
  prefillDraft,
  prefillPartner,
}: PitchTemplatesProps) {
  const template = TEMPLATES[channel]
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY_FORM })
  const [history, setHistory] = useState<PitchHistory[]>(() =>
    loadJSON(STORAGE_KEYS.pitches, []),
  )

  // Apply deep-link prefill values once the form is empty (e.g. approved
  // LinkedIn draft from 04 CTL Relay, or partner name from 05/06).
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      ...(prefillDraft && !prev.draft_link
        ? { draft_link: prefillDraft }
        : {}),
      ...(prefillPartner && !prev.partner_name
        ? { partner_name: prefillPartner }
        : {}),
    }))
  }, [prefillDraft, prefillPartner])

  const rendered = useCallback(() => {
    let subject = template.subject
    let body = template.body
    Object.entries(form).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      subject = subject.replace(regex, value)
      body = body.replace(regex, value)
    })
    return { subject, body }
  }, [template, form])

  const handleChange = useCallback(
    (key: string, value: string) => {
      setForm({ ...form, [key]: value })
    },
    [form],
  )

  const recordPitchHistory = useCallback(() => {
    const entry: PitchHistory = {
      id: crypto.randomUUID(),
      templateId: template.id,
      channel,
      copiedAt: new Date().toISOString(),
    }
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 50)
      saveJSON(STORAGE_KEYS.pitches, next)
      return next
    })
  }, [template.id, channel])

  const handleHandoff = useCallback(() => {
    const { subject, body } = rendered()
    const mailto =
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    void navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
    recordPitchHistory()
    window.location.href = mailto
  }, [rendered, recordPitchHistory])

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Pitch Templates</h2>
          <p className="text-xs text-slate-500">
            1-click copyable outbound pitch for {channelLabel(channel)}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-2 py-1 rounded bg-slate-100">
          {channelLabel(channel)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {VARIABLES.map((key) => (
          <div key={key} className="col-span-2 md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {key.replace('_', ' ')}
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              value={form[key] ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={`{{${key}}}`}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-slate-200 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Preview</h3>
          <div className="text-sm text-slate-700 font-mono mb-1">{rendered().subject}</div>
          <div className="text-sm text-slate-600 whitespace-pre-wrap">{rendered().body}</div>
        </div>
        <div className="space-y-3">
          <CopyButton
            text={`Subject: ${rendered().subject}\n\n${rendered().body}`}
            label="Copy pitch to clipboard"
            onCopied={recordPitchHistory}
          />
          <button
            onClick={handleHandoff}
            className="w-full py-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            📤 2-Tap Native Handoff Close
          </button>
          <p className="text-xs text-slate-400">
            Copies the pitch, then opens your mail client to send.
          </p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Pitch History</h3>
          <ul className="space-y-2 text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="flex justify-between items-center p-2 rounded bg-slate-50">
                <span className="font-medium text-slate-700">
                  {channelLabel(entry.channel)}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(entry.copiedAt).toLocaleString('en-AU', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

