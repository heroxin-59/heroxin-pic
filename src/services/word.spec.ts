import { describe, expect, it } from 'vitest'
import { isDocFile, isDocxFile, isWordPreviewFile } from './word'

describe('word file helpers', () => {
  it('detects docx', () => {
    expect(isDocxFile('report.docx')).toBe(true)
    expect(isDocxFile('docx')).toBe(true)
  })

  it('detects doc but not docx', () => {
    expect(isDocFile('legacy.doc')).toBe(true)
    expect(isDocFile('doc')).toBe(true)
    expect(isDocFile('report.docx')).toBe(false)
  })

  it('groups previewable word formats', () => {
    expect(isWordPreviewFile('a.doc')).toBe(true)
    expect(isWordPreviewFile('a.docx')).toBe(true)
    expect(isWordPreviewFile('a.pdf')).toBe(false)
  })
})
