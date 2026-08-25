<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">heroxin-pic</div>
      <nav class="nav">
        <router-link to="/">上传</router-link>
        <router-link to="/files">文件列表</router-link>
        <router-link to="/preview">预览</router-link>
      </nav>
    </header>
    <main class="app-main">
      <router-view />
    </main>
    <footer class="app-footer">
      当前路由：{{ route.path }}
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #f5f7fa 0%, #e8eef5 100%);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid #e4e7ed;
}

.brand {
  font-weight: 700;
  font-size: 1.1rem;
}

.nav {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.nav a {
  color: #606266;
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 6px;
}

.nav a.router-link-active {
  color: #409eff;
  background: #ecf5ff;
}

.app-main {
  flex: 1;
  width: min(960px, 100%);
  margin: 0 auto;
  padding: 20px;
}

.app-footer {
  padding: 10px 20px;
  color: #909399;
  font-size: 12px;
  text-align: center;
}
</style>
