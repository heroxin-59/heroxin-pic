export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  // ≥ 1024 MB 时用 GB，避免相册统计出现超大 MB 数
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}`
}
