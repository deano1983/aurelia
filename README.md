# Aurelia OS

The central hub (`apps/00-central-hub`) and its seven apps, in one npm workspace with one lockfile.

| App | Folder | Dev port |
| --- | --- | --- |
| Central Hub | `apps/00-central-hub` | 5173 |
| Daily Command Timeline | `apps/01-daily-command-timeline` | 5175 |
| Cross-Cloud Asset Vault | `apps/02-cross-cloud-asset-vault` | 5176 |
| Voice-to-Authority Studio | `apps/03-voice-authority-studio` | 5177 |
| C.T.L. Encrypted Relay | `apps/04-ctl-encrypted-relay` | 5174 |
| GlowGrid Creator Radar | `apps/05-glowgrid-creator-radar` | 5179 |
| Expense & Tax Invoice | `apps/06-expense-tax-invoice` | 5180 |
| Distribution & Affiliate Engine | `apps/07-distribution-affiliate-engine` | 5178 |

## Commands

```bash
npm ci                 # one install for all eight apps
npm run build          # build every app on its own (base /, for dev and native)
npm run build:site     # build all eight for ONE origin into ./site
                       #   site/            hub
                       #   site/apps/<app>/ each app
npm run dev:hub        # hub on :5173; run each app's `npm run dev` for its card to work
```

Deploy `./site` to any static host. Every app lives under `/apps/<folder>/`, so all eight share one origin, one sign-in and one storage.

## App manifests

Each app folder has an `aurelia.app.json` (schema: `packages/core/app.schema.json`, types and validator: `@aurelia/core/manifest`). It declares the app's id, folder, name, tagline, accent, route, Capacitor `nativeId`, the events it `emits`/`accepts` (from `EVENT_CATALOG`), the hash `deepLinks` it handles, the `storageKeys` it owns (each `aurelia.<id>.…`) and its `dependencies`. The hub's app grid and Download Center are built from these files at build time, so adding or renaming an app means editing its manifest, not the hub.

```bash
npm run check:manifests   # validate every manifest (also runs in CI); legacy storage keys print as warnings
```

### External sites

Other business sites can appear on the hub grid as `kind: "external"` cards. List them in the root `registry.external.json` (a JSON array, empty by default). Use ids 50-99, a `folder` of `<id>-<slug>` (no folder is created), an `https://` `url`, and no `route`/`nativeId`. For example, to add Pacific Dwellings:

```json
[
  {
    "id": "50",
    "slug": "pacific-dwellings",
    "folder": "50-pacific-dwellings",
    "name": "Pacific Dwellings",
    "tagline": "Short description shown on the card",
    "version": "1.0.0",
    "status": "active",
    "kind": "external",
    "url": "https://pacific-dwellings.example",
    "emoji": "🏡",
    "accent": "gold"
  }
]
```

Run `npm run check:manifests`, then `npm run build:site`; the card opens the site in a new tab.

## CI

- `.github/workflows/ci.yml`: every PR and push to main runs `npm ci`, `npm test`, `npm run check:manifests`, typechecks and builds all eight, uploads the site, and scans for secrets.
- `.github/workflows/native.yml`: Android APKs, on `v*` tags or a manual run. See `NATIVE_BUILD_GUIDE.md`.

## Contract

The rules every app follows (sign-in, events, tokens, manifests, tests) are in the Aurelia hub contract:
https://claude.ai/artifact/4h3nZ2jgXcpoJAcUJqg3xT

Imported from `deano1983/PDgithub` branch `cline/4tqt8m3y` at e459af5.
