<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppErrorBoundary from '@/components/AppErrorBoundary.vue'
import { appTitle } from '@/config/appMeta'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useMobileNavSwipe } from '@/composables/useMobileNavSwipe'
import { mainNavItems } from '@/constants/navigation'
import { useFileStore } from '@/stores/files'
import { isMainNavPath } from '@/utils/mobileNavSwipe'

const route = useRoute()
const fileStore = useFileStore()
const { isMobile, isCompactHeight, isLandscape } = useBreakpoint()

const { dragOffsetX, isDragging, navTransitionName, resolveNavTransitionName } = useMobileNavSwipe({
  enabled: isMobile,
})

const layoutClass = computed(() => ({
  'is-mobile': isMobile.value,
  'is-landscape': isLandscape.value,
  'is-compact': isMobile.value && isCompactHeight.value,
  'is-nav-dragging': isDragging.value,
}))

const viewportStyle = computed(() => {
  if (!isMobile.value || dragOffsetX.value === 0) return undefined
  return {
    transform: `translate3d(${dragOffsetX.value}px, 0, 0)`,
    transition: isDragging.value ? 'none' : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
  }
})

watch(
  () => route.path,
  (to, from) => {
    if (!isMobile.value || !from || !isMainNavPath(to) || !isMainNavPath(from)) return
    if (to === from) return
    navTransitionName.value = resolveNavTransitionName(from, to)
  },
)

onMounted(() => {
  void fileStore.ensureFullListLoaded().catch(() => {
    // 各页面挂载时会再次尝试；此处仅做首屏预加载
  })
})

/** 路由变化时重置错误边界，避免卡在错误页 */
const boundaryKey = computed(() => route.fullPath)
</script>

<template>
  <div class="app-layout" :class="layoutClass">
    <header class="app-header">
      <div class="brand">{{ appTitle }}</div>
      <nav class="desktop-nav" aria-label="主导航">
        <router-link
          v-for="item in mainNavItems"
          :key="item.path"
          :to="item.path"
          class="desktop-nav__link"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </router-link>
      </nav>
    </header>

    <main class="app-main">
      <div class="app-main__viewport" :style="viewportStyle">
        <router-view v-slot="{ Component }">
          <transition :name="isMobile && navTransitionName ? navTransitionName : undefined">
            <div :key="route.path" class="app-main__page">
              <AppErrorBoundary :reset-key="boundaryKey">
                <component :is="Component" />
              </AppErrorBoundary>
            </div>
          </transition>
        </router-view>
      </div>
    </main>

    <nav class="mobile-tabbar" aria-label="底部导航">
      <router-link
        v-for="item in mainNavItems"
        :key="item.path"
        :to="item.path"
        class="mobile-tabbar__item"
      >
        <el-icon class="mobile-tabbar__icon"><component :is="item.icon" /></el-icon>
        <span class="mobile-tabbar__label">{{ item.title }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, var(--app-bg) 0%, var(--app-bg-accent) 100%);
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  min-height: var(--header-height, 52px);
  padding: calc(10px + var(--safe-top, 0px)) calc(16px + var(--safe-right, 0px)) 10px
    calc(16px + var(--safe-left, 0px));
  background: color-mix(in srgb, var(--app-surface) 92%, transparent);
  border-bottom: 1px solid var(--app-border);
  backdrop-filter: blur(8px);
}

.brand {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--app-text);
}

.desktop-nav {
  display: none;
  justify-content: flex-end;
  gap: 8px;
}

.desktop-nav__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-secondary);
  text-decoration: none;
  min-height: var(--touch-min, 44px);
  padding: 8px 12px;
  border-radius: var(--app-radius-sm);
  transition:
    color 0.2s,
    background-color 0.2s;
}

@media (hover: hover) and (pointer: fine) {
  .desktop-nav__link:hover {
    color: var(--brand-primary);
    background: var(--app-surface-muted);
  }
}

