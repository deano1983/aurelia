export function generateInvoiceNumber(): string {
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  const seq = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `INV-${ymd}-${seq}`
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}