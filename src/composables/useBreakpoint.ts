import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  BREAKPOINTS,
  MOBILE_MAX_WIDTH,
  resolveBreakpoint,
  type BreakpointName,
} from '@/constants/breakpoints'

export { BREAKPOINTS, MOBILE_MAX_WIDTH, resolveBreakpoint }
export type { BreakpointName }

/**
 * 响应式断点（与 Element Plus / AppLayout 一致）。
 * - isMobile / isXs：宽度 ≤ 767
 * - isSmUp：≥ 768（平板及以上）
 * - isLandscape：横屏
 * - isCompactHeight：短屏（常见横屏手机），用于压缩底栏 / 内边距
 */
export function useBreakpoint() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : BREAKPOINTS.sm)
  const height = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
  const isLandscape = ref(false)

  let widthQuery: MediaQueryList | null = null
  let landscapeQuery: MediaQueryList | null = null

  function syncSize() {
    width.value = window.innerWidth
    height.value = window.innerHeight
  }

  function syncLandscape() {
    isLandscape.value =
      landscapeQuery?.matches ?? window.matchMedia('(orientation: landscape)').matches
  }

  function onResize() {
    syncSize()
  }

  onMounted(() => {
    syncSize()
    widthQuery = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
    landscapeQuery = window.matchMedia('(orientation: landscape)')
    syncLandscape()
    widthQuery.addEventListener('change', syncSize)
    landscapeQuery.addEventListener('change', syncLandscape)
    window.addEventListener('resize', onResize, { passive: true })
  })

  onUnmounted(() => {
    widthQuery?.removeEventListener('change', syncSize)
    landscapeQuery?.removeEventListener('change', syncLandscape)
    window.removeEventListener('resize', onResize)
  })

  const breakpoint = computed(() => resolveBreakpoint(width.value))
  const isXs = computed(() => breakpoint.value === 'xs')
  const isMobile = computed(() => isXs.value)
  const isSmUp = computed(() => width.value >= BREAKPOINTS.sm)
  const isMdUp = computed(() => width.value >= BREAKPOINTS.md)
  const isLgUp = computed(() => width.value >= BREAKPOINTS.lg)
  /** 横屏且高度偏矮时压缩布局 */
  const isCompactHeight = computed(() => height.value > 0 && height.value < 500)

  return {
    width,
    height,
    breakpoint,
    isXs,
    isMobile,
    isSmUp,
    isMdUp,
    isLgUp,
    isLandscape,
    isCompactHeight,
  }
}
