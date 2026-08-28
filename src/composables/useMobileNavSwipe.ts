import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mainNavItems } from '@/constants/navigation'
import {
  getMainNavIndex,
  isMainNavPath,
  isNavSwipeBlockedTarget,
  resolveMainNavSwipeTarget,
  resolveNavTransitionName,
  shouldBlockNavSwipe,
} from '@/utils/mobileNavSwipe'

export interface UseMobileNavSwipeOptions {
  enabled: Ref<boolean>
}

const SWIPE_DISTANCE_PX = 42
const SWIPE_VELOCITY_PX_MS = 0.28
const AXIS_LOCK_PX = 8
const AXIS_RATIO = 1.15
const EDGE_RESISTANCE = 0.32

/**
 * 移动端主导航左右滑：左滑 → 右侧 Tab，右滑 → 左侧 Tab（对齐 iOS / Android 桌面）。
 * 仅在上传 / 文件列表 / 相册三页生效。
 */
export function useMobileNavSwipe(options: UseMobileNavSwipeOptions) {
  const route = useRoute()
  const router = useRouter()

  const dragOffsetX = ref(0)
  const isDragging = ref(false)
  const navTransitionName = ref('')

  let touchStartX = 0
  let touchStartY = 0
  let touchStartTime = 0
  let touchTarget: EventTarget | null = null
  let tracking = false
  let axisLocked: 'horizontal' | 'vertical' | null = null
  let navigating = false

  function applyEdgeResistance(dx: number, path: string): number {
    const index = getMainNavIndex(path)
    if (index < 0) return dx
    if (index <= 0 && dx > 0) return dx * EDGE_RESISTANCE
    if (index >= mainNavItems.length - 1 && dx < 0) return dx * EDGE_RESISTANCE
    return dx
  }

  function resetGesture() {
    tracking = false
    axisLocked = null
    touchTarget = null
    isDragging.value = false
    document.removeEventListener('touchmove', onTouchMove)
  }

  function snapBack() {
    isDragging.value = false
    dragOffsetX.value = 0
  }

  function onTouchStart(event: TouchEvent) {
    if (!options.enabled.value || navigating) return
    if (!isMainNavPath(route.path)) return
    if (event.touches.length !== 1) return

    const target = event.target
    if (isNavSwipeBlockedTarget(target)) return

    const touch = event.touches[0]
    if (!touch) return

    touchStartX = touch.clientX
    touchStartY = touch.clientY
    touchStartTime = performance.now()
    touchTarget = target
    tracking = true
    axisLocked = null
    isDragging.value = false
    dragOffsetX.value = 0

    document.addEventListener('touchmove', onTouchMove, { passive: false })
  }

  function onTouchMove(event: TouchEvent) {
    if (!tracking || !options.enabled.value) return
    if (!isMainNavPath(route.path)) {
      resetGesture()
      return
    }

    const touch = event.touches[0]
    if (!touch) return

    const dx = touch.clientX - touchStartX
    const dy = touch.clientY - touchStartY

    if (!axisLocked) {
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (absX < AXIS_LOCK_PX && absY < AXIS_LOCK_PX) return

      if (absY > absX * AXIS_RATIO) {
        axisLocked = 'vertical'
        resetGesture()
        return
      }

      if (absX > absY * AXIS_RATIO) {
        if (shouldBlockNavSwipe(touchTarget, dx)) {
          axisLocked = 'vertical'
          resetGesture()
          return
        }
        axisLocked = 'horizontal'
        isDragging.value = true
      } else {
        return
      }
    }

    if (axisLocked !== 'horizontal') return

    event.preventDefault()
    dragOffsetX.value = applyEdgeResistance(dx, route.path)
  }

  async function onTouchEnd(event: TouchEvent) {
    document.removeEventListener('touchmove', onTouchMove)

    if (!tracking) return
    const wasHorizontal = axisLocked === 'horizontal'
    const currentDx = dragOffsetX.value
    const startTarget = touchTarget
    resetGesture()

    if (!options.enabled.value || !wasHorizontal) {
      snapBack()
      return
    }
    if (!isMainNavPath(route.path)) {
      snapBack()
      return
    }

    const touch = event.changedTouches[0]
    if (!touch) {
      snapBack()
      return
    }

    const dx = touch.clientX - touchStartX
    const dy = touch.clientY - touchStartY
    const elapsed = Math.max(performance.now() - touchStartTime, 1)
    const velocity = Math.abs(dx) / elapsed

    if (Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) {
      snapBack()
      return
    }

    if (shouldBlockNavSwipe(startTarget, dx)) {
      snapBack()
      return
    }

    const passedDistance = Math.abs(dx) >= SWIPE_DISTANCE_PX
    const passedVelocity = velocity >= SWIPE_VELOCITY_PX_MS && Math.abs(dx) >= 18
    if (!passedDistance && !passedVelocity) {
      snapBack()
      return
    }

    const targetPath = resolveMainNavSwipeTarget(route.path, dx)
    if (!targetPath || targetPath === route.path) {
      snapBack()
      return
    }

    const fromPath = route.path
    navTransitionName.value = resolveNavTransitionName(fromPath, targetPath)
    navigating = true
    isDragging.value = false

    const commitDirection = dx < 0 ? -1 : 1
    const width = window.innerWidth
    dragOffsetX.value = commitDirection * Math.min(Math.abs(currentDx), width * 0.42)

    requestAnimationFrame(() => {
      dragOffsetX.value = commitDirection * -width * 0.18
    })

    try {
      await router.push(targetPath)
    } finally {
      dragOffsetX.value = 0
      navigating = false
    }
  }

  function onTouchCancel() {
    document.removeEventListener('touchmove', onTouchMove)
    resetGesture()
    snapBack()
  }

  onMounted(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true })
    document.addEventListener('touchcancel', onTouchCancel, { passive: true, capture: true })
  })

  onUnmounted(() => {
    document.removeEventListener('touchstart', onTouchStart, true)
    document.removeEventListener('touchend', onTouchEnd, true)
    document.removeEventListener('touchcancel', onTouchCancel, true)
    document.removeEventListener('touchmove', onTouchMove)
    resetGesture()
    dragOffsetX.value = 0
  })

  return {
    dragOffsetX,
    isDragging,
    navTransitionName,
    resolveNavTransitionName,
  }
}
