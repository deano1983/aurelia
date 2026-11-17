import type { AnyAureliaEvent } from './envelope'

/**
 * IndexedDB outbox ('aurelia-events'): every emitted event is kept for 7 days
 * (max 500) so an app opened later can pick up what was addressed to it.
 * Every function resolves to an empty result when IndexedDB is unavailable.
 */

export const OUTBOX_DB = 'aurelia-events'
export const OUTBOX_STORE = 'outbox'
export const OUTBOX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
export const OUTBOX_MAX = 500

export class Outbox {
  private dbPromise: Promise<IDBDatabase | null> | null = null

  constructor(
    private readonly factory: IDBFactory | null,
    private readonly dbName = OUTBOX_DB,
  ) {}

  get available(): boolean {
    return this.factory !== null
  }

  private open(): Promise<IDBDatabase | null> {
    if (!this.factory) return Promise.resolve(null)
    if (this.dbPromise) return this.dbPromise
    const factory = this.factory
    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = factory.open(this.dbName, 1)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
            const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' })
            store.createIndex('ts', 'ts')
          }
        }
        req.onsuccess = () => {
          const db = req.result
          // Let another tab upgrade the schema later without blocking forever.
          db.onversionchange = () => {
            db.close()
            this.dbPromise = null
          }
          resolve(db)
        }
        req.onerror = () => resolve(null)
        req.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
    return this.dbPromise
  }

  async put(event: AnyAureliaEvent): Promise<void> {
    const db = await this.open()
    if (!db) return
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(OUTBOX_STORE, 'readwrite')
        tx.objectStore(OUTBOX_STORE).put(event)
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
        tx.onabort = () => resolve()
      } catch {
        resolve()
      }
    })
    await this.prune()
  }

  /** All retained events, oldest first. */
  async list(): Promise<AnyAureliaEvent[]> {
    const db = await this.open()
    if (!db) return []
    return new Promise<AnyAureliaEvent[]>((resolve) => {
      try {
        const tx = db.transaction(OUTBOX_STORE, 'readonly')
        const req = tx.objectStore(OUTBOX_STORE).index('ts').getAll()
        req.onsuccess = () => {
          const cutoff = Date.now() - OUTBOX_RETENTION_MS
          resolve((req.result as AnyAureliaEvent[]).filter((e) => Date.parse(e.ts) >= cutoff))
        }
        req.onerror = () => resolve([])
      } catch {
        resolve([])
      }
    })
  }

  /** Drop events older than 7 days, then the oldest beyond 500. */
  async prune(now = Date.now()): Promise<void> {
    const db = await this.open()
    if (!db) return
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(OUTBOX_STORE, 'readwrite')
        const store = tx.objectStore(OUTBOX_STORE)
        const cutoff = now - OUTBOX_RETENTION_MS
        const req = store.index('ts').getAll()
        req.onsuccess = () => {
          const all = req.result as AnyAureliaEvent[] // oldest first
          const fresh = all.filter((e) => Date.parse(e.ts) >= cutoff)
          const keep = new Set(fresh.slice(Math.max(0, fresh.length - OUTBOX_MAX)).map((e) => e.id))
          for (const e of all) if (!keep.has(e.id)) store.delete(e.id)
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
        tx.onabort = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async clear(): Promise<void> {
    const db = await this.open()
    if (!db) return
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(OUTBOX_STORE, 'readwrite')
        tx.objectStore(OUTBOX_STORE).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  close(): void {
    const p = this.dbPromise
    this.dbPromise = null
    void p?.then((db) => db?.close())
  }
}
