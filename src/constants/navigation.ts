import { Folder, Picture, Plus } from '@element-plus/icons-vue'
import type { Component } from 'vue'

export interface NavItem {
  path: string
  title: string
  icon: Component
}

/** 主导航：相册 / 文件（上传改为中央加号入口） */
export const mainNavItems: NavItem[] = [
  { path: '/images', title: '相册', icon: Picture },
  { path: '/files', title: '文件', icon: Folder },
]

/** 上传页路由（底栏中央抬起加号 / 桌面顶栏加号） */
export const uploadNavItem: NavItem = {
  path: '/upload',
  title: '上传',
  icon: Plus,
}
