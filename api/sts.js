/**
 * Vercel Serverless：GET /api/sts
 * 密钥来自 Project → Environment Variables（勿使用 VITE_ 前缀）
 */

import { assumeRoleCredentials } from '../scripts/sts/assumeRole.mjs'

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'GET /api/sts' })
    return
  }

  try {
    const credentials = await assumeRoleCredentials()
    sendJson(res, 200, credentials)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[api/sts]', message)
    sendJson(res, 500, { error: 'STS_ASSUME_ROLE_FAILED', message })
  }
}
