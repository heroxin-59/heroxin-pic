<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Top } from '@element-plus/icons-vue'
import { useBreakpoint } from '@/composables/useBreakpoint'

const props = withDefaults(
  defineProps<{
    /** 滚动超过该距离后显示按钮（px） */
    threshold?: number
  }>(),
  {
    threshold: 400,
  },
)

const visible = ref(false)
const { isMobile } = useBreakpoint()

function readScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || 0
}

function onScroll() {
  visible.value = readScrollTop() > props.threshold
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="back-to-top-fade">
      <button
        v-show="visible"
        type="button"
        class="back-to-top"
        :class="{ 'is-mobile': isMobile }"
        aria-label="回到顶部"
        @click="scrollToTop"
      >
        <el-icon :size="20"><Top /></el-icon>
      </button>
    </Transition>
  </Teleport>
</template>

<style scoped>
.back-to-top {
  position: fixed;
  right: calc(20px + var(--safe-right, 0px));
  bottom: calc(24px + var(--safe-bottom, 0px));
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: color-mix(in srgb, var(--brand-primary) 92%, #000);
  box-shadow: var(--app-shadow, 0 2px 12px rgba(0, 0, 0, 0.12));
  cursor: pointer;
  touch-action: manipulation;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.back-to-top.is-mobile {
  bottom: calc(var(--tabbar-height, 56px) + 16px + var(--safe-bottom, 0px));
}

@media (hover: hover) and (pointer: fine) {
  .back-to-top:hover {
    background: var(--brand-primary);
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.35);
  }
}

.back-to-top:active {
  transform: scale(0.94);
}

.back-to-top-fade-enter-active,
.back-to-top-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.back-to-top-fade-enter-from,
.back-to-top-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
