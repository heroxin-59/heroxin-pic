# heroxin-pic

纯前端文件上传与预览应用：基于 **Vue 3 + Element Plus + TypeScript + pnpm**，对接 **阿里云 OSS**，支持图片 / Word / PDF 等基础文件的上传与预览，并兼容电脑端与手机端。

> 本文档为开发任务清单与项目记忆文档。后续开发请优先阅读本文件，按阶段推进；完成一项可将对应项标记为 `[x]`。

---

## 一、项目目标与边界

### 1.1 目标

- 用户可选择本地文件并上传至阿里云 OSS
- 上传后可在线预览：图片、Word（`.doc` / `.docx`）、PDF，以及其他基础文件的下载/信息展示
- 同一套 UI 适配桌面端与移动端（响应式）
- 纯前端部署，无自建后端业务服务（OSS / STS 由阿里云侧提供）

### 1.2 非目标（当前阶段不做）

- 用户登录 / 权限体系（可后续扩展）
- 自建文件管理后端、数据库
- 在线协同编辑 Word / PDF
- 视频转码、音视频流媒体播放（如需可单列二期）

### 1.3 技术选型（已定）

| 类别 | 选型 | 说明 |
|------|------|------|
| 框架 | Vue 3（Composition API + `<script setup>`） | 现代前端基座 |
| UI | Element Plus | 组件库，需处理移动端适配 |
| 语言 | TypeScript | 全量 TS |
| 包管理 | pnpm | 锁定版本，统一安装命令 |
| 构建 | Vite | 推荐默认脚手架 |
| OSS SDK | `ali-oss` | 浏览器直传 |
| 路由 | Vue Router | 上传页 / 预览页 / 列表页等 |
| 状态 | Pinia（按需） | 上传队列、配置、文件列表 |

---

## 二、整体架构说明（备忘）

```
浏览器 (Vue3 SPA)
  ├─ 上传模块 ──► 获取临时凭证(STS) ──► ali-oss 直传 OSS
  ├─ 文件列表 ──► 列举 / 刷新 OSS 对象（或本地会话缓存）
  └─ 预览模块 ──► 按 MIME / 扩展名分流
        ├─ 图片：原生 / Element Plus Image 预览
        ├─ PDF：pdf.js 或 iframe + OSS 签名 URL
        ├─ Word：docx-preview / mammoth 等前端解析，或转预览方案
        └─ 其他：提供下载与元信息展示
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
- [ ] **0.5** 编写「如何启动 / 如何配置 OSS」的快速开始说明（随脚手架完成后补充）

#### 代码规范（0.3）

| 类型 | 规范 | 示例 |
|------|------|------|
| Vue 组件文件 | PascalCase | `FileList.vue`、`UploadPanel.vue` |
| composables | `use` 前缀 + camelCase | `useOss.ts`、`useUploader.ts` |
| 工具函数 / 变量 | camelCase | `formatFileSize.ts`、`getSignedUrl` |
| 类型 / 接口 | PascalCase | `FileItem`、`OssConfig` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE_MB` |
| 路由 path | kebab-case | `/file-list`、`/preview` |

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
- [ ] **1.5** 配置 ESLint + Prettier（或项目统一的 lint/format 方案）并与 Vue/TS 兼容
- [ ] **1.6** 配置 `env` 类型声明（`ImportMetaEnv`），区分 `VITE_` 前缀变量
- [ ] **1.7** 验证：`pnpm install` / `pnpm dev` / `pnpm build` 可正常跑通空壳页面
- [ ] **1.8** 基础布局骨架：顶栏 + 主内容区 + 移动端友好的导航（抽屉/底部栏择一）

---

### 阶段 2：阿里云 OSS 接入基础

- [ ] **2.1** 梳理阿里云侧准备项清单（文档化）：
  - [ ] 创建 OSS Bucket（地域、存储类型、读写权限）
  - [ ] 配置跨域 CORS（允许本地与线上 Origin、Methods：GET/PUT/POST/HEAD、必要 Headers）
  - [ ] 创建 RAM 用户 / 角色，最小权限（上传、列举、读取指定前缀）
  - [ ] （推荐）开通 STS，约定前端获取临时凭证的方式与接口形态
