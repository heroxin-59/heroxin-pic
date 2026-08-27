# 使用 STS Token 接入（阿里云控制台 + 本项目）

官方说明：[使用 STS 临时访问凭证访问 OSS](https://help.aliyun.com/document_detail/32077.html)

> **重要**：官方示例里的 `ALIBABA_CLOUD_ACCESS_KEY_*` / `SECURITY_TOKEN` 是给 **服务端** 用的。  
> 浏览器端不能拿长期 AccessKey 去调 `AssumeRole`，否则密钥会暴露在前端包里。  
> 本项目约定：**服务端签发临时凭证 → 前端只拿短时 Token 初始化 ali-oss**。

```text
浏览器 (heroxin-pic)
    │  GET VITE_STS_URL
    ▼
STS 签发服务 (sts-server 或云函数)
    │  AssumeRole（用 RAM 用户长期 Key，只存在服务端）
    ▼
返回临时 AccessKeyId + AccessKeySecret + SecurityToken + Expiration
    │
    ▼
浏览器 ali-oss({ accessKeyId, accessKeySecret, stsToken }) 直传 OSS
```

---

## 一、阿里云控制台怎么配

### 1. 确认 OSS Bucket

- 路径：对象存储 OSS → Bucket 列表
- 记下：**地域**（如 `oss-cn-beijing`）、**Bucket 名**、上传前缀（如 `uploads/`）
- 读写权限建议：**私有**
- CORS：按 [`oss-setup.md`](./oss-setup.md) 配置本地 `http://localhost:5173` 与生产域名

### 2. 创建「可被扮演」的 RAM 角色（临时身份）

1. 打开 [RAM 控制台](https://ram.console.aliyun.com/) → **身份管理** → **角色** → **创建角色**
2. 信任主体类型选：**阿里云账号**（本账号）
3. 角色名称建议：`heroxin-pic-oss`
4. 创建后进入角色 → **权限管理** → **新增授权** → **自定义策略**（或先贴内联策略）

**角色权限策略示例**（把 `YOUR_BUCKET`、`uploads/` 换成你的值）：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject",
        "oss:ListObjects",
        "oss:AbortMultipartUpload",
        "oss:ListMultipartUploadParts",
        "oss:ListParts"
      ],
      "Resource": [
        "acs:oss:*:*:YOUR_BUCKET",
        "acs:oss:*:*:YOUR_BUCKET/uploads/*"
      ]
    }
  ]
}
```

5. 在角色详情页复制 **ARN**，形如：

```text
acs:ram::1234567890123456:role/heroxin-pic-oss
```

填入根目录 `.env.local` 的 `ALIBABA_CLOUD_ROLE_ARN`（说明见 `.env`）。

### 3. 创建「签发用」的 RAM 用户（长期 Key，仅服务端）

1. RAM → **身份管理** → **用户** → **创建用户**
2. 勾选 **OpenAPI 调用访问**（会生成 AccessKey）
3. 用户名建议：`heroxin-pic-sts-issuer`
4. 为该用户授权 **仅** `sts:AssumeRole`（自定义策略）：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "acs:ram::1234567890123456:role/heroxin-pic-oss"
    }
  ]
}
```

把上面 `Resource` 换成你刚创建的角色 ARN。

5. 用户 → **认证管理** → 创建 AccessKey  
   → 填入根目录 `.env.local`：

```env
ALIBABA_CLOUD_ACCESS_KEY_ID=你的用户AK
ALIBABA_CLOUD_ACCESS_KEY_SECRET=你的用户SK
ALIBABA_CLOUD_ROLE_ARN=acs:ram::账号ID:role/heroxin-pic-oss
```

> 这对 Key **绝对不能**写进前端 `.env.local` 的 `VITE_*` 变量，也不能提交 Git。

### 4.（可选）收紧角色信任策略

角色 → **信任策略管理**：确认允许你的阿里云账号下的实体扮演该角色。默认「本账号」一般可直接用；若 AssumeRole 报没有权限，检查信任策略与用户策略里的 ARN 是否一致。

---

## 二、本地 STS（开发内嵌，推荐）

**只需一个命令**：在项目根目录 `.env.local` 填写 `ALIBABA_CLOUD_*` 后执行 `pnpm dev`（变量说明见 `.env`）。  
Vite 开发服务器已内嵌 `GET /api/sts`，**无需**再单独启动 `sts-server`。

