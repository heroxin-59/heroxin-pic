import { describe, expect, it } from 'vitest'
import {
  getMainNavIndex,
  resolveMainNavSwipeTarget,
  resolveNavTransitionName,
} from './mobileNavSwipe'

describe('resolveMainNavSwipeTarget', () => {
  it('from files: swipe left to album, swipe right to upload', () => {
    expect(resolveMainNavSwipeTarget('/files', -80)).toBe('/images')
    expect(resolveMainNavSwipeTarget('/files', 80)).toBe('/')
  })

  it('from upload: only swipe left to files', () => {
    expect(resolveMainNavSwipeTarget('/', 80)).toBeNull()
    expect(resolveMainNavSwipeTarget('/', -80)).toBe('/files')
  })

  it('from album: only swipe right to files', () => {
    expect(resolveMainNavSwipeTarget('/images', -80)).toBeNull()
    expect(resolveMainNavSwipeTarget('/images', 80)).toBe('/files')
  })

  it('returns null for non-main routes', () => {
    expect(resolveMainNavSwipeTarget('/preview', 80)).toBeNull()
  })
})

describe('resolveNavTransitionName', () => {
  it('slides left when moving to a tab on the right', () => {
    expect(resolveNavTransitionName('/', '/files')).toBe('nav-slide-left')
    expect(resolveNavTransitionName('/files', '/images')).toBe('nav-slide-left')
  })

  it('slides right when moving to a tab on the left', () => {
    expect(resolveNavTransitionName('/images', '/files')).toBe('nav-slide-right')
    expect(resolveNavTransitionName('/files', '/')).toBe('nav-slide-right')
  })
})

describe('getMainNavIndex', () => {
  it('maps main tab paths to stable indices', () => {
    expect(getMainNavIndex('/')).toBe(0)
    expect(getMainNavIndex('/files')).toBe(1)
    expect(getMainNavIndex('/images')).toBe(2)
    expect(getMainNavIndex('/preview')).toBe(-1)
  })
})