- [ ] **2.2** 封装 `src/utils/oss.ts` 或 `src/services/ossClient.ts`：创建客户端、上传、列举、删除、生成签名 URL
- [ ] **2.3** 封装配置读取：`region`、`bucket`、`endpoint`、路径前缀 `dir`、STS 相关地址
- [ ] **2.4** 实现 STS 临时凭证获取与自动刷新（凭证过期重试）
- [ ] **2.5** 统一错误处理：网络失败、权限不足、CORS、文件超限等友好提示
- [ ] **2.6** 本地联调：用测试文件验证直传成功，并在控制台可见对象

---

### 阶段 3：文件上传功能

- [ ] **3.1** 上传入口 UI：拖拽区 + 点击选择（Element Plus `el-upload` 或自定义）
- [ ] **3.2** 支持多选文件上传
- [ ] **3.3** 文件类型白名单（可配置）：图片（jpg/png/gif/webp/svg 等）、pdf、doc/docx、常见办公/文本类型
- [ ] **3.4** 单文件大小限制与总体积限制（可配置，前端校验 + 失败提示）
- [ ] **3.5** 上传前校验：扩展名、MIME、空文件、重名策略（覆盖 / 自动重命名 / 时间戳前缀）
- [ ] **3.6** 上传进度展示（单文件进度条 + 多文件队列状态：等待/上传中/成功/失败）
- [ ] **3.7** 支持取消上传 / 失败重试
- [ ] **3.8** Object Key 命名规则：`{prefix}/{yyyy}/{MM}/{dd}/{uuid}-{filename}`（最终规则可调整，需写清）
- [ ] **3.9** 上传成功后回写：文件名、大小、类型、OSS URL / Key、上传时间
- [ ] **3.10** 移动端适配：大按钮、避免依赖 hover；相机拍照上传（`accept` + `capture` 按需）
- [ ] **3.11** （可选）图片上传前压缩 / 限制最大分辨率，减少流量

---

### 阶段 4：文件列表与管理

- [ ] **4.1** 文件列表页：名称、类型图标、大小、上传时间、操作列
- [ ] **4.2** 数据来源策略二选一（实现前确认）：
  - A. 调用 OSS `list` 列举指定前缀
  - B. 会话内本地维护列表（上传成功追加；刷新丢失）——适合无 STS list 权限的临时方案
- [ ] **4.3** 搜索 / 按类型筛选（图片、文档、PDF、其他）
- [ ] **4.4** 排序：时间、名称、大小
- [ ] **4.5** 操作：预览、下载（签名 URL）、复制链接、删除（需确认弹窗；注意 OSS 删除权限）
- [ ] **4.6** 空状态、加载中、加载失败 UI
- [ ] **4.7** 分页或无限滚动（文件量大时）
- [ ] **4.8** 桌面端表格 / 移动端卡片列表双布局（或同一响应式布局）

---

### 阶段 5：文件预览

#### 5.1 图片预览

- [ ] **5.1.1** 缩略图列表展示
- [ ] **5.1.2** 点击大图预览（缩放、旋转、左右切换）——可用 Element Plus `el-image` 或专用预览组件
- [ ] **5.1.3** 私有 Bucket 使用签名 URL，注意 URL 过期刷新
- [ ] **5.1.4** 移动端手势：双指缩放、滑动切换（至少保证基础可用）

#### 5.2 PDF 预览

- [ ] **5.2.1** 选型：`pdfjs-dist` 自绘 或 iframe / embed 打开签名 URL（评估兼容性后定稿）
- [ ] **5.2.2** 基础能力：翻页、缩放、页码跳转、加载进度
- [ ] **5.2.3** 大文件与移动端内存问题：按需渲染页面，避免一次性加载过多页
- [ ] **5.2.4** 预览失败降级：提供「下载后查看」

#### 5.3 Word 预览（`.doc` / `.docx`）

