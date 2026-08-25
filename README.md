# heroxin-pic

纯前端文件上传与预览应用：基于 **Vue 3 + Element Plus + TypeScript + pnpm**，对接 **阿里云 OSS**，支持图片 / Word / PDF 等基础文件的上传与预览，并兼容电脑端与手机端。

> 本文档为开发任务清单与项目记忆文档。后续开发请优先阅读本文件，按阶段推进；完成一项可将对应项标记为 `[x]`。

---

## 一、项目目标与边界

### 1.1 目标

- 用户可选择本地文件并上传至阿里云 OSS
- 上传后可在线预览：图片、Word（`.doc` / `.docx`）、PDF，以及其他基础文件的下载/信息展示
- **上传与下载保持源文件**（不对图片等进行压缩、转码或重编码）
- 同一套 UI 适配桌面端与移动端（响应式）
- 纯前端部署，无自建后端业务服务（OSS / STS 由阿里云侧提供）

### 1.2 非目标（当前阶段不做）

- 用户登录 / 权限体系（可后续扩展）
- 自建文件管理后端、数据库
- 在线协同编辑 Word / PDF
- 视频转码、音视频流媒体播放（如需可单列二期）
- **图片 / 文件压缩、转码、重编码**（保持源文件直传 OSS 与原始下载）

### 1.3 技术选型（已定）

| 类别    | 选型                                        | 说明                       |
| ------- | ------------------------------------------- | -------------------------- |
| 框架    | Vue 3（Composition API + `<script setup>`） | 现代前端基座               |
| UI      | Element Plus                                | 组件库，需处理移动端适配   |
| 语言    | TypeScript                                  | 全量 TS                    |
| 包管理  | pnpm                                        | 锁定版本，统一安装命令     |
| 构建    | Vite                                        | 推荐默认脚手架             |
| OSS SDK | `ali-oss`                                   | 浏览器直传                 |
| 路由    | Vue Router                                  | 上传页 / 预览页 / 列表页等 |
| 状态    | Pinia（按需）                               | 上传队列、配置、文件列表   |

---

## 二、整体架构说明（备忘）

```
浏览器 (Vue3 SPA)
  ├─ 上传模块 ──► 获取临时凭证(STS) ──► ali-oss 直传 OSS
  ├─ 文件列表 ──► 列举 / 刷新 OSS 对象（或本地会话缓存）
  └─ 预览模块 ──► 按 MIME / 扩展名分流
        ├─ 图片：原生 / Element Plus Image 预览
        ├─ PDF：pdf.js 或 iframe + OSS 签名 URL
        ├─ Word：docx-preview（仅 .docx）
        └─ 其他：文本只读预览 / 文件信息 + 下载
```

**安全要点（必做）：**

- 前端 **禁止** 硬编码长期 AccessKeyId / AccessKeySecret
- 优先使用 **STS 临时凭证**（RAM 角色 + 短时 Token）
- 上传使用 **签名 URL** 或 **STS + ali-oss**；Bucket 权限尽量私有 + 签名访问
- 敏感配置仅放 `.env.local` / 部署环境变量，并写入 `.gitignore`

> 若暂无 STS 服务端，开发阶段可本地用受限子账号 + 环境变量联调，但 README 与代码中必须标明「仅本地调试，上线前必须换 STS」。

---

## 三、详细任务清单

### 阶段 0：仓库与规范准备

- [x] **0.1** 确认仓库为空项目起点，保留本 README 作为主文档
- [x] **0.2** 初始化 Git 忽略规则：`node_modules`、`dist`、`.env*.local`、IDE 缓存、pnpm store 相关等
- [x] **0.3** 约定目录结构、命名规范（组件 PascalCase、composables 以 `use` 开头、工具函数 camelCase）
- [x] **0.4** 约定提交信息风格（可选：Conventional Commits）
- [x] **0.5** 编写「如何启动 / 如何配置 OSS」的快速开始说明 → 见 **§十**

#### 代码规范（0.3）

