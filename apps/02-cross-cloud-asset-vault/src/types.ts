export type CloudProvider = 'icloud' | 'onedrive' | 'googledrive'

export type CloudPointer = {
  id: string
  provider: CloudProvider
  sourceApp?: string        // e.g. '01-daily-command-timeline' when imported from a .ics export
  name: string
  fileId: string            // remote resource id — pointer only, no asset bytes
  webViewUrl?: string       // provider share / view URL
  sizeBytes: number         // pointer metadata size (bytes), not the asset
  encrypted: boolean
  sealed?: EncryptedPointer // present when passphrase sealing was used
  sealedUrl?: string        // #vault= hash of the sealed packet
  createdAt: string
  updatedAt: string
}

export type EncryptedPointer = {
  iv: string
  salt: string
  ciphertext: string
  version: string
}

export type DecryptedPointer = CloudPointer & {
  timestamp: string
}

export type PointerIndexStats = {
  count: number
  totalBytes: number
  maxBytes: number
}
