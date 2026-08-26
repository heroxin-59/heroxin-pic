import { ElLoading } from 'element-plus'

export interface AppLoadingOptions {
  /** 加载文案 */
  text?: string
  /** 遮罩背景 */
  background?: string
}

type LoadingHandle = { close: () => void }

let loadingCount = 0
let loadingInstance: LoadingHandle | null = null

const DEFAULT_TEXT = '加载中…'
const DEFAULT_BACKGROUND = 'rgba(255, 255, 255, 0.72)'

/**
 * 全局全屏 Loading（可嵌套调用，需成对 hide）。
 * 区域加载请优先用 `v-loading`，勿与本 API 叠用在同一操作上。
 */
export function showAppLoading(options: AppLoadingOptions | string = {}) {
  const opts = typeof options === 'string' ? { text: options } : options
  loadingCount += 1
  if (loadingInstance) return

  loadingInstance = ElLoading.service({
    lock: true,
    text: opts.text ?? DEFAULT_TEXT,
    background: opts.background ?? DEFAULT_BACKGROUND,
  })
}

export function hideAppLoading() {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount > 0 || !loadingInstance) return
  loadingInstance.close()
  loadingInstance = null
}

/** 在异步任务期间显示全局 Loading，结束（含异常）后自动关闭 */
export async function withAppLoading<T>(
  task: () => Promise<T>,
  options: AppLoadingOptions | string = {},
): Promise<T> {
  showAppLoading(options)
  try {
    return await task()
  } finally {
    hideAppLoading()
  }
}