| 类型            | 规范                   | 示例                                |
| --------------- | ---------------------- | ----------------------------------- |
| Vue 组件文件    | PascalCase             | `FileList.vue`、`UploadPanel.vue`   |
| composables     | `use` 前缀 + camelCase | `useOss.ts`、`useUploader.ts`       |
| 工具函数 / 变量 | camelCase              | `formatFileSize.ts`、`getSignedUrl` |
| 类型 / 接口     | PascalCase             | `FileItem`、`OssConfig`             |
| 常量            | UPPER_SNAKE_CASE       | `MAX_FILE_SIZE_MB`                  |
| 路由 path       | kebab-case             | `/file-list`、`/preview`            |

#### 提交信息（0.4）

采用 **Conventional Commits** 简要格式：`type(scope): subject`

- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `chore`: 构建 / 工具
- `refactor`: 重构（不改变行为）

示例：`feat(upload): add drag-and-drop upload panel`

---

### 阶段 1：工程脚手架

- [x] **1.1** 使用 Vite 官方模板创建 Vue3 + TS 项目（`pnpm create vite`）
- [x] **1.2** 安装并配置 Element Plus（**全量引入**；另注册 `@element-plus/icons-vue`）
- [x] **1.3** 安装 Vue Router、Pinia
- [x] **1.4** 配置路径别名 `@` → `src`
- [x] **1.5** 配置 ESLint + Prettier（或项目统一的 lint/format 方案）并与 Vue/TS 兼容
- [x] **1.6** 配置 `env` 类型声明（`ImportMetaEnv`），区分 `VITE_` 前缀变量
- [x] **1.7** 验证：`pnpm install` / `pnpm dev` / `pnpm build` 可正常跑通空壳页面
- [x] **1.8** 基础布局骨架：顶栏 + 主内容区 + **移动端底部 Tab 导航**（桌面端顶栏横向导航）

---

### 阶段 2：阿里云 OSS 接入基础

- [x] **2.1** 梳理阿里云侧准备项清单（文档化）→ 详见 [`docs/oss-setup.md`](./docs/oss-setup.md)
  - [x] 创建 OSS Bucket（地域、存储类型、读写权限）
  - [x] 配置跨域 CORS（允许本地与线上 Origin、Methods：GET/PUT/POST/HEAD、必要 Headers）
  - [x] 创建 RAM 用户 / 角色，最小权限（上传、列举、读取指定前缀）
  - [x] （推荐）开通 STS，约定前端获取临时凭证的方式与接口形态
- [x] **2.2** 封装 `src/services/ossClient.ts`：创建客户端、上传、列举、删除、生成签名 URL
- [x] **2.3** 封装配置读取：`region`、`bucket`、`endpoint`、路径前缀 `dir`、STS 相关地址（`src/config/oss.ts`）
- [x] **2.4** 实现 STS 临时凭证获取与自动刷新（凭证过期重试）→ `src/services/sts.ts` + `src/services/oss.ts`
- [x] **2.5** 统一错误处理：网络失败、权限不足、CORS、文件超限等友好提示（`AppError` + `showAppError`）
- [x] **2.6** 本地联调：用测试文件验证直传成功，并在控制台可见对象（联调入口已就绪；需配置 `.env.local` 后自测）

---

### 阶段 3：文件上传功能

- [x] **3.1** 上传入口 UI：拖拽区 + 点击选择（自定义 `UploadPanel`）
- [x] **3.2** 支持多选文件上传（顺序队列 + `UploadQueueList`）
- [x] **3.3** 文件类型白名单（可配置）：扩展名 + MIME 校验，按分类展示（`fileTypes` + `filterAllowedFiles`）
- [x] **3.4** 单文件大小限制与总体积限制（`VITE_MAX_SIZE_MB` / `VITE_MAX_TOTAL_SIZE_MB`）
- [x] **3.5** 上传前校验：扩展名、MIME、空文件、重名策略（`uuid` / `overwrite` / `suffix`）
- [x] **3.6** 上传进度展示（总进度条 + 单文件进度 + 队列状态：等待/上传中/成功/失败）
- [x] **3.7** 支持取消上传 / 失败重试（`AbortSignal` + 队列重试）
- [x] **3.8** Object Key 命名规则（见 `src/utils/objectKey.ts` + `VITE_DUPLICATE_STRATEGY`）
- [x] **3.9** 上传成功后回写：文件名、大小、类型、OSS URL / Key、上传时间（`useFileStore` 会话列表）
- [x] **3.10** 移动端适配：大按钮、避免依赖 hover；相机拍照上传（`accept` + `capture` 按需）

