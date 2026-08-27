/**
 * 开发 / preview 内嵌 STS：GET /api/sts（与 VITE_STS_URL=/api/sts 对齐）
 */

import type { ServerResponse } from 'node:http'
import type { Connect } from 'vite'
import type { Plugin } from 'vite'
// @ts-expect-error 共享 Node 脚本，无类型声明
import { assumeRoleCredentials, hasStsEnvFile } from '../scripts/sts/assumeRole.mjs'

const STS_PATHS = new Set(['/api/sts', '/sts'])

function normalizePath(url = '') {
  const path = url.split('?')[0]?.replace(/\/+$/, '') || '/'
  return path
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function createStsMiddleware(): Connect.NextHandleFunction {
  let warnedMissingEnv = false

  return async (req, res, next) => {
    const path = normalizePath(req.url)
    if (!STS_PATHS.has(path)) {
      next()
      return
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'GET /api/sts' })
      return
    }

    if (!hasStsEnvFile() && !warnedMissingEnv) {
      warnedMissingEnv = true
      console.warn(
        '[sts-dev] 未找到 STS 配置。请在项目根目录创建 .env.local，填写 ALIBABA_CLOUD_*（说明见 .env）。',
      )
    }

    try {
      const credentials = await assumeRoleCredentials()
      sendJson(res, 200, credentials)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[sts-dev]', message)
      sendJson(res, 500, { error: 'STS_ASSUME_ROLE_FAILED', message })
    }
  }
}

function attachStsMiddleware(server: { middlewares: Connect.Server }) {
  server.middlewares.use(createStsMiddleware())
  console.log('[sts-dev] 内嵌 STS：GET /api/sts（配置见根目录 .env / .env.local）')
}

export function stsDevPlugin(): Plugin {
  return {
    name: 'sts-dev-middleware',
    configureServer(server) {
      attachStsMiddleware(server)
    },
    configurePreviewServer(server) {
      attachStsMiddleware(server)
    },
  }
}
