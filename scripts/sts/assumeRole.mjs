/**
 * STS AssumeRole 逻辑（开发内嵌 / sts-server 独立进程共用）
 */

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import OSS from 'ali-oss'
import dotenv from 'dotenv'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const stsEnvPath = resolve(repoRoot, 'sts-server/.env')

let envLoaded = false

/** 从 sts-server/.env 加载 RAM 配置（幂等） */
export function loadStsEnv() {
  if (envLoaded) return
  if (existsSync(stsEnvPath)) {
    dotenv.config({ path: stsEnvPath })
  } else {
    dotenv.config()
  }
  envLoaded = true
}

function readConfig() {
  loadStsEnv()
  return {
    accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim() ?? '',
    accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim() ?? '',
    roleArn: process.env.ALIBABA_CLOUD_ROLE_ARN?.trim() ?? '',
    sessionName: process.env.ALIBABA_CLOUD_ROLE_SESSION_NAME?.trim() || 'heroxin-pic',
    expireSeconds: Math.min(
      3600,
      Math.max(900, Number(process.env.ALIBABA_CLOUD_TOKEN_EXPIRE_SECONDS || 3600)),
    ),
    policyRaw: process.env.ALIBABA_CLOUD_POLICY?.trim() || '',
  }
}

function requireConfig(config) {
  const missing = []
  if (!config.accessKeyId) missing.push('ALIBABA_CLOUD_ACCESS_KEY_ID')
  if (!config.accessKeySecret) missing.push('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
  if (!config.roleArn) missing.push('ALIBABA_CLOUD_ROLE_ARN')
  if (missing.length) {
    throw new Error(
      `缺少环境变量：${missing.join(', ')}。请复制 sts-server/.env.example 为 sts-server/.env 并填写。`,
    )
  }
}

function parsePolicy(policyRaw) {
  if (!policyRaw) return null
  try {
    return JSON.parse(policyRaw)
  } catch {
    throw new Error('ALIBABA_CLOUD_POLICY 不是合法 JSON')
  }
}

/** 调用 AssumeRole，返回前端所需凭证字段 */
export async function assumeRoleCredentials() {
  const config = readConfig()
  requireConfig(config)
  const policy = parsePolicy(config.policyRaw)

  const sts = new OSS.STS({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
  })

  const result = await sts.assumeRole(
    config.roleArn,
    policy,
    config.expireSeconds,
    config.sessionName,
  )
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

export function getStsEnvPath() {
  return stsEnvPath
}