> 阶段 3 上传功能已全部完成。不包含图片压缩（3.11 已取消，保持源文件上传/下载）。

---

### 阶段 4：文件列表与管理

- [x] **4.1** 文件列表页：名称、类型图标、大小、上传时间、操作列（预览 / 下载 / 复制）
- [x] **4.2** 数据来源策略：**A. OSS `list` 列举指定前缀**（已确认；刷新可读历史文件）
  - ~~B. 会话内本地维护列表~~（已弃用为列表主数据源；上传页「最近上传」仍可乐观展示）
- [x] **4.3** 搜索 / 按类型筛选（图片、PDF、Word、文本、其他）
- [x] **4.4** 排序：时间、名称、大小
- [x] **4.5** 操作：预览、下载（签名 URL）、复制链接、删除（确认弹窗 + OSS DeleteObject）
- [x] **4.6** 空状态、加载中、加载失败 UI
- [x] **4.7** 分页：默认每页 50，可选 20 / 50 / 100 / 200（OSS 全量列举 + 本地分页）
- [x] **4.8** 桌面端表格 / 移动端卡片列表双布局

---

### 阶段 5：文件预览

#### 5.1 图片预览

- [x] **5.1.1** 缩略图列表展示（同目录已加载图片 gallery）
- [x] **5.1.2** 点击大图预览（缩放、旋转、左右切换）——页内工具栏 + Element Plus `el-image-viewer` 全屏
- [x] **5.1.3** 私有 Bucket 使用签名 URL，注意 URL 过期刷新（加载失败自动刷新 / 手动刷新）
- [x] **5.1.4** 移动端手势：左右滑动切换（基础可用）；双指缩放依赖全屏 viewer

#### 5.2 PDF 预览

- [x] **5.2.1** 选型：**`pdfjs-dist`**（私有桶走 SDK 拉 Blob 后按页渲染；不用 iframe 直连签名 URL）
- [x] **5.2.2** 基础能力：翻页、缩放、页码跳转、加载进度
- [x] **5.2.3** 大文件与移动端内存问题：仅渲染当前页，切换页时重绘并 cleanup
- [x] **5.2.4** 预览失败降级：提供「下载后查看」

#### 5.3 Word 预览（仅 `.docx`）

- [x] **5.3.1** 明确范围：**仅支持 `.docx`**；`.doc` 老格式降级为提示 + 下载
- [x] **5.3.2** 选型定稿：`docx-preview`
- [x] **5.3.3** 实现预览页：基础排版 / 图片 / 表格展示
- [x] **5.3.4** 不支持或解析失败时：明确提示 + 下载按钮
- [ ] **5.3.5** （可选二期）对接「Office 在线预览 / 转 PDF 再预览」等云端方案

#### 5.4 其他文件

- [x] **5.4.1** 文本类（`.txt` / `.md` / `.json` / `.csv` 等）：只读预览（UTF-8；超 512KB 截断；JSON 自动格式化）
- [x] **5.4.2** 无法预览类型：展示文件信息卡片 + 下载（`PreviewFallback`）
- [x] **5.4.3** 统一预览路由：`/preview?key=...`，按类型动态加载预览器（图片 / PDF / Word / 文本已接入）

---

### 阶段 6：响应式与移动端体验

