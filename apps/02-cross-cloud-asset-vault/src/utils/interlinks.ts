/**
 * Cross-app interlinks for 02 Cross-Cloud Asset Vault, over the @aurelia/core bus.
 *
 * - invoice.pdf_exported  ← 06 Tax Invoice: filed as a *pending pointer* until the
 *   user links it to a cloud. Only metadata travels; the PDF stays in 06's
 *   IndexedDB (aurelia.06.files) under fileId.
 * - vault.pointer_created → 03 Voice Studio, 04 CTL Relay: emitted when a pending
 *   pointer is linked.
 */
import { useCallback, useState } from 'react'
import { configureEvents, emit, useAureliaEvent, type AureliaEvent } from '@aurelia/core/events'
import type { CloudPointer, CloudProvider } from '../types'

export const APP_ID_VAULT = '02'

configureEvents({ appId: APP_ID_VAULT })

const PENDING_KEY = 'aurelia.02.pending'
const PENDING_MAX = 50

export interface PendingPointer {
  /** Event id (dedupe key). */
  id: string
  sourceApp: string
  invoiceNumber: string
  fileName: string
  sizeBytes: number
  fileId?: string
  receivedAt: string
}

function load(): PendingPointer[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as PendingPointer[]) : []
  } catch {
    return []
  }
}

function save(list: PendingPointer[]): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list))
  } catch {
    // Storage unavailable: the list still lives in memory for this session.
  }
}

export function pendingFromEvent(event: AureliaEvent<'invoice.pdf_exported'>): PendingPointer {
  const { invoiceNumber, fileName, sizeBytes, fileId } = event.payload
  return { id: event.id, sourceApp: event.source, invoiceNumber, fileName, sizeBytes, fileId, receivedAt: event.ts }
}

/** Build the vault pointer for a pending invoice PDF (metadata only). */
export function pointerFromPending(pending: PendingPointer, provider: CloudProvider): CloudPointer {
  const now = new Date().toISOString()
  const pointer: CloudPointer = {
    id: `invoice-${pending.id}`,
    provider,
    sourceApp: '06-expense-tax-invoice',
    name: pending.fileName,
    fileId: pending.fileId ? `aurelia.06.files/${pending.fileId}` : `invoice/${pending.invoiceNumber}`,
    sizeBytes: 0,
    encrypted: false,
    createdAt: now,
    updatedAt: now,
  }
  pointer.sizeBytes = new TextEncoder().encode(JSON.stringify(pointer)).byteLength
  return pointer
}

/** Announce a newly linked pointer to 03 and 04. */
export function announcePointer(pointer: CloudPointer): void {
  emit('vault.pointer_created', { provider: pointer.provider, pointer: pointer.fileId, label: pointer.name })
}

export function usePendingPointers() {
  const [pending, setPending] = useState<PendingPointer[]>(load)

  useAureliaEvent('invoice.pdf_exported', (event) => {
    const entry = pendingFromEvent(event)
    setPending((prev) => {
      if (prev.some((p) => p.id === entry.id)) return prev
      const next = [entry, ...prev].slice(0, PENDING_MAX)
      save(next)
      return next
    })
  })

  const remove = useCallback((id: string) => {
    setPending((prev) => {
      const next = prev.filter((p) => p.id !== id)
      save(next)
      return next
    })
  }, [])

  return { pending, remove }
}