```bash
# 项目根目录：编辑 .env.local 填入 AK/SK/RoleArn

pnpm install
pnpm dev
```

浏览器访问开发地址后，前端通过 `VITE_STS_URL=/api/sts` 获取临时凭证。

### 独立 STS 进程（可选）

生产部署、或调试 STS 服务本身时使用：

```bash
cd sts-server
pnpm install
pnpm start
```

成功后访问：`http://127.0.0.1:7001/sts`，应返回：

```json
{
  "AccessKeyId": "STS.xxxxx",
  "AccessKeySecret": "xxxxx",
  "SecurityToken": "xxxxx",
  "Expiration": "2026-08-26T04:00:00Z"
}
```

生产可将同一逻辑部署到 **函数计算 FC / 任意 Node 服务 / 现有后端**，对外暴露 HTTPS 的 `/sts` 即可。

---

## 三、前端怎么改配置

编辑项目根目录 `.env.local`：

```env
VITE_OSS_REGION=oss-cn-beijing
VITE_OSS_BUCKET=your-bucket
VITE_OSS_DIR=uploads/

# 推荐：走 STS 接口（开发内嵌在 pnpm dev，路径 /api/sts）
VITE_STS_URL=/api/sts
# 若使用独立 sts-server 且不走内嵌：
# VITE_STS_URL=http://127.0.0.1:7001/sts

# 有 VITE_STS_URL 时，请注释掉下面长期 Key，避免误用
# VITE_OSS_ACCESS_KEY_ID=
# VITE_OSS_ACCESS_KEY_SECRET=
# VITE_OSS_STS_TOKEN=
```

开发时 `pnpm dev` 已在同域提供 `/api/sts`，无需跨域、也无需单独起 `sts-server`。

然后：

1. 终端 1：`cd sts-server && pnpm start`
2. 终端 2：项目根目录 `pnpm dev`
3. 打开首页 → 检查配置 / 获取凭证，应显示来源为 **STS 接口**

前端初始化等价于官方示例：

```js
new OSS({
  accessKeyId,      // 临时
  accessKeySecret,  // 临时
  stsToken,         // SecurityToken
  region,
  bucket,
})
```

凭证会在过期前约 60 秒自动刷新；过期错误会强制刷新后重试一次。

---

## 四、临时手工调试（不推荐长期用）

若你在控制台 / CLI 已拿到一组 **临时** 凭证，可短期写入 `.env.local`（仅 DEV）：

```env
VITE_OSS_ACCESS_KEY_ID=STS.xxxxx
VITE_OSS_ACCESS_KEY_SECRET=xxxxx
VITE_OSS_STS_TOKEN=xxxxx
# 此时不要填 VITE_STS_URL，或留空
```

这对应官方「环境变量里带 SecurityToken」的写法，但 Token 通常几十分钟就过期，过期后需重新粘贴。日常请用 `sts-server` + `VITE_STS_URL`。

---

## 五、自检清单

- [ ] RAM 角色已绑 OSS 最小权限，ARN 正确
- [ ] RAM 用户仅有 `sts:AssumeRole`，AccessKey 只在根目录 `.env.local`
- [ ] `GET /sts` 能返回四字段 JSON
- [ ] 前端 `VITE_STS_URL` 已配置并重启 `pnpm dev`
- [ ] Bucket CORS 已允许当前 Origin
- [ ] 上传 / 列表 / 预览正常，控制台不再刷 STS 警告

---

## 六、常见报错

| 现象 | 处理 |
| --- | --- |
| `NoPermission` / `User not authorized to assume role` | 用户策略 Resource 角色 ARN 写错，或角色信任策略不允许 |
| `AccessDenied` 上传 OSS | 角色上的 OSS 策略 Resource 前缀与 `VITE_OSS_DIR` 不一致 |
| 前端 STS HTTP 500 | 看 `sts-server` 终端日志；多为 AK/SK/RoleArn 未配 |
| CORS 拦 STS 请求 | 开发用 `VITE_STS_URL=/api/sts`；或在 `sts-server` 配 `CORS_ORIGINS` |
| 仍提示 Please use STS Token | 确认返回里有 `SecurityToken`，且前端走的是 `VITE_STS_URL` |

更多 CORS / Bucket 问题见 [`oss-setup.md`](./oss-setup.md)、[`faq.md`](./faq.md)。
