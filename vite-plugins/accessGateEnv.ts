import { createHash } from 'node:crypto'
import { loadEnv } from 'vite'

/** 从 APP_ACCESS_PASSWORD 生成 SHA-256 摘要；未配置则返回空字符串（不启用门禁） */
export function resolveAccessGateHash(mode: string, rootDir: string): string {
  const env = loadEnv(mode, rootDir, '')
  const password = env.APP_ACCESS_PASSWORD?.trim()
  if (!password) return ''
  return createHash('sha256').update(password, 'utf8').digest('hex')
}
