import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), copyPdfjsAssetsPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    // ali-oss 部分依赖会引用 Node 的 global
    global: 'globalThis',
  },
  server: {
    // 本地 sts-server 默认 :7001；前端设 VITE_STS_URL=/api/sts 即可免跨域
    proxy: {
      '/api/sts': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sts/, '/sts'),
      },
    },
  },
  optimizeDeps: {
    include: ['ali-oss', 'pdfjs-dist'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts'],
  },
})
