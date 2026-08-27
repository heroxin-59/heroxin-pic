# 环境变量 · 权限 · FAQ（阶段 7.9）

## 环境变量

完整变量说明见仓库根目录 [`.env`](../.env)。涉密项写在 `.env.local`（勿提交）。

| 变量 | 必填 | 含义 |
| --- | --- | --- |
| `VITE_BASE` | 否 | 部署子路径，如 `/pic/`；根路径 `/`；见 [`deploy.md`](./deploy.md) |
| `VITE_OSS_REGION` | 是 | 地域，如 `oss-cn-beijing` |
| `VITE_OSS_BUCKET` | 是 | Bucket 名 |
| `VITE_OSS_ENDPOINT` | 否 | 自定义域名 / Endpoint |
| `VITE_OSS_DIR` | 建议 | 对象前缀，默认 `uploads/` |
| `VITE_STS_URL` | 生产推荐 | STS 临时凭证接口；本地可用 `/api/sts`（见 [`sts-setup.md`](./sts-setup.md)） |
| `VITE_OSS_ACCESS_KEY_ID` 等 | 仅本地 | 长期 Key 或手工临时凭证；**禁止生产 / 禁止提交** |
| `VITE_MAX_SIZE_MB` | 否 | 单文件上限 MB，默认 50 |
| `VITE_MAX_TOTAL_SIZE_MB` | 否 | 单批上限 MB，默认 200 |
| `VITE_ALLOWED_EXT` | 否 | 允许扩展名，逗号分隔 |
| `VITE_DUPLICATE_STRATEGY` | 否 | `uuid` / `timestamp` / `overwrite` / `suffix` |
| `VITE_OSS_THUMB_PROCESS` | 否 | 相册缩略图图片处理参数 |
| `VITE_ALBUM_THUMB_CONCURRENCY` | 否 | 缩略图并发，默认 4 |

修改后需**重启** `pnpm dev`。

## CORS

浏览器直传 / 签名访问必须配置 Bucket CORS。步骤与 XML 示例见 [`oss-setup.md`](./oss-setup.md)。

要点：

- Origin 精确匹配（含协议与端口）
- Methods 含 `GET` / `PUT` / `POST` / `HEAD`（删除需 `DELETE`）
- 暴露 Headers 含 `ETag`（分片上传）

## 权限（私有读推荐）

| 能力 | 所需权限（示意） |
| --- | --- |
| 上传 | `oss:PutObject`（及分片相关） |
| 列表 | `oss:ListObjects` |
| 预览 / 下载 | `oss:GetObject` |
| 删除 | `oss:DeleteObject` |

生产用 **STS** 下发短时凭证；配置步骤见 [`sts-setup.md`](./sts-setup.md)。勿把长期 Key 打进前端产物。

## 常见问题

**Q: 控制台大量 `Please use STS Token for safety`？**  
A: 未带 `stsToken` 时 ali-oss 会提示。配置 `VITE_STS_URL` 走临时凭证即可消除；详见 [`sts-setup.md`](./sts-setup.md)。

**Q: 上传报 XHR -1 / connected: false？**  
A: 多为 CORS 未配或 Origin 不匹配，见上文 CORS。

**Q: 点击下载跳到 AccessDenied / Referer？**  
A: 站内下载已走 SDK Blob（`downloadOssFile`），勿再依赖跨域 `<a href=签名URL>`。复制出的签名链接若被防盗链拦截，需在控制台调整 Referer 白名单或空 Referer 策略。

**Q: 预览空白 / PDF 中文乱码？**  
A: PDF 依赖 `public/pdfjs` 资源；确认构建时拷贝了 cmaps。Word 仅支持 `.docx`。

**Q: 图片页和文件列表有什么区别？**  
A: 文件列表展示全部类型，并保留「显示全部文件」层级浏览。图片页（顶栏「图片」）只展示图片相册（原「仅图片」能力），进入时扁平加载前缀下全部图片。

**Q: 访问未知路径？**  
A: 会进入 404 页（`NotFoundView`）；渲染异常由 `AppErrorBoundary` 承接。

**Q: 子路径部署后白屏 / 路由 404？**  
A: 构建时设置 `VITE_BASE=/your-path/`，并配置 SPA fallback；详见 [`deploy.md`](./deploy.md)。
