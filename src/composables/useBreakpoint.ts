import { onMounted, onUnmounted, ref } from 'vue'

/** 与 AppLayout 移动端断点一致 */
export const MOBILE_MAX_WIDTH = 767

export function useBreakpoint() {
  const isMobile = ref(false)
  let mediaQuery: MediaQueryList | null = null

  function sync() {
    isMobile.value = mediaQuery?.matches ?? window.innerWidth <= MOBILE_MAX_WIDTH
  }

  onMounted(() => {
    mediaQuery = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
    sync()
    mediaQuery.addEventListener('change', sync)
  })

  onUnmounted(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', sync)
    }
  })

  return { isMobile }
}
