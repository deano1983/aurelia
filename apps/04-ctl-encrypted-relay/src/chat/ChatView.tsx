import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  openRoomPacket,
  type ChatClient,
  type PacketSignatureCheck,
  type ChatMessage,
  type DeviceView,
  type MemberRecord,
  type RoomRecord,
} from '@aurelia/core/chat'
import { ctlHashToPacket, ctlPacketToHash, MIN_PASSPHRASE_LENGTH, type CtlPayload } from '@aurelia/core/crypto'

type Props = {
  client: ChatClient
  /** Display name for a user id (falls back to a short id). */
  nameOf?: (userId: string) => string | undefined
  /** Puts a #ctl= fragment in the URL and switches to the relay tab. */
  onOpenInRelay?: (hash: string) => void
}

const msgKey = (m: ChatMessage) => `${m.senderDevice}:${m.seq}`

function sortMessages(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => {
    const ia = Number(a.id ?? Number.MAX_SAFE_INTEGER)
    const ib = Number(b.id ?? Number.MAX_SAFE_INTEGER)
    return ia !== ib ? ia - ib : (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
  })
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong'
}

export function LockIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function ChatView({ client, nameOf, onOpenInRelay }: Props) {
  const [rooms, setRooms] = useState<RoomRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [members, setMembers] = useState<MemberRecord[]>([])
  const [devices, setDevices] = useState<DeviceView[] | null>(null)
  const [myFingerprint, setMyFingerprint] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [newName, setNewName] = useState('')
  const [newInvitees, setNewInvitees] = useState('')
  const [invite, setInvite] = useState('')
  const [draft, setDraft] = useState('')
  const [sealDraft, setSealDraft] = useState(false)
  const [roomPassphrase, setRoomPassphrase] = useState('')
  const [showSafety, setShowSafety] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const active = rooms.find((r) => r.id === activeId) ?? null
  const isOwner = active?.ownerId === client.userId

  const display = useCallback(
    (userId: string) => (userId === client.userId ? 'You' : nameOf?.(userId) ?? `user ${userId.slice(0, 8)}`),
    [client.userId, nameOf],
  )

  const refreshRooms = useCallback(async () => {
    const list = await client.listRooms()
    setRooms(list)
    setActiveId((cur) => (cur && list.some((r) => r.id === cur) ? cur : list[0]?.id ?? null))
  }, [client])

  useEffect(() => {
    void client.fingerprint().then(setMyFingerprint)
    refreshRooms().catch((e) => setError(errorText(e)))
  }, [client, refreshRooms])

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages((cur) => {
      const map = new Map(cur.map((m) => [msgKey(m), m]))
      for (const m of incoming) map.set(msgKey(m), m)
      return sortMessages([...map.values()])
    })
  }, [])

  // Backfill + live subscription for the active room.
  useEffect(() => {
    setMessages([])
    setMembers([])
    setDevices(null)
    setShowSafety(false)
    setRoomPassphrase('')
    if (!activeId) return
    let cancelled = false
    const off = client.subscribe(activeId, (m) => {
      if (!cancelled) mergeMessages([m])
    })
    Promise.all([client.history(activeId), client.listMembers(activeId)])
      .then(([history, mem]) => {
        if (cancelled) return
        mergeMessages(history)
        setMembers(mem)
      })
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
      off()
    }
  }, [activeId, client, mergeMessages])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length])

  const loadDevices = useCallback(async () => {
    if (!activeId) return
    setDevices(await client.roomDevices(activeId))
  }, [activeId, client])

  useEffect(() => {
    if (showSafety) loadDevices().catch((e) => setError(errorText(e)))
  }, [showSafety, loadDevices])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = () =>
    run(async () => {
      const ids = newInvitees.split(/[\s,;]+/).filter(Boolean)
      const { userIds, unknown } = await client.resolveUsers(ids)
      if (unknown.length) throw new Error(`No Aurelia chat user found for: ${unknown.join(', ')}`)
      if (!userIds.length) throw new Error('Invite at least one other person (email or user id).')
      const room = await client.createRoom({ name: newName, memberUserIds: userIds })
      setNewName('')
      setNewInvitees('')
      await refreshRooms()
      setActiveId(room.id)
    })

  const handleInvite = () =>
    run(async () => {
      if (!activeId) return
      const { userIds, unknown } = await client.resolveUsers(invite.split(/[\s,;]+/).filter(Boolean))
      if (unknown.length) throw new Error(`No Aurelia chat user found for: ${unknown.join(', ')}`)
      if (userIds.length) await client.addMembers(activeId, userIds)
      setInvite('')
      setMembers(await client.listMembers(activeId))
      if (showSafety) await loadDevices()
    })

  const handleRemove = (userId: string) =>
    run(async () => {
      if (!activeId) return
      await client.removeMember(activeId, userId)
      setMembers(await client.listMembers(activeId))
      if (showSafety) await loadDevices()
    })

  const handleSend = () =>
    run(async () => {
      if (!activeId || !draft.trim()) return
      let sent: ChatMessage
      const ctlMatch = draft.match(/\S*#(?:\S*&)?ctl=[A-Za-z0-9_\-+/=%]+/)
      if (sealDraft) {
        if (roomPassphrase.length < MIN_PASSPHRASE_LENGTH) {
          throw new Error(`Set a room passphrase (min ${MIN_PASSPHRASE_LENGTH} characters) to seal.`)
        }
        // Sealed under the passphrase AND signed by this device, so the relay can verify the sender.
        const packet = await client.sealSignedCtl(
          { senderDesk: 'Aurelia Chat', channel: active?.name ?? '', confidentialNote: draft },
          roomPassphrase,
        )
        sent = await client.sendCtl(activeId, ctlPacketToHash(packet), 'Sealed with room passphrase')
      } else if (ctlMatch && ctlMatch[0].length > draft.trim().length - 40) {
        // A pasted #ctl= relay link becomes a sealed-packet message.
        sent = await client.sendCtl(activeId, ctlMatch[0], draft.replace(ctlMatch[0], '').trim() || undefined)
      } else {
        sent = await client.sendText(activeId, draft)
      }
      setDraft('')
      mergeMessages([sent])
    })

  const handleRekey = () =>
    run(async () => {
      if (!activeId) return
      await client.rotateRoomKey(activeId)
      if (showSafety) await loadDevices()
    })

  const keyVersion = useMemo(() => messages.reduce((n, m) => Math.max(n, m.keyVersion), 0), [messages])

  return (
    <div className="grid lg:grid-cols-[18rem_1fr] gap-6">
      {/* Sidebar */}
      <aside className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-900">
          <p className="font-semibold flex items-center gap-1.5">
            <LockIcon /> End-to-end encrypted
          </p>
          <p className="text-xs mt-1 text-emerald-800">
            Messages are encrypted on this device. The server stores only ciphertext and cannot read them.
          </p>
          {myFingerprint && (
            <p className="text-[11px] mt-2 font-mono text-emerald-700 break-words" data-testid="my-fingerprint">
              Your device: {myFingerprint}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow border border-slate-200 p-4 space-y-2">
          <h3 className="font-bold text-slate-900 text-sm">New room</h3>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Room name (visible to server)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="Room name"
          />
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Invite: emails or user ids, comma-separated"
            value={newInvitees}
            onChange={(e) => setNewInvitees(e.target.value)}
            aria-label="Invite members"
          />
          <button
            onClick={handleCreate}
            disabled={busy || !newInvitees.trim()}
            className="w-full py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            Create encrypted room
          </button>
        </div>

        <nav className="bg-white rounded-2xl shadow border border-slate-200 p-2" aria-label="Rooms">
          {rooms.length === 0 && <p className="text-sm text-slate-500 p-2">No rooms yet.</p>}
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                r.id === activeId ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-800'
              }`}
            >
              <span className="truncate">{r.name || 'Untitled room'}</span>
              <span className="text-[10px] uppercase opacity-70">{r.kind}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Room */}
      <section className="bg-white rounded-2xl shadow border border-slate-200 flex flex-col min-h-[32rem]">
        {error && (
          <div role="alert" className="m-4 mb-0 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm p-8">
            Create a room or select one to start an encrypted conversation.
          </div>
        ) : (
          <>
            <header className="p-4 border-b border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold text-slate-900">{active.name || 'Untitled room'}</h2>
                  <p className="text-xs text-slate-500">
                    {members.map((m) => display(m.userId)).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold"
                    data-testid="e2ee-badge"
                    title="AES-256-GCM room key, wrapped per device with ECDH P-256; messages signed with ECDSA P-256"
                  >
                    <LockIcon /> End-to-end encrypted{keyVersion ? ` · key v${keyVersion}` : ''}
                  </span>
                  <button
                    onClick={() => setShowSafety((v) => !v)}
                    className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-300 hover:bg-slate-50"
                  >
                    {showSafety ? 'Hide safety numbers' : 'Safety numbers'}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-56"
                  placeholder="Room passphrase (stays on this device)"
                  value={roomPassphrase}
                  onChange={(e) => setRoomPassphrase(e.target.value)}
                  aria-label="Room passphrase"
                />
                {isOwner && (
                  <>
                    <input
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-56"
                      placeholder="Add member: email or user id"
                      value={invite}
                      onChange={(e) => setInvite(e.target.value)}
                      aria-label="Add member"
                    />
                    <button
                      onClick={handleInvite}
                      disabled={busy || !invite.trim()}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-white disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      Add &amp; re-key
                    </button>
                  </>
                )}
                <button
                  onClick={handleRekey}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 hover:bg-slate-50"
                >
                  Re-key room
                </button>
              </div>
            </header>

            {showSafety && (
              <SafetyPanel
                devices={devices}
                members={members}
                isOwner={isOwner}
                display={display}
                onRemove={handleRemove}
                onRevoke={(d) => run(async () => {
                  await client.revokeDevice(d.deviceId)
                  await loadDevices()
                })}
                onVerify={(d, v) => run(async () => {
                  await client.setVerified(d, v)
                  await loadDevices()
                })}
                selfUserId={client.userId}
              />
            )}

            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[28rem]" data-testid="messages">
              {messages.length === 0 && <p className="text-sm text-slate-400 text-center">No messages yet.</p>}
              {messages.map((m) => (
                <MessageBubble
                  key={msgKey(m)}
                  message={m}
                  mine={m.senderUser === client.userId}
                  sender={display(m.senderUser)}
                  passphrase={roomPassphrase}
                  client={client}
                  display={display}
                  onOpenInRelay={onOpenInRelay}
                />
              ))}
            </div>

            <footer className="p-4 border-t border-slate-200 space-y-2">
              <textarea
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                rows={2}
                placeholder="Write an encrypted message, or paste a #ctl= relay link"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                aria-label="Message"
              />
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-slate-600 flex items-center gap-1.5">
                  <input type="checkbox" checked={sealDraft} onChange={(e) => setSealDraft(e.target.checked)} />
                  Also seal with room passphrase (C.T.L. packet)
                </label>
                <button
                  onClick={handleSend}
                  disabled={busy || !draft.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white disabled:bg-slate-200 disabled:text-slate-400"
                >
                  Send encrypted
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}

function MessageBubble(props: {
  message: ChatMessage
  mine: boolean
  sender: string
  passphrase: string
  client: ChatClient
  display: (userId: string) => string
  onOpenInRelay?: (hash: string) => void
}) {
  const { message: m, mine, sender, passphrase, client, display, onOpenInRelay } = props
  const time = m.createdAt ?? m.sentAt
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          m.status !== 'ok'
            ? 'bg-amber-50 border border-amber-200 text-amber-900'
            : mine
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-900'
        }`}
      >
        <p className={`text-[10px] mb-0.5 ${mine && m.status === 'ok' ? 'text-emerald-100' : 'text-slate-500'}`}>
          {sender}
          {time ? ` · ${new Date(time).toLocaleTimeString()}` : ''}
        </p>
        {m.status === 'no-key' && <p>Encrypted before this device joined — not readable here.</p>}
        {m.status === 'invalid' && <p>Could not verify this message (tampered or forged). Hidden.</p>}
        {m.status === 'ok' && m.content?.type === 'text' && <p className="whitespace-pre-wrap break-words">{m.content.text}</p>}
        {m.status === 'ok' && m.content?.type === 'ctl' && (
          <CtlBubble
            hash={m.content.hash}
            label={m.content.label}
            passphrase={passphrase}
            client={client}
            display={display}
            onOpenInRelay={onOpenInRelay}
          />
        )}
      </div>
    </div>
  )
}

