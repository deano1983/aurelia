export type ExpenseCategory = 'professional-development'
export type ExpenseSubCategory = 'executive-communications-pr'

export interface SubscriptionTier {
  id: string
  door: string
  name: string
  priceCents: number
  interval: 'month' | 'year'
  category: ExpenseCategory
  subCategory: ExpenseSubCategory
  affiliatePartnerId?: string
}

export interface BuyerDetails {
  executiveName: string
  companyEntityName: string
  email: string
  addressLine1: string
  addressLine2: string
  suburb: string
  postcode: string
  state: string
}

export interface InvoiceLine {
  description: string
  quantity: number
  unitExGstCents: number
  exGstCents: number
  gstCents: number
  totalCents: number
}

export interface Invoice {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  abn: string
  sellerName: string
  buyer: BuyerDetails
  lines: InvoiceLine[]
  exGstCents: number
  gstCents: number
  totalCents: number
  category: ExpenseCategory
  subCategory: ExpenseSubCategory
  tierId?: string
}