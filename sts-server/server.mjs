/**
 * STS 临时凭证签发服务
 *
 * 流程（与阿里云官方一致）：
 * 1. 服务端用 RAM 用户长期 Key 调用 AssumeRole
 * 2. 返回临时 AccessKeyId / AccessKeySecret / SecurityToken / Expiration
 * 3. 前端 ali-oss 用这三项初始化客户端（勿把长期 Key 放进 Vite 环境变量）
 *
 * 启动：
 *   cd sts-server && cp .env.example .env && pnpm install && pnpm start
 *
 * 前端 .env.local：
 *   VITE_STS_URL=http://127.0.0.1:7001/sts
 *   或开发代理：VITE_STS_URL=/api/sts
 */

import http from 'node:http'
import { URL } from 'node:url'
import OSS from 'ali-oss'
import dotenv from 'dotenv'

dotenv.config()

const PORT = Number(process.env.PORT || 7001)
const ACCESS_KEY_ID = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim() ?? ''
const ACCESS_KEY_SECRET = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim() ?? ''
const ROLE_ARN = process.env.ALIBABA_CLOUD_ROLE_ARN?.trim() ?? ''
const SESSION_NAME = process.env.ALIBABA_CLOUD_ROLE_SESSION_NAME?.trim() || 'heroxin-pic'
const EXPIRE_SECONDS = Math.min(
  3600,
  Math.max(900, Number(process.env.ALIBABA_CLOUD_TOKEN_EXPIRE_SECONDS || 3600)),
)
const POLICY_RAW = process.env.ALIBABA_CLOUD_POLICY?.trim() || ''
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function requireConfig() {
  const missing = []
  if (!ACCESS_KEY_ID) missing.push('ALIBABA_CLOUD_ACCESS_KEY_ID')
  if (!ACCESS_KEY_SECRET) missing.push('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
  if (!ROLE_ARN) missing.push('ALIBABA_CLOUD_ROLE_ARN')
  if (missing.length) {
    throw new Error(`缺少环境变量：${missing.join(', ')}。请复制 sts-server/.env.example 为 .env 并填写。`)
  }
}

function parsePolicy() {
  if (!POLICY_RAW) return null
  try {
    return JSON.parse(POLICY_RAW)
  } catch {
    throw new Error('ALIBABA_CLOUD_POLICY 不是合法 JSON')
  }
}

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

async function assumeRole() {
  requireConfig()
  const policy = parsePolicy()
  const sts = new OSS.STS({
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
  })

  const result = await sts.assumeRole(ROLE_ARN, policy, EXPIRE_SECONDS, SESSION_NAME)
  const credentials = result.credentials
  if (!credentials?.AccessKeyId || !credentials?.AccessKeySecret || !credentials?.SecurityToken) {
    throw new Error('AssumeRole 返回缺少 Credentials 字段')
  }

  return {
    AccessKeyId: credentials.AccessKeyId,
    AccessKeySecret: credentials.AccessKeySecret,
    SecurityToken: credentials.SecurityToken,
    Expiration: credentials.Expiration,
  }
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
      const credentials = await assumeRole()
      sendJson(res, 200, credentials)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[sts]', message)
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
  console.log('[sts-server] 前端设置 VITE_STS_URL=http://127.0.0.1:%s/sts 或开发代理 /api/sts', PORT)
})
