// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareSheet } from './ShareSheet'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('ShareSheet', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  async function render(onClose = vi.fn(), text = 'Hello from Aurelia') {
    await act(async () => {
      root.render(createElement(ShareSheet, { open: true, onClose, post: { text }, supabase: null }))
    })
    return onClose
  }

  it('renders an accessible dialog listing networks with previews', async () => {
    await render()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const labelId = dialog.getAttribute('aria-labelledby')!
    expect(document.getElementById(labelId)?.textContent).toBe('Share')
    const text = dialog.textContent ?? ''
    for (const name of ['LinkedIn', 'X', 'Threads', 'Bluesky', 'WhatsApp', 'Telegram', 'Reddit', 'Email', 'SMS', 'Instagram', 'TikTok']) {
      expect(text).toContain(name)
    }
    expect(text).toContain('Post directly to LinkedIn')
    expect(text).toContain('not set up here')
    // focus moved inside the dialog
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('warns when a network will trim the text', async () => {
    await render(vi.fn(), 'word '.repeat(80))
    expect(document.body.textContent).toContain('Trimmed to fit the 280-character limit')
  })

  it('closes on Escape and traps Tab', async () => {
    const onClose = await render()
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    const focusables = dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary')
    const last = focusables[focusables.length - 1]
    last.focus()
    act(() => {
      last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    })
    // jsdom has no layout (offsetParent is null), so the trap keeps focus on
    // the active element instead of leaving the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true)
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
