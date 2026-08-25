/** STS 接口返回的原始字段（兼容 PascalCase / camelCase） */
export interface StsApiResponse {
  AccessKeyId?: string
  AccessKeySecret?: string
  SecurityToken?: string
  Expiration?: string
  accessKeyId?: string
  accessKeySecret?: string
  securityToken?: string
  stsToken?: string
  expiration?: string
  /** 部分网关会包一层 Credentials */
  Credentials?: StsApiResponse
  credentials?: StsApiResponse
  data?: StsApiResponse
}

/** 内存中规范化后的临时凭证 */
export interface StsCredentialSet {
  accessKeyId: string
  accessKeySecret: string
  stsToken: string
  /** 过期时间戳（ms） */
  expiration: number
}
