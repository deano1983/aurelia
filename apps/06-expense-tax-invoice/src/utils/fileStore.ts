/**
 * Local store for exported invoice PDFs: IndexedDB database 'aurelia.06.files'.
 * The PDF never travels on the event bus; events carry the returned file id.
 * Keeps the newest MAX_FILES files. Resolves to null when IndexedDB is unavailable.
 */
export const FILES_DB = 'aurelia.06.files'
const STORE = 'files'
const MAX_FILES = 20

export interface StoredFile {
  id: string
  fileName: string
  invoiceNumber: string
  sizeBytes: number
  createdAt: string
  blob: Blob
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(FILES_DB, 1)
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function storeFile(blob: Blob, fileName: string, invoiceNumber: string): Promise<string | null> {
  const db = await openDb()
  if (!db) return null
  const record: StoredFile = {
    id: crypto.randomUUID(),
    fileName,
    invoiceNumber,
    sizeBytes: blob.size,
    createdAt: new Date().toISOString(),
    blob,
  }
  const ok = await new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      store.put(record)
      const keys = store.index('createdAt').getAllKeys()
      keys.onsuccess = () => {
        const ids = keys.result as IDBValidKey[]
        ids.slice(0, Math.max(0, ids.length - MAX_FILES)).forEach((id) => store.delete(id))
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
  db.close()
  return ok ? record.id : null
}

export async function getFile(id: string): Promise<StoredFile | null> {
  const db = await openDb()
  if (!db) return null
  const result = await new Promise<StoredFile | null>((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
      req.onsuccess = () => resolve((req.result as StoredFile | undefined) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  db.close()
  return result
}
