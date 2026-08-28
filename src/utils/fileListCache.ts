import type { FileRecord, FolderEntry } from '@/types/file'

function normalizeListPrefix(prefix: string): string {
  const cleaned = prefix.replace(/^\/+/, '')
  if (!cleaned) return ''
  return cleaned.endsWith('/') ? cleaned : `${cleaned}/`
}

function folderNameFromPrefix(fullPrefix: string, parentPrefix: string): string {
  const rest = fullPrefix.startsWith(parentPrefix)
    ? fullPrefix.slice(parentPrefix.length)
    : fullPrefix
  return rest || fullPrefix
}

export interface DirectorySliceResult {
  prefix: string
  folders: FolderEntry[]
  records: FileRecord[]
}

/** 从全量文件列表切片出某一「虚拟目录」层（与 OSS delimiter=/ 列举语义一致） */
export function listDirectoryFromFullList(
  allRecords: FileRecord[],
  prefix?: string,
  rootPrefix?: string,
): DirectorySliceResult {
  const listPrefix = normalizeListPrefix(prefix?.trim() || rootPrefix || '')
  const folderMap = new Map<string, FolderEntry>()
  const records: FileRecord[] = []

  for (const record of allRecords) {
    if (!record.key.startsWith(listPrefix)) continue

    const rest = record.key.slice(listPrefix.length)
    if (!rest) continue

    const slash = rest.indexOf('/')
    if (slash < 0) {
      records.push(record)
      continue
    }

    if (slash === 0) continue

    const folderPrefix = `${listPrefix}${rest.slice(0, slash + 1)}`
    if (!folderMap.has(folderPrefix)) {
      folderMap.set(folderPrefix, {
        prefix: folderPrefix,
        name: folderNameFromPrefix(folderPrefix, listPrefix),
      })
    }
  }

  const folders = [...folderMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base', numeric: true }),
  )
  records.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))

  return { prefix: listPrefix, folders, records }
}

export function upsertFullListRecord(
  list: FileRecord[],
  record: FileRecord,
): FileRecord[] {
  const withoutDup = list.filter((item) => item.key !== record.key)
  return [record, ...withoutDup].sort(
    (a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt),
  )
}

export function removeFullListRecordById(list: FileRecord[], id: string): FileRecord[] {
  return list.filter((item) => item.id !== id)
}
