import { mainNavItems } from '@/constants/navigation'

/** 是否为主 Tab 页（上传 / 文件列表 / 相册） */
export function isMainNavPath(path: string): boolean {
  return mainNavItems.some((item) => item.path === path)
}

/** 根据滑动方向解析目标 Tab：`左滑` → 左侧 Tab，`右滑` → 右侧 Tab */
export function resolveMainNavSwipeTarget(
  currentPath: string,
  deltaX: number,
): string | null {
  if (Math.abs(deltaX) < 1) return null

  const index = mainNavItems.findIndex((item) => item.path === currentPath)
  if (index < 0) return null

  // 手指左移（deltaX < 0）→ 切到左边 Tab；右移 → 右边 Tab
  const nextIndex = deltaX < 0 ? index - 1 : index + 1
  if (nextIndex < 0 || nextIndex >= mainNavItems.length) return null
  return mainNavItems[nextIndex]!.path
}

/** 触摸是否起始于可横向滚动的区域（避免与表格/列表横滑冲突） */
export function isHorizontalScrollTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  let el: Element | null = target
  while (el) {
    if (el instanceof HTMLElement) {
      const style = window.getComputedStyle(el)
      const overflowX = style.overflowX
      const canScrollX =
        (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') &&
        el.scrollWidth > el.clientWidth + 2
      if (canScrollX) return true
    }
    el = el.parentElement
  }
  return false
}
