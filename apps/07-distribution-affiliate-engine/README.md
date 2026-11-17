# 07 — Zero-Ad-Spend Distribution & Partner Affiliate Engine

Functionality from velvetcadence page:
- 30%–35% Recurring commissions
- 1-Click copyable outbound partner pitches & viral loops
- 3 distribution hubs:
  1. LinkedIn Ghostwriters / Personal Brand Agencies (Velvet Cadence — 30% Recurring)
  2. Executive Assistant (EA) Networks / Virtual PA Agencies (Sovereign Brief — $100 Bounty / 25%)
  3. TikTok / IG Reels UGC / Creator Coaches (GlowGrid Studio — 35% Recurring)
- Select Distribution Partner Channel
- Assisted 2-Tap Native Handoff Close

## Recommended tech stack
| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| UI | React + Vite | Channel selector, pitch templates, one-click copy |
| Commissions | Decimal.js | Recurring 30/25/35% calculations |
| Storage | localStorage | Partner registry, pitch history, commission ledger |
| Export | Copy to clipboard, .csv export | Pitches, partner list |

## Interlink dependencies
- Receives approved LinkedIn drafts from **04 CTL Relay**
- Receives rate cards from **05 GlowGrid Studio**
- Receives subscription tier attribution from **06 Tax Invoice**
- Payout dates → **01 Timeline**

## Suggested folders
```
07-distribution-affiliate-engine/
  src/
    components/  ChannelSelector, PitchTemplates, CommissionLedger, CopyButton
    utils/       commissionCalc, pitchGenerator
  index.html
  package.json
```
