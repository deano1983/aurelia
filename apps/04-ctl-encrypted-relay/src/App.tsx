import { useCallback, useEffect, useState } from 'react'
import type { PacketSignatureCheck } from '@aurelia/core/chat'
import type { PacketFields, EncryptedPacket, DecryptedPacket } from './types'
import { encryptPacket, decryptPacket, urlHashToPacket } from './crypto'
import { SenderForm } from './components/SenderForm'
import { RecipientForm } from './components/RecipientForm'
import { EncryptButton } from './components/EncryptButton'
import { DecryptBox } from './components/DecryptBox'
import { PacketDisplay } from './components/PacketDisplay'
import { DecryptedDisplay } from './components/DecryptedDisplay'
import { ChatTab } from './chat/ChatTab'
import { useChatClient } from './chat/useChatClient'

const EMPTY_FIELDS: PacketFields = {
  senderDesk: '',
  senderRole: '',
  recipientRole: '',
  channel: '',
  subject: '',
  passphrase: '',
  cloudProofPointer: '',
  confidentialNote: '',
}

type Tab = 'relay' | 'chat'

/**
 * Reads an incoming #ctl= packet from the URL once, then removes the fragment
 * from the address bar and session history so the ciphertext does not linger
 * in history or browser sync.
 */
function takeIncomingPacket(): EncryptedPacket | null {
  if (typeof window === 'undefined' || !window.location.hash.includes('ctl=')) return null
  const packet = urlHashToPacket(window.location.hash)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return packet
}

export default function App() {
  const [tab, setTab] = useState<Tab>('relay')
  const [fields, setFields] = useState<PacketFields>({ ...EMPTY_FIELDS })
  const [encrypted, setEncrypted] = useState<EncryptedPacket | null>(null)
  const [incoming, setIncoming] = useState<EncryptedPacket | null>(() => takeIncomingPacket())
  const [linkInput, setLinkInput] = useState('')
  const [decrypted, setDecrypted] = useState<DecryptedPacket | null>(null)
  const [signature, setSignature] = useState<PacketSignatureCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const chat = useChatClient()
  const signer = chat.status === 'ready' ? chat.client : null

  // A link opened while the app is already running (hashchange).
  useEffect(() => {
    const onHash = () => {
      const packet = takeIncomingPacket()
      if (packet) {
        setIncoming(packet)
        setDecrypted(null)
        setTab('relay')
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const handleFieldChange = (key: string, value: string) => {
    setFields({ ...fields, [key as keyof PacketFields]: value })
    setError(null)
  }

  const handleSeal = async () => {
    setError(null)
    setWorking(true)
    try {
      // Sign with this device when signed in, so recipients can verify the sender.
      const packet = signer
        ? await signer.sealSignedCtl(fields, fields.passphrase)
        : await encryptPacket(fields, fields.passphrase)
      // Shown in the copy box only; never written to the address bar or history.
      setEncrypted(packet)
    } catch (e) {
      setError(e instanceof Error ? `Encryption failed: ${e.message}` : 'Encryption failed.')
    } finally {
      setWorking(false)
    }
  }

  const handleDecrypt = async () => {
    setError(null)
    setDecrypted(null)
    setSignature(null)
    const packet = linkInput.trim() ? urlHashToPacket(linkInput.trim()) : incoming
    if (!packet) {
      setError('No valid #ctl= packet found. Open a #ctl= link or paste it above.')
      return
    }
    setWorking(true)
    try {
      const result = await decryptPacket(packet, fields.passphrase)
      if (!result) {
        // One generic message for every failure (wrong passphrase, tampering, bad format).
        setError('Decryption failed — incorrect passphrase or corrupted packet.')
        return
      }
      setDecrypted(result)
      if (signer) setSignature(await signer.verifyPacket(packet))
      else if (packet.version === '2' && packet.sig) {
        // Signed, but without a signed-in session there is no directory to check it against.
        setSignature({ status: 'unknown-signer', userId: packet.sig.user, deviceId: packet.sig.device })
      } else setSignature({ status: 'unsigned' })
    } finally {
      setWorking(false)
    }
  }

  const openFromChat = useCallback((hash: string) => {
    const packet = urlHashToPacket(hash)
    if (!packet) return
    setIncoming(packet)
    setLinkInput('')
    setDecrypted(null)
    setSignature(null)
    setTab('relay')
  }, [])

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg ${
      tab === t ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">
              🔒
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">C.T.L. Relay</h1>
              <p className="text-xs text-slate-500">Encrypted Interoffice Approval</p>
            </div>
          </div>
          <nav className="flex items-center gap-2" role="tablist" aria-label="Relay sections">
            <button role="tab" aria-selected={tab === 'relay'} className={tabClass('relay')} onClick={() => setTab('relay')}>
              Relay
            </button>
            <button role="tab" aria-selected={tab === 'chat'} className={tabClass('chat')} onClick={() => setTab('chat')}>
              Chat
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {tab === 'chat' ? (
          <ChatTab chat={chat} onOpenInRelay={openFromChat} />
        ) : (
          <div className="max-w-4xl mx-auto">
            {error && (
              <div role="alert" className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                {error}
              </div>
            )}
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <SenderForm fields={fields} onChange={handleFieldChange} />
                <RecipientForm fields={fields} onChange={handleFieldChange} />
                <EncryptButton
                  fields={fields}
                  onChange={handleFieldChange}
                  onSeal={handleSeal}
                  working={working}
                  signing={Boolean(signer)}
                />
              </div>
              {encrypted && (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                  <PacketDisplay packet={encrypted} />
                </div>
              )}
            </div>
            <div className="mt-8 max-w-2xl space-y-6">
              <DecryptBox
                fields={fields}
                onChange={handleFieldChange}
                onDecrypt={handleDecrypt}
                hasIncoming={Boolean(incoming)}
                linkInput={linkInput}
                onLinkInput={setLinkInput}
                working={working}
              />
              {decrypted && <DecryptedDisplay packet={decrypted} signature={signature} />}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
