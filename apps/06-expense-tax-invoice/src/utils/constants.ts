/** Hardcoded Australian Business Number printed on every Tax Invoice. */
export const ABN = '61 794 639 443'

export const SELLER_NAME = 'Aurelia OS'

export const SELLER_DETAILS = {
  name: 'Aurelia OS',
  addressLine1: 'Command Suite Headquarters',
  addressLine2: 'Sydney NSW 2000, Australia',
  email: 'billing@aureliaos.example',
  phone: '+61 2 0000 0000',
} as const

/** Pre-coded expense classification for this checkout flow. */
import type { ExpenseCategory, ExpenseSubCategory } from '../types'

export const EXPENSE_CATEGORY: ExpenseCategory = 'professional-development'
export const EXPENSE_SUBCATEGORY: ExpenseSubCategory = 'executive-communications-pr'

export const DEFAULT_PAYMENT_TERMS_DAYS = 14