# 04 — C.T.L. Encrypted Interoffice Approval & Chat Relay

Functionality from velvetcadence page:
- AES-256-GCM · Zero-Plaintext End-to-end encryption
- PBKDF2-SHA256 120,000 rounds
- Passphrases never touch storage
- URL `#ctl=` handoff links keep ciphertext in browser hash fragment (nothing sent to static servers)
- Sender Desk / Role, Recipient Role, Channel / Subject
- Shared Room Passphrase (min 6 chars)
- Attach Cloud Proof Pointer (optional)
- Confidential Interoffice Note / Sign-Off Instruction
- "Seal & Encrypt Packet" / "Decrypt Incoming CTL Packet"

## Recommended tech stack
| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| UI | Vanilla JS or React + Vite | Pure frontend; can be a single-page app with no build step if desired |
| Crypto | Web Crypto API (SubtleCrypto) | PBKDF2-SHA256 + AES-256-GCM entirely client-side |
| Transport | URL hash fragment (`#ctl=`) | Zero server involvement — ciphertext never leaves browser |
| Storage | Session-only (no persistence) | Passphrases never touch storage per requirements |

## Interlink dependencies
- Receives voice drafts from **03 Voice Studio**
- Accepts cloud proof pointers from **02 Asset Vault**
- LinkedIn draft approval feeds **07 Affiliate Engine**
- Shared passphrase vault with **02 Asset Vault**

## Suggested folders
```
04-ctl-encrypted-relay/
  src/
    crypto/      sealPacket, openPacket, derivePassphraseKey
    url/         encodeCtlLink, decodeCtlLink
    components/  SenderForm, RecipientForm, EncryptButton, DecryptBox
  index.html
```
