/**
 * 断点约定（与 Element Plus 对齐）
 * @see https://element-plus.org/zh-CN/component/layout.html#col-attributes
 *
 * | 名称 | 含义                         | 宽度         |
 * | ---- | ---------------------------- | ------------ |
 * | xs   | 超小屏（手机竖屏为主）       | < 768px      |
 * | sm   | 小屏（平板 / 大手机横屏）    | ≥ 768px      |
 * | md   | 中等屏                       | ≥ 992px      |
 * | lg   | 大屏                         | ≥ 1200px     |
 * | xl   | 超大屏                       | ≥ 1920px     |
 */
export const BREAKPOINTS = {
  /** xs 上限（含）：手机 */
  xsMax: 767,
  sm: 768,
  md: 992,
  lg: 1200,
  xl: 1920,
} as const

export type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/** 兼容旧命名：移动端判定（xs） */
export const MOBILE_MAX_WIDTH = BREAKPOINTS.xsMax

export function resolveBreakpoint(width: number): BreakpointName {
  if (width >= BREAKPOINTS.xl) return 'xl'
  if (width >= BREAKPOINTS.lg) return 'lg'
  if (width >= BREAKPOINTS.md) return 'md'
  if (width >= BREAKPOINTS.sm) return 'sm'
  return 'xs'
}
