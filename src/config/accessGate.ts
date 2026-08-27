import { sha256Hex } from '@/utils/sha256'

/** 构建时由 Vite 从 APP_ACCESS_PASSWORD 注入；空字符串表示未启用口令 */
declare const __APP_ACCESS_HASH__: string

export const ACCESS_SESSION_KEY = 'heroxin-access-unlocked'

export function accessGateHash(): string {
  return typeof __APP_ACCESS_HASH__ !== 'undefined' ? __APP_ACCESS_HASH__ : ''
}

export function isAccessGateEnabledForHash(hash: string): boolean {
  return hash.length > 0
}

export function isAccessGateEnabled(): boolean {
  return isAccessGateEnabledForHash(accessGateHash())
}

export function isAccessUnlockedForHash(hash: string): boolean {
  if (!isAccessGateEnabledForHash(hash)) return true
  try {
    return sessionStorage.getItem(ACCESS_SESSION_KEY) === hash
  } catch {
    return false
  }
}

export function isAccessUnlocked(): boolean {
  return isAccessUnlockedForHash(accessGateHash())
}

export function markAccessUnlockedForHash(hash: string) {
  if (!isAccessGateEnabledForHash(hash)) return
  sessionStorage.setItem(ACCESS_SESSION_KEY, hash)
}

export async function verifyAccessPassphraseForHash(
  passphrase: string,
  expectedHash: string,
): Promise<boolean> {
  if (!isAccessGateEnabledForHash(expectedHash)) return true
  const input = passphrase.trim()
  if (!input) return false
  const hash = await sha256Hex(input)
  if (hash !== expectedHash) return false
  markAccessUnlockedForHash(expectedHash)
  return true
}

export async function verifyAccessPassphrase(passphrase: string): Promise<boolean> {
  return verifyAccessPassphraseForHash(passphrase, accessGateHash())
}

export function clearAccessUnlock() {
  try {
    sessionStorage.removeItem(ACCESS_SESSION_KEY)
  } catch {
    // ignore
  }
}
