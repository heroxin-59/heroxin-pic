import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  ACCESS_SESSION_KEY,
  isAccessGateEnabledForHash,
  isAccessUnlockedForHash,
  markAccessUnlockedForHash,
  verifyAccessPassphraseForHash,
} from '@/config/accessGate'
import { sha256Hex } from '@/utils/sha256'

describe('sha256Hex', () => {
  it('hashes passphrase consistently', async () => {
    const hash = await sha256Hex('hello')
    expect(hash).toHaveLength(64)
    expect(await sha256Hex('hello')).toBe(hash)
  })
})

describe('accessGate', () => {
  const hash = 'test-hash-abc'
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
      clear: () => {
        storage.clear()
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('disabled when hash empty', () => {
    expect(isAccessGateEnabledForHash('')).toBe(false)
    expect(isAccessUnlockedForHash('')).toBe(true)
  })

  it('unlocks with correct passphrase', async () => {
    const password = 'secret-pass'
    const expected = await sha256Hex(password)

    expect(isAccessGateEnabledForHash(expected)).toBe(true)
    expect(isAccessUnlockedForHash(expected)).toBe(false)

    const ok = await verifyAccessPassphraseForHash(password, expected)
    expect(ok).toBe(true)
    expect(sessionStorage.getItem(ACCESS_SESSION_KEY)).toBe(expected)
    expect(isAccessUnlockedForHash(expected)).toBe(true)
  })

  it('rejects wrong passphrase', async () => {
    const expected = await sha256Hex('right')
    const ok = await verifyAccessPassphraseForHash('wrong', expected)
    expect(ok).toBe(false)
    expect(isAccessUnlockedForHash(expected)).toBe(false)
  })

  it('markAccessUnlockedForHash persists session', () => {
    markAccessUnlockedForHash(hash)
    expect(isAccessUnlockedForHash(hash)).toBe(true)
  })
})
