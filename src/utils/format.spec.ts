import { describe, expect, it } from 'vitest'
import { formatBytes, formatMb } from '@/utils/format'

describe('formatBytes', () => {
  it('formats bytes / KB / MB', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

describe('formatMb', () => {
  it('returns MB string without unit', () => {
    expect(formatMb(10 * 1024 * 1024)).toBe('10.0')
  })
})