- [ ] **5.3.1** 明确范围：优先保证 `.docx`；`.doc` 老格式可能无法完美前端解析，需降级策略
- [ ] **5.3.2** 选型调研并定稿（例如 `docx-preview`、`mammoth` 转 HTML 等）
- [ ] **5.3.3** 实现预览页：样式尽量贴近原文档，处理图片、表格基础展示
- [ ] **5.3.4** 不支持或解析失败时：明确提示 + 下载按钮
- [ ] **5.3.5** （可选二期）对接「Office 在线预览 / 转 PDF 再预览」等云端方案

#### 5.4 其他文件

- [ ] **5.4.1** 文本类（`.txt` / `.md` / `.json` 等）：只读预览（注意编码与大文件截断）
- [ ] **5.4.2** 无法预览类型：展示文件信息卡片 + 下载
- [ ] **5.4.3** 统一预览路由：`/preview?key=...` 或 `/preview/:id`，按类型动态加载预览器

---

### 阶段 6：响应式与移动端体验

- [ ] **6.1** 断点约定（与 Element Plus 对齐）：xs / sm / md / lg
- [ ] **6.2** 布局：顶栏在小屏折叠；上传区全宽；列表改卡片
- [ ] **6.3** 触摸友好：可点击区域 ≥ 44px；避免过密操作按钮
- [ ] **6.4** 安全区：适配刘海屏 / 底部 Home 条（`env(safe-area-inset-*)`）
- [ ] **6.5** 横竖屏基础可用，关键弹层不裁切
- [ ] **6.6** 真机或浏览器移动模式自测：上传、预览、下载全流程
- [ ] **6.7** （可选）PWA 基础：可添加到主屏幕（非必须）

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

| 变量名（草案） | 含义 | 备注 |
|----------------|------|------|
| `VITE_OSS_REGION` | OSS 地域 | 如 `oss-cn-hangzhou` |
| `VITE_OSS_BUCKET` | Bucket 名 | |
| `VITE_OSS_ENDPOINT` | Endpoint（可选） | 自定义域名时使用 |
| `VITE_OSS_DIR` | 上传目录前缀 | 如 `uploads/` |
| `VITE_STS_URL` | 获取 STS 的接口 | 推荐生产使用 |
| `VITE_MAX_SIZE_MB` | 单文件上限 | |
| `VITE_ALLOWED_EXT` | 允许扩展名列表 | 逗号分隔 |

---

## 六、关键依赖候选（选型时确认）

| 用途 | 候选包 | 状态 |
|------|--------|------|
| OSS | `ali-oss` | 待接入 |
| PDF | `pdfjs-dist` | 待选型确认 |
| Word(docx) | `docx-preview` / `mammoth` | 待选型确认 |
| 工具 | `dayjs`、`file-type`（可选） | 按需 |
| 图标 | `@element-plus/icons-vue` | 推荐 |

---

## 七、风险与决策待办（开发前尽量拍板）

- [ ] **D1** STS 由谁提供？是否已有可调用的临时凭证接口？若无，本地调试策略是什么？
- [ ] **D2** Bucket 公共读还是私有读 + 签名 URL？
- [ ] **D3** 文件列表是否必须实时列举 OSS，还是会话级本地列表即可？
- [ ] **D4** Word 预览要达到的保真度？（基础排版 vs 接近 Word）
- [ ] **D5** 是否需要删除、重命名、批量操作？
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

| 日期 | 完成项 | 备注 |
|------|--------|------|
| 2026-08-25 | 任务清单写入 README | 待用户安排下一阶段工作 |
| 2026-08-25 | 阶段 0 完成（0.1–0.4） | .gitignore、代码规范、提交约定 |
| 2026-08-25 | 阶段 1.1 完成 | Vite + Vue3 + TS 脚手架 |
| 2026-08-25 | 阶段 1.2 完成 | Element Plus 全量引入 + 图标 |
| 2026-08-25 | 阶段 1.3 完成 | Vue Router + Pinia 骨架路由 |
| 2026-08-25 | 阶段 1.4 完成 | `@` 路径别名（Vite + TS） |

---

## 十、快速开始（脚手架完成后填写）

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
pnpm preview
```

配置步骤：复制 `.env.example` → `.env.local`，填入 OSS / STS 相关变量后重启开发服务。
