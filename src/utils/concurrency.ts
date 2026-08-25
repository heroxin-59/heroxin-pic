/**
 * 简单并发限流：同时最多 `max` 个任务在跑，其余排队。
 */
export function createLimiter(max: number) {
  const limit = Math.max(1, Math.floor(max))
  let active = 0
  const waiters: Array<() => void> = []

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => {
        waiters.push(resolve)
      })
    }
    active += 1
    try {
      return await fn()
    } finally {
      active -= 1
      waiters.shift()?.()
    }
  }

  return { run }
}
