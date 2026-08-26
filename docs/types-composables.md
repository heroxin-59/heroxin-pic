# 类型与 Composables（阶段 7.4 / 7.5）

## 类型（`@/types`）

| README 名称 | 实现 | 说明 |
| --- | --- | --- |
| FileItem | `FileRecord`（别名 `FileItem`） | 列表/预览文件记录 |
| UploadStatus | `UploadTaskStatus`（别名 `UploadStatus`） | 上传任务状态 |
| OssConfig | `OssClientConfig`（别名 `OssConfig`） | OSS 客户端配置 |
| PreviewType | `PreviewType`（旧名 `PreviewKind`） | 预览器分支 |

统一入口：

```ts
import type { FileRecord, PreviewType, UploadStatus, OssConfig } from '@/types'
```

## Composables

| 名称 | 文件 | 用途 |
| --- | --- | --- |
| `useBreakpoint` | `composables/useBreakpoint.ts` | 断点 / 横竖屏 |
| `useOss` | `composables/useOss.ts` | 连接配置、上传限额、`withClient` |
| `useUploader` | `composables/useUploader.ts` | 上传队列（同 `useUploadQueue`） |
| `useFilePreview` | `composables/useFilePreview.ts` | 预览加载 / 类型 / 下载 |
| `useFileListQuery` | `composables/useFileListQuery.ts` | 列表筛选排序分页 |
