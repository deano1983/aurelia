/**
 * Test helpers: an in-memory BroadcastChannel that delivers between instances
 * of the same "origin" (one per createFakeOrigin call), and a memory Storage.
 */
import type { StorageLike } from './bus'

export function createFakeOrigin() {
  const channels = new Map<string, Set<FakeChannel>>()

  class FakeChannel {
    onmessage: ((ev: MessageEvent) => void) | null = null
    private closed = false
    constructor(readonly name: string) {
      if (!channels.has(name)) channels.set(name, new Set())
      channels.get(name)!.add(this)
    }
    postMessage(data: unknown): void {
      if (this.closed) throw new Error('closed')
      const copy = structuredClone(data)
      for (const peer of channels.get(this.name) ?? []) {
        if (peer === this) continue
        queueMicrotask(() => {
          if (!peer.closed) peer.onmessage?.({ data: copy } as MessageEvent)
        })
      }
    }
    close(): void {
      this.closed = true
      channels.get(this.name)?.delete(this)
    }
    addEventListener(): void {}
    removeEventListener(): void {}
    dispatchEvent(): boolean {
      return true
    }
  }

  const data = new Map<string, string>()
  const storage: StorageLike = {
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  }

  return { BroadcastChannel: FakeChannel as unknown as new (name: string) => BroadcastChannel, storage, data }
}

/** Wait for queued microtasks, timers and IndexedDB callbacks. */
export function settle(ms = 20): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
