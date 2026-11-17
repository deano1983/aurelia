import type { EncryptedPacket } from '../types'

type PacketDisplayProps = {
  packet: EncryptedPacket
}

export function PacketDisplay({ packet }: PacketDisplayProps) {
  const hashLink = `#ctl=${btoa(JSON.stringify(packet))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
        📦 Encrypted Packet Sealed
      </h3>
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Version</span>
          <span className="text-xs font-mono text-slate-600">{packet.version}</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">IV</span>
          <span className="text-xs font-mono text-slate-600 truncate">{packet.iv}</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Salt</span>
          <span className="text-xs font-mono text-slate-600 truncate">{packet.salt}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ciphertext</span>
          <span className="text-xs font-mono text-slate-600 truncate">{packet.ciphertext}</span>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
          Deep-Link Handoff
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-600 bg-slate-50"
            value={hashLink}
            readOnly
          />
          <button
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900"
            onClick={() => {
              navigator.clipboard.writeText(hashLink)
            }}
          >
            Copy
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          Ciphertext lives in the URL hash fragment — nothing is sent to any server.
        </p>
      </div>
    </div>
  )
}