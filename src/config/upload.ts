/** 重名 / Key 命名策略 */
export type DuplicateStrategy = 'uuid' | 'timestamp' | 'overwrite' | 'suffix'

export const DUPLICATE_STRATEGY_LABEL: Record<DuplicateStrategy, string> = {
  uuid: '文件名-UUID.扩展名（默认）',
  timestamp: '文件名-时间戳.扩展名',
  overwrite: '覆盖同名对象',
  suffix: '自动追加序号 (-1, -2…)',
}

function parseDuplicateStrategy(value: string | undefined): DuplicateStrategy {
  const normalized = value?.trim().toLowerCase()
  if (
    normalized === 'overwrite' ||
    normalized === 'suffix' ||
    normalized === 'uuid' ||
    normalized === 'timestamp'
  ) {
    return normalized
  }
  return 'uuid'
}

export function getDuplicateStrategy(): DuplicateStrategy {
  return parseDuplicateStrategy(import.meta.env.VITE_DUPLICATE_STRATEGY)
}

export function getDuplicateStrategyLabel(): string {
  return DUPLICATE_STRATEGY_LABEL[getDuplicateStrategy()]
}
