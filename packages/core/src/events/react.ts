import { useEffect, useRef, useState } from 'react'
import type { AppId, EventType } from './catalog'
import { cursorKey, getEventBus, type EventHandler } from './bus'
import type { AnyAureliaEvent } from './envelope'

/**
 * Subscribe to an event type for the lifetime of the component. The latest
 * handler is always called, so it need not be memoised. Outbox events addressed
 * to this app that it has not acked are replayed once on subscribe.
 */
export function useAureliaEvent<T extends EventType>(type: T, handler: EventHandler<T>, enabled = true): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!enabled) return
    let off: () => void = () => undefined
    try {
      off = getEventBus().on(type, (e) => ref.current(e))
    } catch {
      /* bus unavailable */
    }
    return off
  }, [type, enabled])
}

function useBusRefresh(load: () => Promise<void>, watchKey?: string): void {
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      if (timer) clearTimeout(timer)
      // Let the outbox write land before re-reading it.
      timer = setTimeout(() => {
        if (alive) void loadRef.current()
      }, 50)
    }
    void loadRef.current()
    let off: () => void = () => undefined
    try {
      off = getEventBus().onAny(refresh)
    } catch {
      /* bus unavailable */
    }
    const onStorage = (e: StorageEvent) => {
      if (!watchKey || e.key === watchKey) refresh()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      off()
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [watchKey])
}

/** The last `limit` events across the suite, newest first (hub activity feed). */
export function useRecentEvents(limit = 20): AnyAureliaEvent[] {
  const [events, setEvents] = useState<AnyAureliaEvent[]>([])
  useBusRefresh(async () => {
    try {
      setEvents(await getEventBus().recent(limit))
    } catch {
      /* ignore */
    }
  })
  return events
}

/**
 * Number of events addressed to appId that the app has not acked yet.
 * For the hub's app cards (wiring is owned by the AppCard / manifests work).
 */
export function useUnreadCount(appId: AppId): number {
  const [count, setCount] = useState(0)
  useBusRefresh(async () => {
    try {
      setCount(await getEventBus().unreadCount(appId))
    } catch {
      /* ignore */
    }
  }, cursorKey(appId))
  return count
}
