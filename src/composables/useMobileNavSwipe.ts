import { onMounted, onUnmounted, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  isHorizontalScrollTarget,
  isMainNavPath,
  resolveMainNavSwipeTarget,
} from '@/utils/mobileNavSwipe'

export interface UseMobileNavSwipeOptions {
  enabled: Ref<boolean>
  /** 绑定触摸监听的根元素（通常为 app-main） */
  rootRef: Ref<HTMLElement | null>
}

const SWIPE_THRESHOLD_PX = 56
const AXIS_RATIO = 1.35

/**
 * 移动端主导航左右滑：左滑 → 左侧 Tab，右滑 → 右侧 Tab。
 * 仅在上传 / 文件列表 / 相册三页生效。
 */
export function useMobileNavSwipe(options: UseMobileNavSwipeOptions) {
  const route = useRoute()
  const router = useRouter()

  let touchStartX = 0
  let touchStartY = 0
  let tracking = false
  let boundEl: HTMLElement | null = null

  function onTouchStart(event: TouchEvent) {
    if (!options.enabled.value) return
    if (!isMainNavPath(route.path)) return
    if (event.touches.length !== 1) return
    if (isHorizontalScrollTarget(event.target)) return

    const touch = event.touches[0]
    if (!touch) return

    touchStartX = touch.clientX
    touchStartY = touch.clientY
    tracking = true
  }

  function onTouchEnd(event: TouchEvent) {
    if (!tracking) return
    tracking = false

    if (!options.enabled.value) return
    if (!isMainNavPath(route.path)) return

    const touch = event.changedTouches[0]
    if (!touch) return

    const dx = touch.clientX - touchStartX
    const dy = touch.clientY - touchStartY

    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    if (Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return

    const targetPath = resolveMainNavSwipeTarget(route.path, dx)
    if (!targetPath || targetPath === route.path) return

    void router.push(targetPath)
  }

  function onTouchCancel() {
    tracking = false
  }

  function bind(el: HTMLElement | null) {
    unbind()
    if (!el) return
    boundEl = el
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })
  }

  function unbind() {
    if (!boundEl) return
    boundEl.removeEventListener('touchstart', onTouchStart)
    boundEl.removeEventListener('touchend', onTouchEnd)
    boundEl.removeEventListener('touchcancel', onTouchCancel)
    boundEl = null
  }

  onMounted(() => {
    bind(options.rootRef.value)
  })

  onUnmounted(() => {
    unbind()
    tracking = false
  })

  function rebind() {
    bind(options.rootRef.value)
  }

  return { rebind }
}
