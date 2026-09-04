import { describe, expect, it } from 'vitest'
import {
  getMainNavIndex,
  resolveMainNavSwipeTarget,
  resolveNavTransitionName,
} from './mobileNavSwipe'

describe('resolveMainNavSwipeTarget', () => {
  it('from files: swipe right to album, swipe left blocked', () => {
    expect(resolveMainNavSwipeTarget('/files', -80)).toBeNull()
    expect(resolveMainNavSwipeTarget('/files', 80)).toBe('/images')
  })

  it('from upload: only swipe left to album', () => {
    expect(resolveMainNavSwipeTarget('/upload', 80)).toBeNull()
    expect(resolveMainNavSwipeTarget('/upload', -80)).toBe('/images')
  })

  it('from album: swipe left to files, swipe right to upload', () => {
    expect(resolveMainNavSwipeTarget('/images', -80)).toBe('/files')
    expect(resolveMainNavSwipeTarget('/images', 80)).toBe('/upload')
  })

  it('returns null for non-main routes', () => {
    expect(resolveMainNavSwipeTarget('/preview', 80)).toBeNull()
  })
})

describe('resolveNavTransitionName', () => {
  it('slides left when moving to a tab on the right', () => {
    expect(resolveNavTransitionName('/upload', '/images')).toBe('nav-slide-left')
    expect(resolveNavTransitionName('/images', '/files')).toBe('nav-slide-left')
  })

  it('slides right when moving to a tab on the left', () => {
    expect(resolveNavTransitionName('/files', '/images')).toBe('nav-slide-right')
    expect(resolveNavTransitionName('/images', '/upload')).toBe('nav-slide-right')
  })
})

describe('getMainNavIndex', () => {
  it('maps main tab paths to stable indices', () => {
    expect(getMainNavIndex('/upload')).toBe(0)
    expect(getMainNavIndex('/images')).toBe(1)
    expect(getMainNavIndex('/files')).toBe(2)
    expect(getMainNavIndex('/preview')).toBe(-1)
  })
})
