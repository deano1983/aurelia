# Chat and C.T.L. packet security

This page describes what Aurelia's encrypted chat and the C.T.L. `#ctl=` packets protect, what they do not protect, and what we plan to improve. It is written for executives, assistants and the people who run Aurelia. The code is in `packages/core/src/chat` and `packages/core/src/crypto`. The database side is in `supabase/migrations/0004_chat.sql`.

## The short version

- Chat messages are encrypted on your device before they leave it. Aurelia's servers, the Supabase administrator, and anyone who steals a database backup see only scrambled bytes.
- Each device has its own keys. They are created in the browser and stored there so that JavaScript cannot read them out. The server only ever receives the **public** halves.
- The server can still see who talks to whom, and when. It cannot see what is said.
- To be sure nobody has slipped a fake key into a conversation, compare **safety numbers** with the other person in person or on a call.

## How it works

| Piece | What it is |
|---|---|
| Device identity | Every device creates two P-256 key pairs with WebCrypto: an ECDH pair for receiving room keys and an ECDSA pair for signing messages. The private keys are created **non-extractable** and kept as `CryptoKey` objects in IndexedDB (`aurelia-chat`). Only the public keys are published, to `chat_devices`. |
| Room key | Each room has a random AES-256-GCM key. A new key version is made when the room is created, when someone is added or removed, and automatically whenever a sender notices that the room's set of devices has changed (a new device, a member who left, a revoked device). |
| Key delivery | The room key is wrapped separately for each member device. The wrapping key comes from ECDH between the sender's device and the recipient's device, then HKDF-SHA256 with a random salt and the room id in `info`. The wrap is AES-GCM, and its additional authenticated data (AAD) names the room, key version, sender device and recipient device. Wrapped keys are stored in `chat_room_keys`. |
| Messages | AES-256-GCM with a fresh random 96-bit IV for every message. The AAD binds the room id, sender user, sender device, per-device sequence number and key version, so a message cannot be moved to another room, attributed to another sender, replayed under another sequence number, or relabelled to another key version. The sender's device also signs the result (ECDSA P-256), so even another member of the room cannot forge a message in your name. `chat_messages` holds only the IV, the ciphertext and the signature. |
| Delivery | New rows reach other members through Supabase Realtime (`postgres_changes` on `chat_messages`, filtered by room). Older messages are loaded by a normal query. Row-level security applies to both. |
| Safety numbers | Each device's fingerprint is SHA-256 over its user id and both public keys, shown as 30 digits. Two people compare a 60-digit safety number (both fingerprints sorted, in 12 groups of 5). A match means no one substituted keys between those two devices. Verification is remembered on your device and is cleared automatically if that device's keys ever change. |

### Server-side rules (row-level security)

- Only members of a room can read its room record, member list, wrapped keys and messages. Only members can post, and only as themselves, from one of their own devices that has not been revoked.
- Only the room owner can add members or remove other members. Any member except the owner can leave.
- Users can register, label and revoke only their own devices. A device's public keys and owner can never be changed after registration (a database trigger enforces this), so a key change always shows up as a new device with a new safety number.
- You can see another person's device keys only if you share a room with them, or if that device sent a message or delivered a key in one of your rooms.
- Invitations resolve an email address to a user id through `chat_resolve_user`. It works only for signed-in callers, and only finds people who have used chat at least once.

## What the server and a Supabase administrator can and cannot see

**Cannot see:**
- Message text, including sealed C.T.L. packets dropped into chat.
- Room keys, and any private key of any device.
- Room passphrases (they are never sent or stored, see below).

**Can see (metadata):**
- Who is a member of which room, who owns it, and when members joined.
- **Room names.** These are not encrypted in v1, so avoid putting sensitive information in a room name.
- When each message was sent, who sent it, from which device, and roughly how long it is.
- Each device's public keys, its label (for example "C.T.L. Relay on Mac"), and when it was registered or revoked.
- Which email addresses belong to chat users (through invitation lookups).
- IP addresses and timing, as with any web service.

**Could do, if the server were malicious or compromised:**
- Withhold, delay or reorder messages, or drop someone from a room. The server cannot read or forge messages, but it can deny service.
- Register a **ghost device** for a user, so that new room keys are also wrapped for that device. This is the main active attack on any server-assisted end-to-end encryption scheme, and safety numbers are the defence: the ghost device appears in the room's device list as a new, unverified device. Executives should verify each other's devices and treat an unexpected new device as an alarm.
- Serve modified JavaScript. Like every web app, Aurelia trusts the code the origin delivers. The native (Capacitor) builds reduce this risk because their code is fixed at install time.

