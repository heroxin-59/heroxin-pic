# 部署与生产配置（阶段 8）

> 对应 README **8.2–8.4 / 8.6**。本应用为纯静态 SPA；业务文件仍在阿里云 OSS，STS 需单独可达的 HTTPS 接口。

---

## 1. 生产构建

```bash
pnpm install
pnpm build
```

产物在 `dist/`。本地预览：

```bash
pnpm preview
```

### 子路径部署（`base`）

若站点不在域名根路径（如 `https://example.com/pic/`），构建前设置：

```bash
# Windows PowerShell
$env:VITE_BASE="/pic/"
pnpm build

# bash
VITE_BASE=/pic/ pnpm build
```

也可写入 `.env.production`（勿提交密钥；仅放公开配置）：

```env
VITE_BASE=/pic/
```

要求：

- 以 `/` 开头、以 `/` 结尾（根路径用 `/`）
- 静态服务器对前端路由做 **SPA fallback**（任意路径回退到 `index.html`）
- STS 生产地址用绝对 HTTPS（如 `https://sts.example.com/sts`），勿依赖开发用的 Vite 代理 `/api/sts`

路由已使用 `createWebHistory(import.meta.env.BASE_URL)`，与 Vite `base` 一致。

---

## 2. HTTPS（必做）

生产环境必须使用 **HTTPS**：

- 相机 / 部分浏览器能力依赖安全上下文
- 避免混合内容（HTTPS 页请求 HTTP STS / OSS）
- Cookie / 权限策略更严格

本地 `http://localhost` 开发除外。

---

## 3. 静态托管备忘

任选其一。共同注意：

1. 上传 `dist/` 全部文件  
2. SPA 回退到 `index.html`  
3. 配置 CORS：浏览器 Origin 必须与 Bucket CORS 白名单一致  
4. 前端环境变量在**构建时**打入产物，改配置需重新 `pnpm build`  
5. STS 接口须公网可达且 HTTPS；勿把长期 AK 打进前端  

### 3.1 阿里云 OSS 静态网站

1. Bucket → 基础设置 → 静态页面：默认首页 `index.html`，错误页也可填 `index.html`（便于 SPA）  
2. 绑定自定义域名 + HTTPS 证书（推荐 CDN）  
3. 对象读权限：静态站点资源可公共读；**业务文件 Bucket 仍建议私有 + 签名**（可分两个 Bucket，或仅开放 `dist` 前缀）  
4. 注意：OSS 静态站对「任意路径 → index.html」支持有限，复杂路由更推荐 CDN 或 Nginx  

### 3.2 Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name pic.example.com;

  # ssl_certificate     ...;
  # ssl_certificate_key ...;

  root /var/www/heroxin-pic;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  # 若子路径：root 仍指向 dist，location /pic/ { alias ...; try_files ... /pic/index.html; }
}
```

### 3.3 Vercel

1. 框架预设：Vite / Other  
2. Build：`pnpm build`；Output：`dist`  
3. 子路径：设置 `VITE_BASE` 环境变量后构建  
4. SPA：`vercel.json` 示例：

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 3.4 Cloudflare Pages

1. Build command：`pnpm build`；Output：`dist`  
2. 环境变量中配置全部 `VITE_*`（含 `VITE_STS_URL`）  
3. SPA：`public/_redirects` 或 Pages 控制台配置 `/* /index.html 200`  

---

## 4. STS 生产形态

推荐：

- 继续使用仓库 [`sts-server`](../sts-server/)，部署到任意 Node 主机 / 容器，仅内网或加鉴权  
- 或换成云函数 / 自有后端，接口形态见 [`sts-setup.md`](./sts-setup.md)

前端 `.env.production` 示例：

```env
VITE_OSS_REGION=oss-cn-beijing
VITE_OSS_BUCKET=your-bucket
VITE_OSS_DIR=file/
VITE_STS_URL=https://sts.example.com/sts
```

---

## 5. 性能抽查建议（8.6）

| 项 | 建议 |
| -- | ---- |
| 首屏 | `pnpm build` 后看体积；PDF/Word 已异步分包，勿同步引入 |
| 预览首开 | 首次打开 PDF/Word 会下载对应 chunk，属预期 |
| 相册 | 缩略图并发由 `VITE_ALBUM_THUMB_CONCURRENCY` 控制；大图量依赖虚拟滚动 |
| 移动端内存 | 避免同时打开超多原图预览；PDF 按页渲染已 cleanup |
| 缓存 | 静态资源带 hash，可长期缓存；`index.html` 宜协商缓存或不缓存 |

人工验收清单见 [`acceptance.md`](./acceptance.md)。
