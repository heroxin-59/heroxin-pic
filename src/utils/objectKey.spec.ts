import { describe, expect, it } from 'vitest'
import { buildObjectKey, displayNameFromStoredFilename } from './objectKey'

describe('displayNameFromStoredFilename', () => {
  it('strips uuid prefix from stored filename', () => {
    expect(
      displayNameFromStoredFilename('a1b2c3d4-e5f6-7890-abcd-ef1234567890-报告.docx'),
    ).toBe('报告.docx')
  })

  it('strips uuid prefix from object key basename', () => {
    expect(
      displayNameFromStoredFilename(
        'file/2026/08/26/a1b2c3d4-e5f6-7890-abcd-ef1234567890-photo.jpg',
      ),
    ).toBe('photo.jpg')
  })

  it('strips timestamp suffix', () => {
    expect(displayNameFromStoredFilename('报告-1710000000000.docx')).toBe('报告.docx')
  })

  it('returns original when no token', () => {
    expect(displayNameFromStoredFilename('plain.txt')).toBe('plain.txt')
  })
})

describe('buildObjectKey uuid prefix', () => {
  it('stores uuid as filename prefix', () => {
    const key = buildObjectKey({
      filename: '报告.docx',
      dir: 'file/',
      strategy: 'uuid',
      archiveDatePath: '2026/08/26',
    })
    expect(key).toMatch(
      /^file\/2026\/08\/26\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-报告\.docx$/i,
    )
    expect(displayNameFromStoredFilename(key)).toBe('报告.docx')
  })
})
