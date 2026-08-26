import { describe, expect, it } from 'vitest'
import { AppError } from '@/types/error'
import { getErrorCode, getErrorMessage, toAppError } from '@/utils/error'

describe('toAppError', () => {
  it('passes through AppError', () => {
    const original = new AppError('FILE_TYPE', '类型不对')
    expect(toAppError(original)).toBe(original)
  })

  it('maps CORS-like network failures', () => {
    const error = toAppError(new Error('XHR error status: -1 (connected: false)'))
    expect(error.code).toBe('CORS')
    expect(error.message).toMatch(/CORS/)
  })

  it('maps AccessDenied to PERMISSION', () => {
    const error = toAppError({ code: 'AccessDenied', message: 'denied', status: 403 })
    expect(error.code).toBe('PERMISSION')
  })

  it('maps NoSuchKey to NOT_FOUND', () => {
    const error = toAppError({ code: 'NoSuchKey', status: 404 })
    expect(error.code).toBe('NOT_FOUND')
  })

  it('maps cancel text to CANCELLED', () => {
    expect(getErrorCode(new Error('upload aborted by user'))).toBe('CANCELLED')
  })

  it('falls back to UNKNOWN with message', () => {
    const error = toAppError(new Error('something broke'))
    expect(error.code).toBe('UNKNOWN')
    expect(getErrorMessage(error)).toBe('something broke')
  })
})
