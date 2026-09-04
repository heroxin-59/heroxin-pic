import { createRouter, createWebHistory } from 'vue-router'
import { appTitle } from '@/config/appMeta'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/images',
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '上传' },
    },
    {
      path: '/images',
      name: 'images',
      component: () => import('@/views/ImagesView.vue'),
      meta: { title: '相册' },
    },
    {
      path: '/files',
      name: 'files',
      component: () => import('@/views/FileListView.vue'),
      meta: { title: '文件列表' },
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

router.afterEach(() => {
  document.title = appTitle
})

export default router
