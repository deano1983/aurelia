import { describe, expect, it } from 'vitest'
import { fetchSuiteVersion, isUpdateAvailable } from './version'

const fakeFetch = (body: unknown, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch

describe('suite version check', () => {
  it('flags an update only when both ids are known and differ', () => {
    expect(isUpdateAvailable('abc', { buildId: 'abc' })).toBe(false)
    expect(isUpdateAvailable('abc', { buildId: 'def' })).toBe(true)
    expect(isUpdateAvailable(null, { buildId: 'def' })).toBe(false)
    expect(isUpdateAvailable('abc', null)).toBe(false)
  })

  it('reads /version.json defensively', async () => {
    expect(await fetchSuiteVersion('/version.json', fakeFetch({ buildId: 'x1', builtAt: 'now' }))).toEqual({ buildId: 'x1', builtAt: 'now' })
    expect(await fetchSuiteVersion('/version.json', fakeFetch({ buildId: 42 }))).toBeNull()
    expect(await fetchSuiteVersion('/version.json', fakeFetch({}, false))).toBeNull()
    expect(await fetchSuiteVersion('/version.json', undefined)).toBeNull()
  })
})
