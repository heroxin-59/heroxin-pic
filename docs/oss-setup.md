# 阿里云 OSS 接入准备清单

> 对应 README **阶段 2.1**。在写上传代码前，请按本清单在阿里云控制台完成配置。  
> 本项目为**纯前端直传**，生产环境务必使用 **STS 临时凭证**，勿把长期 AccessKey 写进前端仓库。

---

## 1. 创建 OSS Bucket

| 项              | 建议值                                                   | 说明                                |
| --------------- | -------------------------------------------------------- | ----------------------------------- |
| 地域            | 与业务用户就近（如 `华东1（杭州）` → `oss-cn-hangzhou`） | 与 `.env` 中 `VITE_OSS_REGION` 一致 |
| 存储类型        | 标准存储                                                 | 上传 / 预览频繁读写                 |
| 读写权限        | **私有**（推荐）                                         | 预览 / 下载走签名 URL；勿用公共读写 |
| 版本控制 / 冗余 | 按需                                                     | 个人小项目可先关闭                  |
| Bucket 名称     | 全局唯一                                                 | 填入 `VITE_OSS_BUCKET`              |

**操作路径（控制台）：**  
对象存储 OSS → Bucket 列表 → 创建 Bucket。

**与前端变量对应：**

```env
VITE_OSS_REGION=oss-cn-hangzhou
VITE_OSS_BUCKET=your-bucket-name
VITE_OSS_DIR=uploads/
```

---

## 2. 配置跨域 CORS（必做）

浏览器直传会跨域访问 OSS，未配 CORS 会出现预检失败 / 上传失败。

**操作路径：** Bucket → 数据安全 → 跨域设置（CORS）→ 创建规则。

### 推荐规则（开发 + 生产可拆成多条）

| 字段             | 建议                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| 来源 Origin      | 开发：`http://localhost:5173`、`http://127.0.0.1:5173`；生产：你的站点域名（如 `https://pic.example.com`） |
| 允许 Methods     | `GET`、`PUT`、`POST`、`HEAD`、`DELETE`（若启用删除）                                                       |
| 允许 Headers     | `*` 或至少包含：`Authorization`、`Content-Type`、`x-oss-*`、`Content-MD5`                                  |
| 暴露 Headers     | `ETag`、`x-oss-request-id`（按需）                                                                         |
| 缓存时间 Max-Age | `600`（秒）即可                                                                                            |

> 不要用 `*` Origin 长期挂在生产环境；按实际域名精确配置更安全。

### 典型报错（你现在很可能遇到）

浏览器提示类似：

```text
XHR error ... PUT https://xxx.oss-cn-beijing.aliyuncs.com/... -1 (connected: false ...)
```

含义：PUT 请求在到达 OSS 业务响应前就被浏览器拦下（多数是 **CORS 未配置 / Origin 不匹配 / Methods 未含 PUT**）。

请确认：

1. 规则开在 **正在上传的那个 Bucket**（例如 `hcraxin`）上，不是别的 Bucket
2. Origin **精确匹配** 地址栏（含协议和端口）：`http://localhost:5173` 与 `http://127.0.0.1:5173` 是两条不同来源，常用的都加上
3. Methods 必须包含 **PUT**（分片上传会用 PUT）
4. Allow-Headers 开发期可先填 `*`
5. 保存后 **强制刷新页面**（Ctrl+F5）再传；改 CORS 后旧预检缓存可能仍在

控制台 XML 示例（可参考）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>http://localhost:5173</AllowedOrigin>
    <AllowedOrigin>http://127.0.0.1:5173</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-oss-request-id</ExposeHeader>
    <MaxAgeSeconds>600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

若 CORS 已正确仍失败，再查：本机网络 / 代理 / 公司防火墙是否拦截 `*.aliyuncs.com`；RAM 策略 Resource 前缀是否与 `VITE_OSS_DIR`（如 `temp_file/`）一致。

---

## 3. RAM 用户 / 角色与最小权限

### 3.1 推荐生产链路（STS）

完整控制台步骤 + 本仓库 `sts-server` 用法见 **[`sts-setup.md`](./sts-setup.md)**。

```text
前端 → 调用你的 STS 接口（或本仓库 sts-server / 云函数）
     → 返回临时 AccessKeyId / AccessKeySecret / SecurityToken / Expiration
     → 浏览器 ali-oss 使用临时凭证直传 OSS
```

需要：

1. **RAM 角色**（如 `heroxin-pic-oss`），信任本账号，并绑定 OSS 最小权限
2. **RAM 用户**（仅 `sts:AssumeRole`）的 AccessKey，**只放在 sts-server/.env**
3. 前端配置 `VITE_STS_URL`（本地可用 `/api/sts` 代理）

### 3.2 最小权限策略示例（按前缀收紧）

