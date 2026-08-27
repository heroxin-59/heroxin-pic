import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv, type Plugin } from 'vite'
import { DEFAULT_APP_TITLE, resolveAppTitle } from '../src/config/appTitle.ts'

function loadManifestTemplate(rootDir: string): Record<string, unknown> {
  const path = resolve(rootDir, 'public/manifest.webmanifest')
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
}

function buildManifest(rootDir: string, title: string): string {
  const template = loadManifestTemplate(rootDir)
  return JSON.stringify({ ...template, name: title, short_name: title }, null, 2)
}

function injectAppTitle(html: string, title: string): string {
  return html
    .replace(
      /<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/?>/,
      `<meta name="apple-mobile-web-app-title" content="${title}" />`,
    )
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
}

/** 按 VITE_APP_TITLE 注入 index.html 与 manifest.webmanifest */
export function appMetaPlugin(rootDir: string): Plugin {
  let title = DEFAULT_APP_TITLE

  return {
    name: 'app-meta',
    config(_, { mode }) {
      const env = loadEnv(mode, rootDir, '')
      title = resolveAppTitle(env.VITE_APP_TITLE)
    },
    transformIndexHtml(html) {
      return injectAppTitle(html, title)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/manifest.webmanifest' || url?.endsWith('/manifest.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
          res.end(buildManifest(rootDir, title))
          return
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: buildManifest(rootDir, title),
      })
    },
  }
}
