/**
 * STS 临时凭证签发服务（独立进程，用于生产或需要单独部署时）
 *
 * 本地开发已内嵌在 Vite：`pnpm dev` 即可，无需单独启动本服务。
 * 启动独立服务：
 *   cd sts-server && cp .env.example .env && pnpm install && pnpm start
 */

import http from 'node:http'
import { URL } from 'node:url'
import { assumeRoleCredentials, loadStsEnv } from '../scripts/sts/assumeRole.mjs'

loadStsEnv()

const PORT = Number(process.env.PORT || 7001)
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function setCors(req, res) {
  const origin = req.headers.origin || ''
  if (CORS_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*')
  } else if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type')
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

const server = http.createServer(async (req, res) => {
  setCors(req, res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname.replace(/\/+$/, '') || '/'

  if (req.method === 'GET' && (path === '/sts' || path === '/api/sts')) {
    try {
      const credentials = await assumeRoleCredentials()
      sendJson(res, 200, credentials)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[sts-server]', message)
      sendJson(res, 500, { error: 'STS_ASSUME_ROLE_FAILED', message })
    }
    return
  }

  if (req.method === 'GET' && path === '/health') {
    sendJson(res, 200, { ok: true })
    return
  }

  sendJson(res, 404, { error: 'NOT_FOUND', message: 'GET /sts' })
})

server.listen(PORT, () => {
  console.log(`[sts-server] http://127.0.0.1:${PORT}/sts`)
  console.log('[sts-server] 本地开发请直接用根目录 pnpm dev（STS 已内嵌）')
})