将 `YOUR_BUCKET`、`uploads/` 换成实际值：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:PutObject", "oss:GetObject", "oss:DeleteObject", "oss:ListObjects"],
      "Resource": ["acs:oss:*:*:YOUR_BUCKET/uploads/*", "acs:oss:*:*:YOUR_BUCKET"]
    }
  ]
}
```

说明：

- `PutObject`：上传
- `GetObject`：读文件 / 签名下载
- `ListObjects`：列举（若列表走会话缓存可不授）
- `DeleteObject`：删除（若不需要可去掉，对应决策 **D5**）

### 3.3 本地调试临时方案（仅开发）

若暂时没有 STS 接口：

1. 创建**受限 RAM 子用户**，只绑上述最小策略
2. 创建 AccessKey，**仅**写入本机 `.env.local`（已 gitignore）
3. 代码与文档中必须标明：**禁止提交、禁止上线**；上线前必须改为 STS

> 长期 Key 一旦进前端包或仓库，等同公开，务必轮换密钥。

---

## 4. STS 接口约定（前端对接形态）

前端通过 `VITE_STS_URL` 请求临时凭证。本仓库提供开箱即用的签发服务：[`../sts-server`](../sts-server/)（详见 [`sts-setup.md`](./sts-setup.md)）。

建议响应 JSON：

```json
{
  "AccessKeyId": "STS.xxxxx",
  "AccessKeySecret": "xxxxx",
  "SecurityToken": "xxxxx",
  "Expiration": "2026-08-25T12:00:00Z"
}
```

| 字段                              | 用途                       |
| --------------------------------- | -------------------------- |
| `AccessKeyId` / `AccessKeySecret` | 临时密钥                   |
| `SecurityToken`                   | STS Token，`ali-oss` 必填  |
| `Expiration`                      | ISO 时间；前端在过期前刷新 |

可选扩展字段：`region`、`bucket`、`dir`（若后端希望覆盖前端 env）。

**前端行为（阶段 2.4 实现）：**

1. 首次上传前拉取 STS
2. 缓存至内存；临近过期（如提前 60s）自动刷新
3. 上传遇 `InvalidAccessKeyId` / `SecurityTokenExpired` 时刷新后重试一次

**谁提供 STS（决策 D1）：**

- [x] 本仓库 `sts-server` 或已有后端 / 云函数接口 → 填 `VITE_STS_URL`
- [ ] 暂无 → 本地用 `.env.local` 临时 Token（仅开发），并行准备 STS

---

## 5. Bucket 读权限策略（决策 D2）

| 方案                        | 适用                | 前端行为                                    |
| --------------------------- | ------------------- | ------------------------------------------- |
| **私有 + 签名 URL（推荐）** | 生产                | `signatureUrl` / `get` 带过期时间预览、下载 |
| 公共读                      | 仅演示 / 无敏感文件 | 可直接拼公网 URL（仍建议限 CORS）           |

本项目默认按 **私有 + 签名 URL** 设计。

---

## 6. 联调前自检清单

- [ ] Bucket 已创建，地域与 `VITE_OSS_REGION` 一致
- [ ] CORS 已包含本地 Origin（`5173`）及生产域名
- [ ] RAM 策略仅覆盖目标 Bucket / 前缀
- [ ] `.env.local` 已从 `.env.example` 复制并填写（密钥不入库）
- [ ] 明确 STS：有接口地址，或接受「仅本地调试密钥」
- [ ] 控制台能手动上传一个测试对象到 `uploads/`，确认权限无误

---

## 7. 常见问题

| 现象                                | 可能原因                                                |
| ----------------------------------- | ------------------------------------------------------- |
| 浏览器报 CORS / blocked by CORS     | CORS Origin / Methods / Headers 未配全                  |
| 提示 set the etag of expose-headers | CORS「暴露 Headers」未包含 `ETag`（分片上传必填）       |
| `AccessDenied`                      | RAM 策略 Resource 前缀不对，或未授 `PutObject`          |
| `InvalidAccessKeyId`                | Key 错误、已禁用，或 STS Token 过期                     |
| 上传成功但预览 403                  | Bucket 私有且未用签名 URL                               |
| 列举为空                            | `ListObjects` 未授权，或 `prefix`/`VITE_OSS_DIR` 不一致 |

---

## 8. 本地联调直传（阶段 2.6）

1. 复制环境变量并填写：

```bash
cp .env.example .env.local
```

至少配置：

- `VITE_OSS_REGION`
- `VITE_OSS_BUCKET`
- `VITE_OSS_DIR`（默认 `uploads/`）
- **二选一**：`VITE_STS_URL`（推荐，见 [`sts-setup.md`](./sts-setup.md)），或开发环境本地临时凭证（`VITE_OSS_ACCESS_KEY_ID` / `SECRET` / `VITE_OSS_STS_TOKEN`）

2. 确认 Bucket CORS 已允许 `http://localhost:5173`

3. 启动并打开上传页：

```bash
pnpm dev
```

4. 页面操作顺序建议：
   - 检查配置
   - 获取凭证
   - 选择文件直传
   - 在阿里云控制台对象列表确认 Key（形如 `uploads/yyyy/MM/dd/{uuid}-{文件名}`）
   - 可用页面上的签名 URL 在浏览器打开验证私有读

5. 若失败，对照下方「常见问题」与页面 `ElMessage` 提示（CORS / 权限 / 凭证等）。

---

## 9. 本阶段完成后

回到 README **阶段 3**：完善上传 UI、队列、校验与移动端体验。