.desktop-nav__link.router-link-active {
  color: var(--brand-primary);
  background: var(--brand-primary-soft);
}

.app-main {
  flex: 1;
  width: min(960px, 100%);
  margin: 0 auto;
  padding: 16px;
  padding-left: max(16px, var(--safe-left, 0px));
  padding-right: max(16px, var(--safe-right, 0px));
  overflow: hidden;
}

.app-main__viewport {
  position: relative;
  min-height: 100%;
  will-change: transform;
}

.app-main__page {
  width: 100%;
}

.app-layout.is-nav-dragging .app-main__viewport {
  touch-action: none;
}

.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-left-enter-active),
.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-left-leave-active),
.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-right-enter-active),
.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-right-leave-active) {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-left-enter-active),
.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-left-leave-active),
.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-right-enter-active),
.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-right-leave-active) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-left-enter-from) {
  transform: translate3d(100%, 0, 0);
}

.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-left-leave-to) {
  transform: translate3d(-24%, 0, 0);
}

.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-right-enter-from) {
  transform: translate3d(-100%, 0, 0);
}

.app-layout.is-mobile .app-main__viewport :deep(.nav-slide-right-leave-to) {
  transform: translate3d(24%, 0, 0);
}

.mobile-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: none;
  grid-template-columns: repeat(3, 1fr);
  background: color-mix(in srgb, var(--app-surface) 96%, transparent);
  border-top: 1px solid var(--app-border);
  padding-bottom: var(--safe-bottom, 0px);
  padding-left: var(--safe-left, 0px);
  padding-right: var(--safe-right, 0px);
  backdrop-filter: blur(8px);
}

.mobile-tabbar__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: var(--tabbar-height, 56px);
  color: var(--app-text-muted);
  text-decoration: none;
  touch-action: manipulation;
  transition: color 0.2s;
}

.mobile-tabbar__icon {
  font-size: 20px;
}

.mobile-tabbar__label {
  font-size: 11px;
  line-height: 1;
}

.mobile-tabbar__item.router-link-active {
  color: var(--brand-primary);
}

/* xs：手机 — 隐藏顶栏，底栏导航 */
@media (max-width: 767px) {
  .app-header {
    display: none;
  }

  .mobile-tabbar {
    display: grid;
  }

  .app-main {
    width: 100%;
    padding-top: calc(16px + var(--safe-top, 0px));
    padding-bottom: calc(var(--tabbar-height, 56px) + 16px + var(--safe-bottom, 0px));
  }

  .app-main__viewport {
    min-height: calc(
      100dvh - var(--tabbar-height, 56px) - 32px - var(--safe-top, 0px) - var(--safe-bottom, 0px)
    );
  }
}

/* sm+：桌面顶栏导航，隐藏底栏 */
@media (min-width: 768px) {
  .app-header {
    grid-template-columns: auto 1fr;
    padding: 12px calc(20px + var(--safe-right, 0px)) 12px calc(20px + var(--safe-left, 0px));
  }

  .desktop-nav {
    display: flex;
  }

  .app-main {
    padding: 20px;
    padding-left: max(20px, var(--safe-left, 0px));
    padding-right: max(20px, var(--safe-right, 0px));
    overflow: visible;
  }
}

@media (min-width: 992px) {
  .app-main {
    width: min(1100px, 100%);
  }
}

@media (min-width: 1200px) {
  .app-main {
    width: min(1200px, 100%);
  }
}

/* 横屏短屏：压缩底栏，底栏可只显示图标 */
.app-layout.is-compact .mobile-tabbar__item {
  min-height: 44px;
  gap: 0;
}

.app-layout.is-compact .mobile-tabbar__label {
  display: none;
}

.app-layout.is-compact .app-main {
  padding-top: 10px;
  padding-bottom: calc(48px + 10px + var(--safe-bottom, 0px));
}
</style>