- [x] **6.1** 断点约定（与 Element Plus 对齐）：xs / sm / md / lg / xl → `src/constants/breakpoints.ts` + `useBreakpoint`
- [x] **6.2** 布局：顶栏小屏折叠（底栏 Tab）；上传区全宽；列表桌面表格 / 移动卡片
- [x] **6.3** 触摸友好：可点击区域 ≥ 44px；移动端按钮与操作区加大
- [x] **6.4** 安全区：`viewport-fit=cover` + `env(safe-area-inset-*)`（顶栏 / 底栏 / 主内容 / 弹层）
- [x] **6.5** 横竖屏基础可用；短屏横屏压缩底栏；弹层留白防裁切
- [x] **6.6** 真机或浏览器移动模式自测清单 → [`docs/mobile-qa.md`](./docs/mobile-qa.md)
- [x] **6.7** （可选）PWA 基础：`manifest.webmanifest` + Apple 添加到主屏幕 meta（无 Service Worker 离线包）

---

### 阶段 7：通用体验与工程质量

- [ ] **7.1** 全局 Loading / Message / MessageBox 规范
- [ ] **7.2** 主题与品牌色（保持简洁，避免过度装饰）
- [ ] **7.3** 国际化预留（可先中文硬编码，结构便于后续 i18n）
- [ ] **7.4** TypeScript 类型：FileItem、UploadStatus、OssConfig、PreviewType 等
- [ ] **7.5** 可复用 composables：`useOss`、`useUploader`、`useFilePreview`、`useBreakpoint`
- [ ] **7.6** 错误边界与路由 404 页
- [ ] **7.7** 基础单测 / 关键工具函数测试（可选但推荐）
- [ ] **7.8** 构建产物体积关注：PDF/Word 预览库按需异步加载（`defineAsyncComponent` / 动态 `import()`）
- [ ] **7.9** README 补充：环境变量说明、CORS 配置示例、权限说明、常见问题 FAQ

---

### 阶段 8：配置、部署与验收

- [ ] **8.1** 提供 `.env.example`（无密钥）：列出全部 `VITE_` 变量及含义
- [ ] **8.2** 生产构建优化与 `base` 路径配置（若部署到子路径）
- [ ] **8.3** 静态托管方案备忘：OSS 静态网站 / Nginx / Vercel / Cloudflare Pages 等任选并写步骤
- [ ] **8.4** HTTPS 要求：生产环境必须 HTTPS（涉及相机、部分浏览器策略、混合内容）
- [ ] **8.5** 验收清单（人工）：
  - [ ] 桌面 Chrome / Edge：上传图片、PDF、docx，均可预览
  - [ ] 手机 Safari / Chrome：同上
  - [ ] 超大文件拦截提示正确
  - [ ] 非法类型拦截提示正确
  - [ ] 私有读签名 URL 可打开且过期后可刷新
  - [ ] 删除（若启用）后列表更新
  - [ ] 断网 / CORS 错误有可读提示
- [ ] **8.6** 性能抽查：首屏、预览首开时间、移动端内存无明显炸裂

---

## 四、建议目录结构（脚手架完成后落地）

```text
heroxin-pic/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── upload/          # 上传区、进度队列
│   │   ├── file-list/       # 列表 / 卡片
│   │   └── preview/         # Image / Pdf / Docx / Fallback
│   ├── composables/
│   ├── layouts/
│   ├── router/
│   ├── stores/
│   ├── services/            # oss、sts
│   ├── types/
│   ├── utils/
│   ├── views/
│   ├── App.vue
│   ├── main.ts
│   └── env.d.ts
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
└── README.md                # 本文件
```

---

## 五、环境变量草案（实现时再定名）

