import { useCallback, useMemo, useState } from 'react'
import type { CommissionEntry, CommissionStatus, DistributionPartner } from '../types'
import {
  commissionForChannel,
  channelLabel,
  formatAUD,
} from '../utils/commissionCalc'
import { loadJSON, saveJSON, STORAGE_KEYS } from '../utils/storage'
import { buildTimelinePayoutUrl, traceInterlink } from '../utils/interlinks'

interface CommissionLedgerProps {
  partners: DistributionPartner[]
}

const MONTHS_BACK = 6

function monthOptions(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < MONTHS_BACK; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export function CommissionLedger({ partners }: CommissionLedgerProps) {
  const [entries, setEntries] = useState<CommissionEntry[]>(() =>
    loadJSON(STORAGE_KEYS.ledger, []),
  )
  const [draft, setDraft] = useState<{
    partnerId: string
    subscriptionCents: number
    month: string
    status: CommissionStatus
  }>({
    partnerId: partners[0]?.id ?? '',
    subscriptionCents: 0,
    month: monthOptions()[0] ?? '',
    status: 'pending',
  })

  const handleAdd = useCallback(() => {
    const partner = partners.find((p) => p.id === draft.partnerId)
    if (!partner) return
    const commissionCents = commissionForChannel(
      draft.subscriptionCents,
      partner.channel,
    )
    const entry: CommissionEntry = {
      id: crypto.randomUUID(),
      partnerId: draft.partnerId,
      channel: partner.channel,
      subscriptionCents: draft.subscriptionCents,
      commissionRatePercent: partner.commissionRatePercent,
      commissionCents,
      recurring: true,
      month: draft.month,
      status: draft.status,
    }
    setEntries((prev) => [entry, ...prev])
    saveJSON(STORAGE_KEYS.ledger, [entry, ...entries])
    traceInterlink('07', 'commission-added', {
      partnerId: draft.partnerId,
      channel: partner.channel,
      commissionCents,
    })
  }, [draft, partners, entries])

  const handlePay = useCallback((entry: CommissionEntry) => {
    const payoutDate = new Date().toISOString().slice(0, 10)
    const update = {
      ...entry,
      status: 'paid' as CommissionStatus,
      paidAt: new Date().toISOString(),
      payoutDate,
    }
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? update : e)))
    saveJSON(STORAGE_KEYS.ledger, entries.map((e) => (e.id === entry.id ? update : e)))
    const partner = partners.find((p) => p.id === entry.partnerId)
    const url = buildTimelinePayoutUrl({
      title: `Affiliate payout — ${channelLabel(entry.channel)}`,
      due: payoutDate,
      desc: `Commission ${formatAUD(entry.commissionCents)} for ${entry.month}`,
      tags: ['hard-report-deadline'],
    })
    traceInterlink('01', 'payout-date-set', {
      entryId: entry.id,
      partnerId: entry.partnerId,
      amountCents: entry.commissionCents,
      payoutDate,
    })
    void partner
    void url
    window.dispatchEvent(
      new CustomEvent('affiliate:payout-scheduled', { detail: { url, entry } }),
    )
  }, [partners, entries])

  const summary = useMemo(() => {
    const totalSubscription = entries.reduce(
      (sum, e) => sum + e.subscriptionCents,
      0,
    )
    const totalCommission = entries.reduce((sum, e) => sum + e.commissionCents, 0)
    const pending = entries.filter((e) => e.status === 'pending')
    const pendingCommission = pending.reduce(
      (sum, e) => sum + e.commissionCents,
      0,
    )
    return {
      totalSubscription,
      totalCommission,
      pendingCommission,
      pendingCount: pending.length,
    }
  }, [entries])

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Commission Ledger</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Subscriptions
          </p>
          <p className="text-sm font-bold text-slate-800">
            {formatAUD(summary.totalSubscription)}
          </p>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Total commission
          </p>
          <p className="text-sm font-bold text-emerald-700">
            {formatAUD(summary.totalCommission)}
          </p>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Pending payout
          </p>
          <p className="text-sm font-bold text-amber-700">
            {formatAUD(summary.pendingCommission)}
          </p>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Pending entries
          </p>
          <p className="text-sm font-bold text-slate-800">
            {summary.pendingCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 md:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Partner
          </label>
          <select
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            value={draft.partnerId}
            onChange={(e) => setDraft({ ...draft, partnerId: e.target.value })}
          >
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {channelLabel(p.channel)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Subscription (cents)
          </label>
          <input
            type="number"
            min="0"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            value={draft.subscriptionCents}
            onChange={(e) =>
              setDraft({ ...draft, subscriptionCents: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Month
          </label>
          <select
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            value={draft.month}
            onChange={(e) => setDraft({ ...draft, month: e.target.value })}
          >
            {monthOptions().map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={handleAdd}
            className="w-full py-2.5 rounded-lg border border-transparent bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
          >
            Add entry
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
              <th className="px-4 py-3 font-semibold">Month</th>
              <th className="px-4 py-3 font-semibold">Partner</th>
              <th className="px-4 py-3 font-semibold">Channel</th>
              <th className="px-4 py-3 font-semibold text-right">Subscription</th>
              <th className="px-4 py-3 font-semibold text-right">Rate</th>
              <th className="px-4 py-3 font-semibold text-right">Commission</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Payout → 01 Timeline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {entries.map((entry) => {
              const partner = partners.find((p) => p.id === entry.partnerId)
              const paid = entry.status === 'paid'
              return (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{entry.month}</td>
                  <td className="px-4 py-3">{partner?.name ?? entry.partnerId}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {channelLabel(entry.channel)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {formatAUD(entry.subscriptionCents)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {entry.commissionRatePercent}%
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {formatAUD(entry.commissionCents)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                        paid
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : entry.status === 'clawed-back'
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}
                    >
                      {paid
                        ? 'Paid'
                        : entry.status === 'clawed-back'
                          ? 'Clawed back'
                          : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {paid || entry.status === 'clawed-back' ? (
                      entry.payoutDate ?? '—'
                    ) : (
                      <button
                        onClick={() => handlePay(entry)}
                        className="text-xs font-medium text-emerald-600 hover:underline"
                      >
                        Schedule payout
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                  No commission entries yet. Add your first entry above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}


