import { describe, it, expect, beforeEach } from 'vitest'
import { setCache, getCache, clearCache } from './cache'

describe('cache', () => {
  beforeEach(() => clearCache())

  it('sets and gets values', () => {
    setCache('key1', 42)
    expect(getCache('key1')).toBe(42)
  })

  it('returns undefined for missing keys', () => {
    expect(getCache('missing')).toBeUndefined()
  })

  it('clears all cache', () => {
    setCache('a', 1)
    clearCache()
    expect(getCache('a')).toBeUndefined()
  })
})
