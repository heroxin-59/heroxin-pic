import { Folder, Picture, Upload } from '@element-plus/icons-vue'
import type { Component } from 'vue'

export interface NavItem {
  path: string
  title: string
  icon: Component
}

export const mainNavItems: NavItem[] = [
  { path: '/', title: '上传', icon: Upload },
  { path: '/files', title: '文件列表', icon: Folder },
  { path: '/images', title: '图片', icon: Picture },
]
