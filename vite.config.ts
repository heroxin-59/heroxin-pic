import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { stsDevPlugin } from './vite-plugins/stsDevPlugin.ts'
import { appMetaPlugin } from './vite-plugins/appMetaPlugin.ts'

const rootDir = dirname(fileURLToPath(import.meta.url))

/** 将 pdf.js 的 CMap / 标准字体 / wasm 复制到 public（中文 CID + JBIG2 扫描件） */
function copyPdfjsAssetsPlugin(): Plugin {
  const copy = () => {
    const srcRoot = resolve(rootDir, 'node_modules/pdfjs-dist')
    const outRoot = resolve(rootDir, 'public/pdfjs')
    if (!existsSync(srcRoot)) return

    try {
      mkdirSync(outRoot, { recursive: true })
      cpSync(resolve(srcRoot, 'cmaps'), resolve(outRoot, 'cmaps'), { recursive: true })
      cpSync(resolve(srcRoot, 'standard_fonts'), resolve(outRoot, 'standard_fonts'), {
        recursive: true,
      })
      cpSync(resolve(srcRoot, 'wasm'), resolve(outRoot, 'wasm'), { recursive: true })
    } catch (error) {
      // 开发服务占用文件时可能 EPERM；已有 public/pdfjs 则可跳过
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[copy-pdfjs-assets] skip copy: ${message}`)
    }
  }

  return {
    name: 'copy-pdfjs-assets',
    buildStart() {
      copy()
    },
    configureServer() {
      copy()
    },
  }
}

/** 子路径部署：构建前设置 VITE_BASE=/pic/（须以 / 开头并以 / 结尾；根路径用 /） */
function resolveBase(): string {
  const raw = (process.env.VITE_BASE ?? '/').trim() || '/'
  if (raw === '/') return '/'
  const withLead = raw.startsWith('/') ? raw : `/${raw}`
  return withLead.endsWith('/') ? withLead : `${withLead}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBase(),
  plugins: [vue(), copyPdfjsAssetsPlugin(), appMetaPlugin(rootDir), stsDevPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    // ali-oss 部分依赖会引用 Node 的 global
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['ali-oss', 'pdfjs-dist'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts'],
  },
})
