import { describe, expect, it } from 'vitest'
import { resolveMainNavSwipeTarget } from './mobileNavSwipe'

describe('resolveMainNavSwipeTarget', () => {
  it('from files: swipe left to upload, swipe right to album', () => {
    expect(resolveMainNavSwipeTarget('/files', -80)).toBe('/')
    expect(resolveMainNavSwipeTarget('/files', 80)).toBe('/images')
  })

  it('from upload: only swipe right to files', () => {
    expect(resolveMainNavSwipeTarget('/', -80)).toBeNull()
    expect(resolveMainNavSwipeTarget('/', 80)).toBe('/files')
  })

  it('from album: only swipe left to files', () => {
    expect(resolveMainNavSwipeTarget('/images', -80)).toBe('/files')
    expect(resolveMainNavSwipeTarget('/images', 80)).toBeNull()
  })

  it('returns null for non-main routes', () => {
    expect(resolveMainNavSwipeTarget('/preview', 80)).toBeNull()
  })
})
