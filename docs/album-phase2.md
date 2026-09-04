# 相册二期能力说明（阶段 4.12）

> 对应 README **4.12.7**。说明图片相册二期已落地能力、依赖、配置与常见问题。  
> 一期基础（按日网格、懒加载、预览）见 README **4.11**。入口为顶栏 / 底栏 **相册**（`/images`）。

---

## 1. 能力总览

| 项 | 状态 | 说明 |
| -- | ---- | ---- |
| 4.12.1 EXIF 拍摄日分组 | 已完成 | 日期**标题**优先 Object Key 目录日；无则 EXIF / `uploadedAt`；EXIF 仍用于地点 |
| 4.12.2 GPS / 地点 | 已完成 | 有坐标则逆地理；失败显示坐标文案；无 GPS 不展示地点 |
| 4.12.3 瀑布流 | 已完成 | 按宽高比最短列排布；未知比例先按 1:1，加载后校正 |
| 4.12.4 虚拟滚动 | 已完成 | 按纵向 offset 虚拟化（头 + 单张），带像素 overscan |
| 4.12.5 缩略图优化 | 已完成 | 并发限流、内存 URL 缓存、可选 OSS 图片/视频处理 |
| 4.12.6 交互增强 | 已完成 | 长按多选、批量下载删除、定位到某日 |
| 混合预览 | 已完成 | 图片与视频在同一 gallery 内左右切换（README 8.7 / 9.7） |
| 列表持久化 | 已完成 | 文件列表 IndexedDB 缓存，刷新后增量失效（README 9.6） |

入口：顶栏 / 底栏 **相册**（路由 `/images`）。文件列表不再提供「仅图片」开关。

---

## 2. EXIF（拍摄时间 / GPS）

### 存哪儿？

EXIF 写在**图片文件二进制内部**，不是文件名，也不是 OSS Object Key。原样上传 / 下载一般会保留；社交平台压缩、截图、二次导出常会剥掉。

### 本项目怎么用？

