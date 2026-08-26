# heroxin-pic STS 签发服务

用 RAM 用户长期 Key 调用 `AssumeRole`，向前端返回临时凭证（含 `SecurityToken`）。

**请勿**把本目录 `.env` 里的长期 Key 写进前端 `VITE_*` 变量。

## 快速开始

1. 按 [docs/sts-setup.md](../docs/sts-setup.md) 在阿里云控制台创建 RAM 角色与签发用户
2. 配置环境变量并启动：

```bash
cp .env.example .env
# 填写 ALIBABA_CLOUD_ACCESS_KEY_ID / SECRET / ROLE_ARN
pnpm install
pnpm start
```

3. 前端 `.env.local`：

```env
VITE_STS_URL=/api/sts
```

4. 项目根目录 `pnpm dev`（Vite 已代理 `/api/sts` → 本服务）

接口：`GET /sts`、`GET /health`
