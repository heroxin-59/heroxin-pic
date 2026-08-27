import { createRouter, createWebHistory } from 'vue-router'
import { appTitle } from '@/config/appMeta'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '上传' },
    },
    {
      path: '/files',
      name: 'files',
      component: () => import('@/views/FileListView.vue'),
      meta: { title: '文件列表' },
    },
    {
      path: '/images',
      name: 'images',
      component: () => import('@/views/ImagesView.vue'),
      meta: { title: '相册' },
    },
    {
      path: '/preview',
      name: 'preview',
      component: () => import('@/views/PreviewView.vue'),
      meta: { title: '预览' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = title ? `${title} · ${appTitle}` : appTitle
})

export default router