| 变量名（草案）            | 含义                      | 备注                            |
| ------------------------- | ------------------------- | ------------------------------- |
| `VITE_OSS_REGION`         | OSS 地域                  | 如 `oss-cn-hangzhou`            |
| `VITE_OSS_BUCKET`         | Bucket 名                 |                                 |
| `VITE_OSS_ENDPOINT`       | Endpoint（可选）          | 自定义域名时使用                |
| `VITE_OSS_DIR`            | 上传目录前缀              | 如 `uploads/`                   |
| `VITE_STS_URL`            | 获取 STS 的接口           | 推荐生产使用                    |
| `VITE_MAX_SIZE_MB`        | 单文件上限（MB）          | 默认 50                         |
| `VITE_MAX_TOTAL_SIZE_MB`  | 本批/队列总体积上限（MB） | 默认 200                        |
| `VITE_ALLOWED_EXT`        | 允许扩展名列表            | 逗号分隔                        |
| `VITE_DUPLICATE_STRATEGY` | 重名策略                  | `uuid` / `overwrite` / `suffix` |

---

## 六、关键依赖候选（选型时确认）

| 用途       | 候选包                       | 状态                       |
| ---------- | ---------------------------- | -------------------------- |
| OSS        | `ali-oss`                    | 已接入（`OssClient`）      |
| PDF        | `pdfjs-dist`                 | 已接入（按页 Canvas 渲染） |
| Word(docx) | `docx-preview`               | 已接入（仅 .docx）         |
| 工具       | `dayjs`、`file-type`（可选） | 按需                       |
| 图标       | `@element-plus/icons-vue`    | 推荐                       |

---

## 七、风险与决策待办（开发前尽量拍板）

- [ ] **D1** STS 由谁提供？是否已有可调用的临时凭证接口？若无，本地调试策略是什么？
- [ ] **D2** Bucket 公共读还是私有读 + 签名 URL？
- [x] **D3** 文件列表采用 **OSS `list` 实时列举**（非仅会话列表）
- [x] **D4** Word 预览：仅 `.docx` + `docx-preview`（基础排版保真；`.doc` 下载降级）
- [x] **D5** 支持删除（单项确认）；重命名 / 批量操作暂不做
- [ ] **D6** 部署目标平台与域名？是否子路径部署？
- [ ] **D7** 是否允许用户上传后生成「可分享的短期链接」？

---

## 八、推荐实施顺序（给你安排工作时的默认路线）

1. 阶段 1 脚手架跑通
2. 阶段 2 OSS 最小可用直传
3. 阶段 3 上传（含进度与校验）
4. 阶段 4 列表（可先本地会话列表）
5. 阶段 5 预览：先图片 → PDF → Word → 其他
6. 阶段 6 移动端打磨
7. 阶段 7–8 体验、文档、验收与部署

---

## 九、进度记录（后续会话填写）

