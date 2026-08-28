import {
  acquirePreviewSignedUrl,
  releasePreviewSignedUrl,
} from '@/services/filePreviewCache'

export interface VideoAlbumThumbResult {
  key: string
  /** 签名播放地址（用于 <video> 首帧预览） */
  url: string
}

/**
 * 获取相册视频缩略图用的签名 URL（复用全局预览缓存）。
 * 组件须成对调用 `releaseVideoAlbumThumb`。
 */
export async function acquireVideoAlbumThumb(
  key: string,
  options?: { force?: boolean },
): Promise<VideoAlbumThumbResult> {
  const url = await acquirePreviewSignedUrl(key, options)
  return { key, url }
}

export function releaseVideoAlbumThumb(key: string) {
  releasePreviewSignedUrl(key)
}

/** @deprecated 使用 `clearPreviewCache`；保留兼容调用 */
export function clearVideoAlbumThumbCache() {
  // 已合并至 filePreviewCache，无独立存储
}
