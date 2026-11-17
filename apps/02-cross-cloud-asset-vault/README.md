# 02 — Cross-Cloud Zero-Blob Asset Vault

Functionality from velvetcadence page:
- Index New Cross-Cloud Asset Pointer (Zero Server Upload)
- Apple iCloud (iOS/macOS), Microsoft OneDrive (Windows), Google Drive (Android/Workspace)
- $0.00 Egress
- 12 KB Index / pointer only — no file bytes stored
- "+ Link Cloud Pointer"
- Velvet Cadence: 90-Second Voice Note + Cloud Proof

## Recommended tech stack
| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| UI | React + Vite | Cloud provider selector, pointer list, drag-and-drop |
| Storage | IndexedDB (local) | 12 KB pointer index fits easily; no server upload |
| Cloud auth | OAuth 2.0 (implicit/PKCE) | iCloud, OneDrive, Google Drive each need OAuth; handled in-browser, no backend |
| Crypto | Web Crypto API | PBKDF2-SHA256 + AES-256-GCM for pointer encryption (shared with 04 CTL) |
| Styling | Tailwind CSS | Consistent with hub |

## Interlink dependencies
- Stores cloud proof pointers for **03 Voice Studio** and **04 CTL Relay**
- Receives .ics exports from **01 Timeline** as pointer assets
- Shared encryption keys with **04 CTL Relay** (passphrase-derived)

## Suggested folders
```
02-cross-cloud-asset-vault/
  src/
    components/  CloudSelector, PointerList, LinkPointerButton
    crypto/      deriveKey, encryptPointer, decryptPointer
    providers/   iCloudProvider, OneDriveProvider, GoogleDriveProvider
  index.html
  package.json
```
