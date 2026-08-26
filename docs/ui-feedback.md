# 全局反馈规范（阶段 7.1）

统一走 `@/utils/message` 与 `@/utils/loading`，避免业务里直接散落 `ElMessage` / `ElMessageBox` / `ElLoading.service`。

## Message

| API | 用途 |
| --- | --- |
| `showAppSuccess` | 操作成功（复制、删除成功、上传完成等） |
| `showAppWarning` | 可预期的软失败 / 提示（空列表、部分失败、校验） |
| `showAppError` | 异常；会按 `AppError` 码分流（校验类 → warning，其余 → error） |
| `showAppInfo` | 中性说明 |

约定：

- 文案简洁、面向用户，不直接抛 OSS/SDK 原始堆栈
- 同类短时重复提示开启 `grouping`，避免刷屏
- error 显示关闭按钮；时长见 `APP_MESSAGE_DURATION`

## MessageBox（确认）

| API | 用途 |
| --- | --- |
| `confirmApp(message, options?)` | 通用确认；返回 `true`/`false`（取消与关闭均为 false） |
| `confirmAppDelete(label)` | 删除确认（危险按钮 + 不可恢复文案） |

约定：

- 不可逆操作必须 `danger: true`，并写明后果
- 不要用 `ElMessageBox.confirm` 的 throw 控制流；统一用返回值判断
- `closeOnClickModal: false`，避免误关

## Loading

| 场景 | 做法 |
| --- | --- |
| 列表 / 预览区 / 卡片内局部等待 | `v-loading`（或按钮 `:loading`） |
| 无明确区域、需挡住整页的短任务 | `showAppLoading` / `hideAppLoading` / `withAppLoading` |
| 同一操作 | **二选一**，不要全局 + 局部同时开 |

示例：

```ts
import { withAppLoading } from '@/utils/loading'
import { showAppSuccess, showAppError } from '@/utils/message'

try {
  await withAppLoading(() => doSomething(), '处理中…')
  showAppSuccess('完成')
} catch (error) {
  showAppError(error)
}
```