1. 缩略图可见时通过 OSS SDK 拉取对象 Blob（或图片处理签名 URL 展示时另拉原图解析）。
2. 使用 [`exifr`](https://github.com/MikeKovarik/exifr) 读取：
   - 时间：`DateTimeOriginal` → `CreateDate` → `ModifyDate`
   - 位置：`latitude` / `longitude`（或 GPS 字段）
3. 分组：`src/utils/albumGroup.ts` **优先 Object Key 中的 `yyyy/MM/dd` 归档目录**，再 EXIF，再 `uploadedAt`。
4. 元数据缓存在内存（`src/services/imageMeta.ts`），按对象 Key 去重。

### 注意

- 无 EXIF 的图（截图、被压缩过的图）会按**上传日**分组，属预期行为。
- 解析在浏览器端完成，不上传 EXIF 到自有后端。
- 私有 Bucket：走 SDK / 签名，不依赖公共读。

---

## 3. 逆地理编码（地点文案）

有 GPS 时，前端调用 **BigDataCloud** 免 Key 客户端接口：

`https://api.bigdatacloud.net/data/reverse-geocode-client?...&localityLanguage=zh-Hans`（简体中文；`zh` 常返回繁体）

| 结果 | UI |
| ---- | -- |
| 成功 | 日期标题下显示地点（组内取出现最多的文案） |
| 失败（网络 / CORS / 限流） | 显示坐标，如 `31.2304°N, 121.4737°E` |
| 无 GPS | 不显示地点行 |

缓存：同一经纬度（四位小数）会复用文案，减少请求。

**限流与延后（P2）：**

- EXIF 解析完成后**先**写入坐标文案（如 `31.2304°N, 121.4737°E`），不阻塞缩略图展示。
- 逆地理请求在**滚动停止约 400ms 后**再批量发起，且并发上限为 **2**。
- 同一坐标（四位小数）的多张图合并为一次 API 调用；完成后通过 `subscribeAlbumMetaUpdate` 刷新日期标题下的地点行。

**依赖与风险：**

- 依赖第三方公共服务，无 SLA；生产若要稳定，可换成自有/商业逆地理，并改 `src/services/imageMeta.ts` 中 `reverseGeocode`。
- 地点属于隐私敏感信息；仅在用户已上传的带 GPS 原图上展示。

---

## 4. 缩略图加载与缓存（4.12.5）

核心模块：`src/services/albumThumb.ts`。

| 机制 | 默认 | 说明 |
| ---- | ---- | ---- |
| 并发限流 | 4 | `VITE_ALBUM_THUMB_CONCURRENCY` |
| 同 Key 去重 | 有 | 并发请求合并为一次拉取 |
| 引用计数缓存 | 有 | 组件 `acquire` / `release`；闲置项最多保留约 192 个 |
| 视口懒加载 | 有 | `ImageAlbumThumb` + `IntersectionObserver`；滚出视口 `AbortSignal` 取消请求 |
| EXIF 延后 | 处理模式 | 缩略图走签名 URL；地点/拍摄时间通过 `ensureAlbumThumbMeta` 另拉原图解析 |
| 失败重试 | 有 | 缩略图占位可点击重试（弱网 / 签名过期） |
| 即时回填 | 有 | 虚拟列表重挂载时 `peekAlbumThumb` / `peekVideoAlbumPoster` 先展示已缓存 URL |

### 视频封面（P1）

- 模块：`src/services/videoAlbumThumb.ts`
- 默认 OSS 截帧：`video/snapshot,t_0,f_jpg,w_480,m_fast`（`VITE_OSS_VIDEO_SNAPSHOT_PROCESS`）
- 控制台：Bucket → 数据处理 → **媒体处理** → 视频截帧（不必创建样式）
- 失败时回退 `<video>` 元数据截帧或占位图标

### 展示模式

1. **OSS 图片处理（默认，`.env` 已配置）**：缩略图用带 `process` 的签名 URL（约 480px）；**上传/预览/下载仍为原图**。EXIF / 地点在缩略图展示后延后拉原图解析。处理失败自动回退原图 Blob。

2. **原图 Blob 模式**：`.env` 留空 `VITE_OSS_THUMB_PROCESS` 时，拉**原图 Blob** → `URL.createObjectURL` 显示，并同步解析 EXIF。  
   优点：不依赖图片处理权限。  
   缺点：大图多时流量与内存更高。

```env
# 示例：最长边约 480，质量 80（需 Bucket 开通图片处理）
VITE_OSS_THUMB_PROCESS=image/resize,m_lfit,w_480/quality,q_80
```

**开通与权限（阿里云）：**

- 控制台：Bucket → 数据处理 / 图片处理 → 按文档开通。
- 签名 URL 需能带 `x-oss-process`（本项目经 `OssClient.getSignedUrl({ process })`）。
- STS / RAM 策略需允许对该对象的 `GetObject`（处理在读时完成，一般无需额外 Action；以当前账号文档为准）。
- **未开通或签名失败会自动回退原图 Blob**，相册仍可用。

处理会改变返回图尺寸，一般**不保证**处理结果仍含完整 EXIF，故 EXIF 仍以原对象为准。

---

## 5. 瀑布流与虚拟滚动（4.12.3 / 4.12.4）

- 布局：`buildAlbumWaterfallLayout`（`src/utils/albumVirtual.ts`）在每个日期组内用**最短列优先**放置；列数约 2 / 3 / 4（xs / sm / lg）。
- 宽高比：`src/services/imageAspect.ts`；Blob 解码或 `<img>` `naturalWidth/Height` 写入缓存；极端比例会夹紧。
- 未知比例先按 **1:1** 占位，比例到达后重算布局（可能有轻微跳动，属预期）。
- 滚动：`useWindowVirtualRows` 按 `offset` 排序扫描可视区，`overscanPx` 缓冲邻列。
- 懒加载：不可见项不挂载；已挂载项用 `IntersectionObserver` 仅在接近视口时拉取缩略图（滚出预加载区不释放已显示图）。

---

## 6. 多选与批量操作（4.12.6）

| 操作 | 方式 |
| ---- | ---- |
| 进入多选 | **长按**缩略图约 0.5s（桌面端与移动端均支持）；无单独工具栏「多选」按钮 |
| 勾选 | 多选模式下点击；日期标题旁「选当日/当月/当年」；底部条「全选」 |
| 定位到某日 | 工具栏下拉，平滑滚动到该日标题 |
| 批量下载 | 底部条「下载」（逐个触发，带短间隔，减轻浏览器拦截） |
| 批量删除 | 底部条「删除」→ 确认框 → 逐个 `DeleteObject` |
| 退出多选 | 底部条「取消」 |

移动端会在列表上方提示「长按图片或视频可进入多选」。

删除需要 STS / RAM 具备删除权限（与列表单条删除相同）。详见 [`oss-setup.md`](./oss-setup.md)。

---

## 7. 关键代码路径

| 路径 | 职责 |
| ---- | ---- |
| `src/components/file-list/ImageAlbumView.vue` | 相册 UI、虚拟行、多选、定位 |
| `src/components/file-list/ImageAlbumThumb.vue` | 单格懒加载缩略图 |
| `src/services/albumThumb.ts` | 并发 / 缓存 / 可选图片处理 |
| `src/services/videoAlbumThumb.ts` | 视频封面 OSS 截帧 / 缓存 |
| `src/services/imageMeta.ts` | EXIF + 逆地理（滚停延后、坐标去重） |
| `src/services/imageAspect.ts` | 宽高比测量与缓存 |
| `src/utils/albumGroup.ts` | 按日分组与地点聚合 |
| `src/utils/albumVirtual.ts` | 瀑布流虚拟项布局 |
| `src/composables/useWindowVirtualRows.ts` | 窗口虚拟区间 |
| `src/views/ImagesView.vue` | 图片页入口、批量下载/删除接线 |

---

## 8. 环境变量（相册相关）

| 变量 | 含义 | 默认 |
| ---- | ---- | ---- |
| `VITE_ALBUM_THUMB_CONCURRENCY` | 缩略图并发数 | `4` |
| `VITE_UPLOAD_CONCURRENCY` | 上传并行数 | `2` |
| `VITE_OSS_THUMB_PROCESS` | OSS 图片处理参数，须以 `image/` 开头 | 已配置 resize 约 480 |
| `VITE_OSS_VIDEO_SNAPSHOT_PROCESS` | 视频封面截帧，须以 `video/` 开头；留空用内置默认 | `video/snapshot,t_0,f_jpg,w_480,m_fast` |
| `VITE_MAX_VIDEO_SIZE_MB` | 视频单文件上传上限（MB）；图片等仍用 `VITE_MAX_SIZE_MB` | `200` |

完整变量表见 README「环境变量」与根目录 [`.env`](../.env)。

---

## 9. 常见问题

**Q: 为什么很多图没有地点、也不按拍摄日？**  
A: 文件里没有 EXIF（或时间/GPS 被剥掉）。分组会退回上传时间，地点行隐藏。

**Q: 配置了 `VITE_OSS_THUMB_PROCESS` 仍很慢 / 仍像原图？**  
A: 检查 Bucket 是否开通图片处理；浏览器网络面板看缩略图 URL 是否含 `x-oss-process`。失败时会回退原图。

**Q: 逆地理一直是坐标？**  
A: 滚动中会先显示坐标，停稳后才会请求地名；若第三方接口失败则保持坐标。可换自有逆地理服务。

**Q: 批量下载只下了一部分？**  
A: 浏览器常限制多文件自动下载；可允许本站下载，或分批少选。

**Q: 还会做瀑布流吗？**  
A: **4.12.3 已完成**（最短列瀑布流）。比例未加载前为方格占位，加载后会重排。

---

## 10. 相关文档

- [`oss-setup.md`](./oss-setup.md) — Bucket / CORS / STS / 权限
- [`mobile-qa.md`](./mobile-qa.md) — 移动端自测（可补充相册多选 / 长按项）
