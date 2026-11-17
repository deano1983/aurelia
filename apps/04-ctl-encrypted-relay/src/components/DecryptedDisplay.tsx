import type { PacketSignatureCheck } from '@aurelia/core/chat'
import type { DecryptedPacket } from '../types'

type DecryptedDisplayProps = {
  packet: DecryptedPacket
  signature: PacketSignatureCheck | null
}

function SignatureBanner({ signature }: { signature: PacketSignatureCheck | null }) {
  if (!signature) return null
  const base = 'mb-4 p-3 rounded-lg text-sm border'
  switch (signature.status) {
    case 'valid':
      return (
        <div className={`${base} bg-emerald-50 border-emerald-200 text-emerald-900`} data-testid="signature-status">
          <strong>Signature verified.</strong> Sealed by a registered Aurelia device of user{' '}
          <code className="text-xs">{signature.userId}</code> (device {signature.deviceId.slice(0, 8)}). Compare safety
          numbers in Chat to confirm who that is.
        </div>
      )
    case 'unsigned':
      return (
        <div className={`${base} bg-amber-50 border-amber-200 text-amber-900`} data-testid="signature-status">
          <strong>Unsigned packet.</strong> Anyone with the passphrase could have written it: the sender, role and time
          below are <em>claimed by the sender</em>, not verified.
        </div>
      )
    case 'unknown-signer':
      return (
        <div className={`${base} bg-amber-50 border-amber-200 text-amber-900`} data-testid="signature-status">
          <strong>Signature not checked.</strong> The packet is signed, but the signing device could not be looked up
          (sign in, and share a chat room with the sender). Treat the sender details as claimed.
        </div>
      )
    case 'invalid':
      return (
        <div className={`${base} bg-red-50 border-red-200 text-red-900`} data-testid="signature-status">
          <strong>Signature INVALID.</strong> This packet was altered or forged. Do not act on it.
        </div>
      )
  }
}

export function DecryptedDisplay({ packet, signature }: DecryptedDisplayProps) {
  const verified = signature?.status === 'valid'
  const claimed = verified ? '' : ' (claimed)'
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6" data-testid="decrypted-packet">
      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">📄 Decrypted Packet</h3>
      <SignatureBanner signature={signature} />
      <div className="space-y-2 text-sm text-slate-700">
        <p>
          <span className="font-medium text-slate-500">From{claimed}:</span> {packet.senderDesk} ({packet.senderRole})
        </p>
        <p>
          <span className="font-medium text-slate-500">To:</span> {packet.recipientRole}
        </p>
        <p>
          <span className="font-medium text-slate-500">Channel:</span> {packet.channel}
        </p>
        <p>
          <span className="font-medium text-slate-500">Subject:</span> {packet.subject}
        </p>
        <p>
          <span className="font-medium text-slate-500">Time{claimed}:</span> {packet.timestamp}
        </p>
        {packet.cloudProofPointer && (
          <p>
            <span className="font-medium text-slate-500">Proof Pointer:</span> {packet.cloudProofPointer}
          </p>
        )}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="font-medium text-slate-500 mb-2">Sign-Off Instruction:</p>
          <p className="whitespace-pre-wrap break-words">{packet.confidentialNote}</p>
        </div>
      </div>
    </div>
  )
}
