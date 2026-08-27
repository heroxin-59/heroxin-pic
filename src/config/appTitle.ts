/** 未配置 VITE_APP_TITLE 时的默认展示名（与 package.json name 可不同） */
export const DEFAULT_APP_TITLE = 'heroxin-pic'

export function resolveAppTitle(value?: string): string {
  const trimmed = value?.trim()
  return trimmed || DEFAULT_APP_TITLE
}
