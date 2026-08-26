# heroxin-pic STS 签发服务

用 RAM 用户长期 Key 调用 `AssumeRole`，向前端返回临时凭证（含 `SecurityToken`）。

**请勿**把本目录 `.env` 里的长期 Key 写进前端 `VITE_*` 变量。

## 本地开发（推荐）

STS 已**内嵌**在项目根目录的 `pnpm dev` 中，一般**不需要**单独启动本服务：

1. 按 [docs/sts-setup.md](../docs/sts-setup.md) 在阿里云控制台创建 RAM 角色与签发用户
2. 配置本目录环境变量：

```bash
cp .env.example .env
# 填写 ALIBABA_CLOUD_ACCESS_KEY_ID / SECRET / ROLE_ARN
```

3. 项目根目录：

```bash
pnpm dev
```

前端 `.env.local` 保持 `VITE_STS_URL=/api/sts` 即可。

## 独立进程（生产 / 调试）

```bash
pnpm install
pnpm start
```

接口：`GET /sts`、`GET /health`

或在项目根目录：`pnpm sts:start`
