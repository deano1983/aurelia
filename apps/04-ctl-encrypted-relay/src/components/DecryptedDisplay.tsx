import type { DecryptedPacket } from '../types'

type DecryptedDisplayProps = {
  packet: DecryptedPacket
}

export function DecryptedDisplay({ packet }: DecryptedDisplayProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
        📄 Decrypted Packet
      </h3>
      <div className="space-y-2 text-sm text-slate-700">
        <p>
          <span className="font-medium text-slate-500">From:</span>{' '}
          {packet.senderDesk} ({packet.senderRole})
        </p>
        <p>
          <span className="font-medium text-slate-500">To:</span>{' '}
          {packet.recipientRole}
        </p>
        <p>
          <span className="font-medium text-slate-500">Channel:</span>{' '}
          {packet.channel}
        </p>
        <p>
          <span className="font-medium text-slate-500">Subject:</span>{' '}
          {packet.subject}
        </p>
        <p>
          <span className="font-medium text-slate-500">Time:</span>{' '}
          {packet.timestamp}
        </p>
        {packet.cloudProofPointer && (
          <p>
            <span className="font-medium text-slate-500">Proof Pointer:</span>{' '}
            {packet.cloudProofPointer}
          </p>
        )}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="font-medium text-slate-500 mb-2">Sign-Off Instruction:</p>
          <p className="whitespace-pre-wrap">{packet.confidentialNote}</p>
        </div>
      </div>
    </div>
  )
}