import type { CloudPointer, PointerIndexStats } from '../types'

const DB_NAME = 'aurelia-vault'
const STORE_NAME = 'pointers'
const DB_VERSION = 1

// 12 KB pointer index — metadata only, no asset bytes are ever stored.
export const MAX_INDEX_BYTES = 12 * 1024

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
  return dbPromise
}

function pointerByteLength(pointer: CloudPointer): number {
  return new TextEncoder().encode(JSON.stringify(pointer)).byteLength
}

export async function getAllPointers(): Promise<CloudPointer[]> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as CloudPointer[])
    request.onerror = () => reject(request.error)
  })
}

export async function getPointerStats(): Promise<PointerIndexStats> {
  const pointers = await getAllPointers()
  const totalBytes = pointers.reduce((sum, pointer) => sum + pointerByteLength(pointer), 0)
  return { count: pointers.length, totalBytes, maxBytes: MAX_INDEX_BYTES }
}

export async function addPointer(pointer: CloudPointer): Promise<void> {
  const existing = await getAllPointers()
  const current = existing.find((item) => item.id === pointer.id)
  const size = pointerByteLength(pointer)
  const total =
    existing.reduce((sum, item) => sum + pointerByteLength(item), 0) -
      (current ? pointerByteLength(current) : 0) +
    size
  if (total > MAX_INDEX_BYTES) {
    throw new Error(
      `Pointer index would exceed 12 KB cap (${(total / 1024).toFixed(2)} KB). Remove a pointer first.`
    )
  }
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(pointer)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function removePointer(id: string): Promise<void> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function clearPointers(): Promise<void> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