## Device loss and new devices

- **Lost or stolen device:** sign in elsewhere and revoke the lost device. Revoked devices receive no new room keys, and the next message in each room re-keys automatically. The thief can still read anything that was already on the device, or that was sent under room keys it already held, until those rooms re-key. Device keys are protected by the browser and the operating system (screen lock, disk encryption), not by a separate PIN in v1.
- **New device or cleared browser data:** this creates a new device identity. It can read messages sent after the next re-key, which happens automatically the next time any member sends. **It cannot read older messages.** There is no server-side key backup in v1. That is deliberate: a server-side backup would give the server something worth stealing.
- **Leaving or removal:** the room is re-keyed. When an owner removes someone, the re-key happens immediately. When someone leaves, the next sender re-keys. After that, the person who left has no key for new messages, and row-level security also stops them reading new rows.
- New members cannot read messages sent before they joined, because those messages use earlier key versions that were never wrapped for them.

## Limits of v1, and the path forward

1. **No per-message forward secrecy.** Messages under one room key version share that key. Anyone who later extracts a device's state (for example by malware on an unlocked device) can decrypt every message of every key version that device held and still has ciphertext for. Re-keying on membership changes limits this, but it is not the per-message ratchet that Signal provides.
   - *Next steps:* time-based re-keying (for example daily or every N messages) and deleting old room keys from devices after a retention period. After that, move to MLS (RFC 9420), whose TreeKEM gives forward secrecy and post-compromise security for groups, using the same device identities and directory.
2. **No consensus on room state.** Any member can publish a new key version, and a malicious member could send different keys to different devices (a "split view"). Messages are still signed, so this cannot be used to impersonate anyone, but it can disrupt a room. MLS solves this with an agreed group state.
3. **Room names and membership are metadata.** Encrypting room names under the room key is planned. Hiding the membership graph from the server is out of scope.
4. **Trust on first use.** Until safety numbers are compared, you are trusting the server's device directory. The UI marks devices as unverified until you verify them.
5. **Signatures prove the device, not the person.** A valid signature means "a device registered to this Aurelia account". Comparing safety numbers ties that account to a real person.

## C.T.L. passphrase packets (`#ctl=`)

C.T.L. packets are separate from chat rooms. They are sealed with a shared passphrase, carried in a link's `#` fragment, and opened in the 04 relay, in chat, or anywhere else with the same passphrase.

- **Format v2** (written today): PBKDF2-SHA256 with **600,000** iterations, a random 16-byte salt and 12-byte IV, and AES-256-GCM. The version, the KDF, the iteration count and the purpose (`ctl`, or `vault` for 02 pointers) are bound as AAD. As a result the iteration count can be raised later, a v2 packet cannot be passed off as a weaker v1 packet, and a vault pointer cannot be replayed as a relay packet. New packets require a passphrase of at least **12 characters**, and the relay can generate a random one. Passphrases are NFC-normalised.
- **Legacy v1 packets** (`"version":"1.0"`, 120,000 iterations, no AAD) still decrypt, so old links keep working. They are never written any more.
- The passphrase is never placed inside the packet. When signed in, the sender's chat device also **signs** the packet. The relay then shows "Signature verified" (and from which account's device) only if the signature checks out against the server's device directory. Otherwise the sender fields are labelled as claimed, not verified. An unsigned packet proves only that the sender knew the passphrase.
- The relay reads an incoming `#ctl=` fragment once and then removes it from the address bar and session history. Sealed links are shown in a copy box and are never written into the sender's URL.
- Fragments are capped at 64 KB before any decoding. Every field is validated, and decrypted fields are coerced to strings, so a malformed packet cannot crash the page.
- **Risk to keep in mind:** anyone who gets a link can try passphrases offline. A strong random passphrase (use **Generate**), shared by a different channel than the link, is what keeps a packet safe. Where both people use Aurelia, prefer an encrypted chat room, which uses random keys and needs no passphrase.
- In chat, the room passphrase is kept only in memory in the open tab. It is never saved and never sent.
