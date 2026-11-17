# 00 — Central Hub (Aurelia OS Command Suite)

Purpose: Entry point and cross-app orchestrator for the 7 symbiotic Aurelia OS spin-off apps.

## Why a central hub?
All 7 apps share:
- **Single user identity / session** (sender, creator, executive profile)
- **Shared encrypted vault keys** (CTL relay + Asset Vault)
- **Cross-app deep links** (`#ctl=` packet handoffs, cloud proof pointers)
- **Unified timeline** (deadlines from Tax Invoice, Affiliate payouts, Voice Note drafts)
- **Global navigation** between apps without re-auth

## Recommended stack
- **Vite + React** (or vanilla JS if you want zero build step)
- **localStorage / IndexedDB** for client-only session state
- **Hash-router** for deep linking between apps (`#ctl=`, `#vault=`, etc.)
- **Tailwind CSS** for shared design system

## Structure
```
00-central-hub/
  index.html          # Hub dashboard / app launcher
  apps.json           # Registry of the 7 sub-apps (name, route, icon, deps)
  shared/             # Cross-app utilities (crypto, storage, auth stub)
  assets/
```

## Interlink points
| From | To | Link mechanism |
|------|----|----------------|
| C.T.L. Relay | Voice Studio | Attach voice note as cloud proof pointer |
| Asset Vault | Timeline | Export asset deadline to .ics |
| Tax Invoice | Affiliate Engine | Attribute invoice to partner channel |
| Voice Studio | Affiliate Engine | Generated draft → partner pitch |
| All | Hub | Global nav + shared passphrase vault |
