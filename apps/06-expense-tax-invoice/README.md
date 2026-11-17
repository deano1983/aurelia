# 06 — B2B Corporate Expense Checkout & Tax Invoice Generator

Functionality from velvetcadence page:
- 100% Expensable Australian Tax Invoice
- ABN 61 794 639 443
- Pre-coded under Professional Development / Executive Communications & PR
- 1-click Finance Approval Memo
- Select Product Door / Subscription Tier
- Executive / Buyer Name, Company / Entity Name

## Recommended tech stack
| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| UI | React + Vite | Form wizard (tier → buyer → invoice → memo) |
| PDF | jsPDF + jsPDF-autotable | Instant Australian Tax Invoice PDF, client-side |
| Tax calc | Decimal.js | GST/AUD calculations, no float errors |
| Storage | localStorage | Draft invoices, buyer directory |

## Interlink dependencies
- Invoice due dates → **01 Timeline** (hard report deadline)
- Subscription tier selected → **07 Affiliate Engine** (partner attribution / commission)
- Invoice PDF can attach to **02 Asset Vault** as cloud proof pointer

## Suggested folders
```
06-expense-tax-invoice/
  src/
    components/  TierSelector, BuyerForm, InvoicePreview, FinanceMemo
    utils/       gstCalculator, abnValidator, pdfGenerator
  index.html
  package.json
```
