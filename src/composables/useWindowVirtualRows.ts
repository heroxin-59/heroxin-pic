import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

type SizedItem = { offset: number; height: number }

/**
 * 基于窗口滚动的虚拟列表可视区间（按纵向 offset 排序的定高/变高项均可）。
 * 瀑布流侧向并列项依赖「按 offset 排序 + 区间扫描」。
 */
export function useWindowVirtualRows<T extends SizedItem>(options: {
  rootRef: Ref<HTMLElement | null>
  rows: Ref<T[]>
  /** 条目数 overscan；瀑布流建议再用 overscanPx */
  overscan?: number
  /** 额外上下像素缓冲（瀑布流推荐 800+） */
  overscanPx?: number
}) {
  const overscan = options.overscan ?? 3
  const overscanPx = options.overscanPx ?? 0
  const start = ref(0)
  const end = ref(0)
  let raf = 0

  const visibleRows = computed(() => options.rows.value.slice(start.value, end.value))

  function measureListTop(scrollTop: number): number {
    const el = options.rootRef.value
    if (!el) return 0
    return el.getBoundingClientRect().top + scrollTop
  }

  function update() {
    const rows = options.rows.value
    if (rows.length === 0) {
      start.value = 0
      end.value = 0
      return
    }

    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    const listTop = measureListTop(scrollTop)
    const relTop = scrollTop - listTop - overscanPx
    const relBottom = scrollTop - listTop + viewportHeight + overscanPx

    let lo = 0
    let hi = rows.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const row = rows[mid]!
      if (row.offset + row.height <= relTop) lo = mid + 1
      else hi = mid
    }
    let nextStart = lo
    let nextEnd = nextStart
    while (nextEnd < rows.length && rows[nextEnd]!.offset < relBottom) {
      nextEnd += 1
    }

    // 再向两端扩若干项，覆盖同高度邻列
    nextStart = Math.max(0, nextStart - overscan)
    nextEnd = Math.min(rows.length, nextEnd + overscan)

    start.value = nextStart
    end.value = nextEnd
  }

  function scheduleUpdate() {
    if (raf) return
    raf = window.requestAnimationFrame(() => {
      raf = 0
      update()
    })
  }

  watch(
    () => options.rows.value,
    () => scheduleUpdate(),
    { flush: 'post' },
  )

  onMounted(() => {
    update()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate, { passive: true })
  })

  onUnmounted(() => {
    if (raf) window.cancelAnimationFrame(raf)
    window.removeEventListener('scroll', scheduleUpdate)
    window.removeEventListener('resize', scheduleUpdate)
  })

  return {
    start,
    end,
    visibleRows,
    update,
    scheduleUpdate,
  }
}
