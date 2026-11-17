import { useState } from 'react'
import type { PacketFields, EncryptedPacket, DecryptedPacket } from './types'
import {
  encryptPacket,
  decryptPacket,
  packetToUrlHash,
  urlHashToPacket,
} from './crypto'
import { SenderForm } from './components/SenderForm'
import { RecipientForm } from './components/RecipientForm'
import { EncryptButton } from './components/EncryptButton'
import { DecryptBox } from './components/DecryptBox'
import { PacketDisplay } from './components/PacketDisplay'
import { UpdateBanner } from '@aurelia/core/events'
import { DecryptedDisplay } from './components/DecryptedDisplay'

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

export default function App() {
  const [fields, setFields] = useState<PacketFields>({ ...EMPTY_FIELDS })
  const [encrypted, setEncrypted] = useState<EncryptedPacket | null>(null)
  const [decrypted, setDecrypted] = useState<DecryptedPacket | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFieldChange = (key: string, value: string) => {
    setFields({ ...fields, [key as keyof PacketFields]: value })
    setError(null)
  }

  const handleSeal = async () => {
    setError(null)
    try {
      const packet = await encryptPacket(fields, fields.passphrase)
      setEncrypted(packet)
      window.history.replaceState(null, '', packetToUrlHash(packet))
    } catch {
      setError('Encryption failed. Check your passphrase and try again.')
    }
  }

  const handleUrlDecrypt = async () => {
    setError(null)
    const packet = urlHashToPacket(window.location.hash)
    if (!packet) {
      setError('No valid #ctl= link found in URL.')
      return
    }
    const result = await decryptPacket(packet, fields.passphrase)
    if (!result) {
      setError('Decryption failed — incorrect passphrase or corrupted packet.')
      return
    }
    setDecrypted(result)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">
              🔒
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">C.T.L. Relay</h1>
              <p className="text-xs text-slate-500">Encrypted Interoffice Approval</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white"
            >
              Seal Packet
            </button>
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Decrypt Packet
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <SenderForm fields={fields} onChange={handleFieldChange} />
            <RecipientForm fields={fields} onChange={handleFieldChange} />
            <EncryptButton fields={fields} onChange={handleFieldChange} onSeal={handleSeal} />
          </div>
          {encrypted && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <PacketDisplay packet={encrypted} />
            </div>
          )}
        </div>
        <div className="mt-8 max-w-2xl">
          <DecryptBox
            fields={fields}
            onChange={handleFieldChange}
            onDecrypt={handleUrlDecrypt}
          />
          {decrypted && <DecryptedDisplay packet={decrypted} />}
        </div>
      </main>
      <UpdateBanner />
    </div>
  )
}