| 日期       | 完成项                 | 备注                           |
| ---------- | ---------------------- | ------------------------------ |
| 2026-08-25 | 任务清单写入 README    | 待用户安排下一阶段工作         |
| 2026-08-25 | 阶段 0 完成（0.1–0.4） | .gitignore、代码规范、提交约定 |
| 2026-08-25 | 阶段 1.1 完成          | Vite + Vue3 + TS 脚手架        |
| 2026-08-25 | 阶段 1.2 完成          | Element Plus 全量引入 + 图标   |
| 2026-08-25 | 阶段 1.3 完成          | Vue Router + Pinia 骨架路由    |
| 2026-08-25 | 阶段 1.4 完成          | `@` 路径别名（Vite + TS）      |
| 2026-08-25 | 阶段 1.5 完成          | ESLint 10 flat + Prettier      |
| 2026-08-25 | 阶段 1.6 完成          | ImportMetaEnv + .env.example   |
| 2026-08-25 | 阶段 1.7 完成          | 全流程验证 + `pnpm check`      |
| 2026-08-25 | 阶段 1.8 完成          | AppLayout + 移动端底部 Tab     |
| 2026-08-25 | 阶段 2.1 完成          | `docs/oss-setup.md` 准备清单   |
| 2026-08-25 | 阶段 2.2 完成          | `OssClient` 封装 ali-oss       |
| 2026-08-25 | 阶段 2.3 完成          | `src/config/oss.ts` 配置读取   |
| 2026-08-25 | 阶段 2.4 完成          | STS 获取 / 缓存 / 过期重试     |
| 2026-08-25 | 阶段 2.5 完成          | AppError 统一错误与提示        |
| 2026-08-25 | 阶段 2.6 完成          | 联调直传入口 + Object Key 规则 |
| 2026-08-25 | 阶段 3.1 完成          | UploadPanel 拖拽 + 点击选择    |
| 2026-08-25 | 阶段 3.2 完成          | 多选上传队列                   |
| 2026-08-25 | 阶段 3.3 完成          | 类型白名单 + MIME 校验         |
| 2026-08-25 | 阶段 3.4 完成          | 单文件 + 本批总体积限制        |
| 2026-08-25 | 阶段 3.5 完成          | 重名策略 + Key 预分配          |
| 2026-08-25 | 阶段 3.8 完成          | Object Key 规则文档化          |
| 2026-08-25 | 阶段 3.6 完成          | 总进度条 + 队列状态可视化      |
| 2026-08-25 | 阶段 3.7 完成          | 取消上传 + 失败/取消重试       |
| 2026-08-25 | 阶段 3.9 完成          | FileRecord 会话列表回写        |
| 2026-08-25 | 阶段 3.10 完成         | 移动端大按钮 + 拍照上传        |
| 2026-08-25 | 取消 3.11 图片压缩     | 保持源文件上传/下载，不压缩    |
| 2026-08-25 | 阶段 4.1 / 4.2 完成    | OSS list 历史文件 + 列表 UI    |
| 2026-08-25 | 阶段 4.3–4.5 完成      | 搜索筛选排序 + 删除确认        |
| 2026-08-25 | 阶段 4.6–4.8 完成      | 状态 UI + 分页（默认 50/页）   |
| 2026-08-25 | 阶段 5.1 / 5.4.3 完成  | 图片预览 + 统一预览路由骨架    |
| 2026-08-25 | 阶段 5.2 完成          | pdfjs-dist 按页 PDF 预览       |
| 2026-08-25 | 阶段 5.3 完成          | docx-preview 仅支持 .docx      |
| 2026-08-25 | 阶段 5.4 完成          | 文本只读预览（UTF-8 / 截断）   |
| 2026-08-25 | 阶段 6.1–6.7 完成      | 断点/安全区/触控 + PWA 清单    |

---

## 十、快速开始

### 环境要求

- Node.js ≥ 20
- pnpm ≥ 9

### 安装与开发

```bash
pnpm install
pnpm dev
```

浏览器访问 [http://localhost:5173](http://localhost:5173)，应看到顶栏导航与上传页占位内容。

### 生产构建与预览

```bash
pnpm build
pnpm preview
```

预览默认地址 [http://localhost:4173](http://localhost:4173)。

### 移动端自测

断点与安全区已按阶段 6 落地。自测清单见 [`docs/mobile-qa.md`](./docs/mobile-qa.md)。支持「添加到主屏幕」（`manifest.webmanifest`，无离线 Service Worker）。

### 代码质量检查

```bash
pnpm lint          # ESLint
pnpm format:check  # Prettier
pnpm check         # lint + format + build 一键校验
```

### OSS 环境变量（后续上传功能需要）

```bash
cp .env.example .env.local
```

编辑 `.env.local` 填入 OSS / STS 相关变量后 **重启** `pnpm dev`。变量说明见 `.env.example` 与 **§五**。

> 上线前勿将密钥写入仓库；`.env.local` 已在 `.gitignore` 中忽略。

### 阶段 1.7 验证记录（2026-08-25）

| 命令                                     | 结果                           |
| ---------------------------------------- | ------------------------------ |
| `pnpm install`                           | 通过                           |
| `pnpm lint`                              | 通过                           |
| `pnpm format:check`                      | 通过                           |
| `pnpm build`                             | 通过                           |
| `pnpm dev` → `http://127.0.0.1:5173`     | HTTP 200，页面含 `heroxin-pic` |
| `pnpm preview` → `http://127.0.0.1:4173` | HTTP 200，页面含 `heroxin-pic` |