function CtlBubble(props: {
  hash: string
  label?: string
  passphrase: string
  client: ChatClient
  display: (userId: string) => string
  onOpenInRelay?: (hash: string) => void
}) {
  const { hash, label, passphrase, client, display, onOpenInRelay } = props
  const [opened, setOpened] = useState<CtlPayload | null>(null)
  const [failed, setFailed] = useState(false)
  const [sig, setSig] = useState<PacketSignatureCheck | null>(null)

  useEffect(() => {
    const packet = ctlHashToPacket(hash)
    if (!packet) return
    let cancelled = false
    void client.verifyPacket(packet).then((r) => !cancelled && setSig(r))
    return () => {
      cancelled = true
    }
  }, [client, hash])

  useEffect(() => {
    setOpened(null)
    setFailed(false)
    if (!passphrase) return
    let cancelled = false
    const t = setTimeout(() => {
      openRoomPacket(hash, passphrase)
        .then((p) => !cancelled && setOpened(p))
        .catch(() => !cancelled && setFailed(true))
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [hash, passphrase])

  return (
    <div className="space-y-1">
      <p className="font-semibold flex items-center gap-1">
        <LockIcon /> Sealed C.T.L. packet{label ? ` — ${label}` : ''}
      </p>
      {sig && (
        <p className="text-[11px] opacity-90" data-testid="packet-signature">
          {sig.status === 'valid'
            ? `Signed by ${display(sig.userId)}'s registered device`
            : sig.status === 'unsigned'
              ? 'Unsigned: sender details inside are claimed, not verified'
              : sig.status === 'unknown-signer'
                ? 'Signed by a device you cannot look up: sender not verified'
                : 'Signature INVALID: do not trust the sender details'}
        </p>
      )}
      {opened ? (
        <div className="rounded-lg bg-white/90 text-slate-800 p-2 text-xs space-y-0.5">
          {opened.subject && <p><span className="text-slate-500">Subject:</span> {opened.subject}</p>}
          {opened.senderDesk && <p><span className="text-slate-500">From:</span> {opened.senderDesk}</p>}
          <p className="whitespace-pre-wrap">{opened.confidentialNote}</p>
        </div>
      ) : (
        <p className="text-xs opacity-80">
          {failed ? 'Room passphrase does not open this packet.' : 'Enter the room passphrase above to open it on this device.'}
        </p>
      )}
      {onOpenInRelay && (
        <button onClick={() => onOpenInRelay(hash)} className="text-xs underline opacity-90">
          Open in Relay
        </button>
      )}
    </div>
  )
}

function SafetyPanel(props: {
  devices: DeviceView[] | null
  members: MemberRecord[]
  isOwner: boolean
  selfUserId: string
  display: (userId: string) => string
  onRemove: (userId: string) => void
  onVerify: (device: DeviceView, verified: boolean) => void
  onRevoke: (device: DeviceView) => void
}) {
  const { devices, members, isOwner, selfUserId, display, onRemove, onVerify, onRevoke } = props
  return (
    <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3" data-testid="safety-panel">
      <p className="text-xs text-slate-600">
        Compare each safety number with that person in person or on a call. If they match, nobody — including the
        Aurelia server — has swapped their keys. A new or changed device shows as unverified.
      </p>
      {!devices && <p className="text-xs text-slate-500">Loading devices…</p>}
      {members.map((m) => {
        const own = devices?.filter((d) => d.userId === m.userId) ?? []
        return (
          <div key={m.userId} className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">
                {display(m.userId)} <span className="text-[10px] uppercase text-slate-400">{m.role}</span>
              </p>
              {isOwner && m.userId !== selfUserId && (
                <button onClick={() => onRemove(m.userId)} className="text-xs text-red-700 hover:underline">
                  Remove &amp; re-key
                </button>
              )}
            </div>
            {devices && own.length === 0 && <p className="text-xs text-amber-700">No registered devices yet.</p>}
            {own.map((d) => (
              <div key={d.deviceId} className="mt-2 text-xs">
                <p className="text-slate-500">
                  {d.isSelf ? 'This device' : d.label || 'Device'} · {d.deviceId.slice(0, 8)}
                  {!d.isSelf && (
                    <span className={`ml-2 font-semibold ${d.verified ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {d.verified ? 'Verified' : 'Unverified'}
                    </span>
                  )}
                </p>
                {!d.isSelf && (
                  <>
                    <p className="font-mono text-slate-800 break-words" data-testid="safety-number">{d.safetyNumber}</p>
                    <button onClick={() => onVerify(d, !d.verified)} className="mt-1 text-emerald-700 hover:underline">
                      {d.verified ? 'Clear verification' : 'Mark as verified'}
                    </button>
                    {d.userId === selfUserId && (
                      <button
                        onClick={() => {
                          if (window.confirm('Revoke this device? It will receive no new messages.')) onRevoke(d)
                        }}
                        className="mt-1 ml-3 text-red-700 hover:underline"
                      >
                        Revoke (lost device)
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
