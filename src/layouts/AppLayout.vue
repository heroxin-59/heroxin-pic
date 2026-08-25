<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { mainNavItems } from '@/constants/navigation'

const route = useRoute()

const pageTitle = computed(() => {
  const title = route.meta.title
  return typeof title === 'string' ? title : 'heroxin-pic'
})
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="brand">heroxin-pic</div>
      <div class="mobile-page-title">{{ pageTitle }}</div>
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
      <router-view />
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
  background: linear-gradient(160deg, #f5f7fa 0%, #e8eef5 100%);
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid #e4e7ed;
  backdrop-filter: blur(8px);
}

.brand {
  font-weight: 700;
  font-size: 1.05rem;
  color: #303133;
}

.mobile-page-title {
  display: none;
  font-size: 0.95rem;
  font-weight: 600;
  color: #606266;
  text-align: center;
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
  color: #606266;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 8px;
  transition:
    color 0.2s,
    background-color 0.2s;
}

.desktop-nav__link:hover {
  color: #409eff;
  background: #f5f7fa;
}

.desktop-nav__link.router-link-active {
  color: #409eff;
  background: #ecf5ff;
}

.app-main {
  flex: 1;
  width: min(960px, 100%);
  margin: 0 auto;
  padding: 16px;
}

.mobile-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid #e4e7ed;
  padding-bottom: env(safe-area-inset-bottom, 0);
  backdrop-filter: blur(8px);
}

.mobile-tabbar__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 56px;
  color: #909399;
  text-decoration: none;
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
  color: #409eff;
}

@media (max-width: 767px) {
  .app-header {
    grid-template-columns: auto 1fr auto;
  }

  .mobile-page-title {
    display: block;
  }

  .app-main {
    padding-bottom: calc(72px + env(safe-area-inset-bottom, 0));
  }
}

@media (min-width: 768px) {
  .app-header {
    grid-template-columns: auto 1fr;
    padding: 12px 20px;
  }

  .mobile-page-title {
    display: none;
  }

  .desktop-nav {
    display: flex;
  }

  .mobile-tabbar {
    display: none;
  }

  .app-main {
    padding: 20px;
  }
}
</style>
