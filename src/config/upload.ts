/** 重名处理策略 */
export type DuplicateStrategy = 'uuid' | 'overwrite' | 'suffix'

export const DUPLICATE_STRATEGY_LABEL: Record<DuplicateStrategy, string> = {
  uuid: 'UUID 前缀（默认，避免冲突）',
  overwrite: '覆盖同名对象',
  suffix: '自动追加序号 (-1, -2…)',
}

function parseDuplicateStrategy(value: string | undefined): DuplicateStrategy {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'overwrite' || normalized === 'suffix' || normalized === 'uuid') {
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
