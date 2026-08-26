# 图片按内容日期归档（阶段 3.12）

> 上传**图片**时，Object Key 中的日期目录优先使用文件名 / EXIF 中的日历日，而不是「今天」。  
> 非图片（PDF / Word / 文本等）行为不变，仍写入上传当日目录。

---

## 1. 目录形态

```text
{VITE_OSS_DIR}{yyyy}/{MM}/{dd}/{uuid}-{原文件名}
```

示例：

| 源文件 | 归档目录 | 来源 |
| ------ | -------- | ---- |
| `IMG_20260315_120001.jpg` | `uploads/2026/03/15/` | 文件名 |
| 无日期文件名 + EXIF 拍摄日 2026-01-02 | `uploads/2026/01/02/` | EXIF |
| `report.pdf` | `uploads/{今天}/` | 上传当日 |
| `photo.jpg`（无文件名日期、无 EXIF） | `uploads/{今天}/` | 上传当日 |

---

## 2. 解析优先级（仅图片）

1. **文件名**中的日期  
2. **EXIF** 拍摄时间：`DateTimeOriginal` → `CreateDate` → `ModifyDate`  
3. **上传当天**（本地日历）

实现：`src/utils/archiveDate.ts`  
入队接线：`useUploadQueue.enqueueFiles`（EXIF 并发上限 3）  
Key 生成：`buildObjectKey({ archiveDatePath })` / `ObjectKeyPlanner.plan(name, path)`

---

## 3. 文件名格式（已覆盖）

**年在前（最常见）**

- `YYYYMMDD`、`YYYY-MM-DD`、`YYYY_MM_DD`、`YYYY.MM.DD`、`YYYY/MM/DD`
- `YYYY MM DD`（空格分隔）
- `YYYY年M月D日` / `YYYY年MM月DD日`
- `YYYYMMDD_HHmmss`、`YYYY-MM-DD_HH-mm-ss`、`YYYYMMDDHHmmss`、`YYYYMMDD HHmmss`
- `YYYY.MM.DD.HH.mm.ss`（点分隔日期+时间）
- `YYYY-MM-DDT12:30:00`（ISO 风格）

**日月在前、年在后**

- `DD-MM-YYYY`、`DD/MM/YYYY`、`DD_MM_YYYY`、`DD.MM.YYYY`
- `DD MM YYYY`（空格）
- `MM-DD-YYYY`（月在前，如 `03-15-2026`）
- `DDMMYYYY`、`MMDDYYYY`（8 位紧凑，年在后）
- 歧义如 `05-06-2026`：优先按 **DD-MM-YYYY**（6 月 5 日）

**其他**

- 带前后缀：`IMG_20260315_120001.jpg`、`photo-2026-03-15.jpg`、`截图2026年3月15日.png`
- **Unix 时间戳**：13 位毫秒、10 位秒（分数低于日历格式）

多候选时取「更像完整日历日」且校验通过的一个；无法判定则跳过文件名，继续 EXIF / 上传日。

---

## 4. 合法性边界

以下视为**无效**，回退下一优先级（最终为上传当日）：

- 非真实日历日（如 2 月 30 日）
- 年份 &lt; 1990
- **晚于今天**的日期（本地日历）
- 仅有时分秒、无法抽出完整年月日

目录只使用**日历日**，忽略时分秒与时区细节（EXIF 日期按解析出的本地年月日取日）。

---

## 5. 相册日期标题

「图片」相册的日期分组标题与 **OSS 归档目录**对齐：

1. Object Key 中的 `yyyy/MM/dd`（与上传归档一致）  
2. 无目录日结构时：EXIF 拍摄日  
3. 再无：上传日 `uploadedAt`  

因此 `uploads/2026/08/11/微信图片_….jpg` 会显示在 **2026年8月11日** 下，即使 EXIF/上传时间是今天。

---

## 6. UI

上传队列每条任务可显示弱提示，例如：

`将归档到：2026/03/15（文件名）` / `（拍摄信息）` / `（上传当日）`

---

## 7. 自测建议

```bash
pnpm test          # vitest：文件名解析 + 优先级 + Object Key 归档路径
```

手工：选一张「文件名含历史日期」的图上传，在 OSS / 文件列表层级目录中确认进入对应 `yyyy/MM/dd`，而不是今天；「图片」相册标题也应为该目录日。

---

## 8. 相关代码

| 路径 | 职责 |
| ---- | ---- |
| `src/utils/archiveDate.ts` | 范围判定、文件名/EXIF、优先级 |
| `src/utils/objectKey.ts` | `archiveDatePath` |
| `src/composables/useUploadQueue.ts` | 入队解析 |
| `src/components/upload/UploadQueueList.vue` | 归档提示 |
| `src/utils/archiveDate.spec.ts` | 单测 |
