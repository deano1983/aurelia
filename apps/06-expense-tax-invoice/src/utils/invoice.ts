import type { BuyerDetails, Invoice, InvoiceLine, SubscriptionTier } from '../types'
import {
  ABN,
  DEFAULT_PAYMENT_TERMS_DAYS,
  EXPENSE_CATEGORY,
  EXPENSE_SUBCATEGORY,
  SELLER_NAME,
} from './constants'
import { exGstCentsFromTotal, gstCentsFromTotal } from './currency'
import { addDays, generateInvoiceNumber } from './invoiceNumber'

export function buildInvoice(
  tier: SubscriptionTier | null,
  buyer: BuyerDetails,
  dueDate: string,
  invoiceNumber: string = generateInvoiceNumber(),
): Invoice | null {
  if (!tier) return null

  const issueDate = new Date().toISOString().slice(0, 10)
  const resolvedDueDate = dueDate || addDays(issueDate, DEFAULT_PAYMENT_TERMS_DAYS)

  const lineTotalCents = tier.priceCents
  const lineExGst = exGstCentsFromTotal(lineTotalCents)
  const lineGst = gstCentsFromTotal(lineTotalCents)

  const lines: InvoiceLine[] = [
    {
      description: `${tier.name} — ${tier.door} subscription (${tier.interval})`,
      quantity: 1,
      unitExGstCents: lineExGst,
      exGstCents: lineExGst,
      gstCents: lineGst,
      totalCents: lineTotalCents,
    },
  ]

  return {
    invoiceNumber,
    issueDate,
    dueDate: resolvedDueDate,
    abn: ABN,
    sellerName: SELLER_NAME,
    buyer,
    lines,
    exGstCents: lineExGst,
    gstCents: lineGst,
    totalCents: lineTotalCents,
    category: EXPENSE_CATEGORY,
    subCategory: EXPENSE_SUBCATEGORY,
    tierId: tier.id,
  }
}