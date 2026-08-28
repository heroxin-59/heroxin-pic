import { mainNavItems } from '@/constants/navigation'

/** 是否为主 Tab 页（上传 / 文件列表 / 相册） */
export function isMainNavPath(path: string): boolean {
  return mainNavItems.some((item) => item.path === path)
}

export function getMainNavIndex(path: string): number {
  return mainNavItems.findIndex((item) => item.path === path)
}

/**
 * 根据滑动方向解析目标 Tab（与 iOS / Android 桌面一致）：
 * 左滑 → 右侧 Tab；右滑 → 左侧 Tab。
 */
export function resolveMainNavSwipeTarget(
  currentPath: string,
  deltaX: number,
): string | null {
  if (Math.abs(deltaX) < 1) return null

  const index = getMainNavIndex(currentPath)
  if (index < 0) return null

  const nextIndex = deltaX < 0 ? index + 1 : index - 1
  if (nextIndex < 0 || nextIndex >= mainNavItems.length) return null
  return mainNavItems[nextIndex]!.path
}

/** 路由切换动画名：切到右侧 Tab 为 `nav-slide-left`，反之为 `nav-slide-right` */
export function resolveNavTransitionName(fromPath: string, toPath: string): string {
  const fromIndex = getMainNavIndex(fromPath)
  const toIndex = getMainNavIndex(toPath)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return ''
  return toIndex > fromIndex ? 'nav-slide-left' : 'nav-slide-right'
}

const NAV_SWIPE_BLOCK_SELECTOR = [
  '.pswp',
  '.mobile-video-preview',
  '.mobile-image-preview-boot',
  '.mobile-tabbar',
  '.album-action-bar',
  '.el-overlay',
  '.el-dialog',
  '.el-drawer',
  '.el-message-box',
  '[data-nav-swipe-block]',
].join(',')

/** 触摸是否起始于应禁用主导航滑动的区域 */
export function isNavSwipeBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(NAV_SWIPE_BLOCK_SELECTOR))
}

function canElementScrollHorizontally(el: HTMLElement, deltaX: number): boolean {
  const style = window.getComputedStyle(el)
  const overflowX = style.overflowX
  if (!['auto', 'scroll', 'overlay'].includes(overflowX)) return false
  if (el.scrollWidth <= el.clientWidth + 2) return false

  const maxScroll = el.scrollWidth - el.clientWidth
  if (deltaX < 0 && el.scrollLeft < maxScroll - 1) return true
  if (deltaX > 0 && el.scrollLeft > 1) return true
  return false
}

/** 触摸是否起始于可横向滚动的区域，且本次滑动会触发该区域的横滚 */
export function shouldBlockNavSwipe(target: EventTarget | null, deltaX: number): boolean {
  if (!(target instanceof Element)) return false
  if (Math.abs(deltaX) < 1) return false

  let el: Element | null = target
  while (el) {
    if (el instanceof HTMLElement && canElementScrollHorizontally(el, deltaX)) {
      return true
    }
    el = el.parentElement
  }
  return false
}

/** @deprecated 使用 {@link shouldBlockNavSwipe} */
export function isHorizontalScrollTarget(target: EventTarget | null): boolean {
  return shouldBlockNavSwipe(target, -1) || shouldBlockNavSwipe(target, 1)
}
