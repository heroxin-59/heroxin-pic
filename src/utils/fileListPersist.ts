import type { FileRecord } from '@/types/file'

const DB_NAME = 'heroxin-pic'
const DB_VERSION = 1
const STORE = 'file-list-snapshots'

interface PersistedSnapshot {
  prefix: string
  records: FileRecord[]
  savedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'prefix' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function snapshotKey(prefix: string): string {
  return prefix.endsWith('/') ? prefix : `${prefix}/`
}

/** 读取本地缓存的全量列表；失败时返回 null（不阻断主流程） */
export async function readPersistedFileList(prefix: string): Promise<FileRecord[] | null> {
  try {
    const db = await openDb()
    const key = snapshotKey(prefix)

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(key)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
      request.onsuccess = () => {
        const row = request.result as PersistedSnapshot | undefined
        resolve(row?.records?.length ? row.records : null)
      }
      tx.oncomplete = () => db.close()
    })
  } catch {
    return null
  }
}

/** 写入本地缓存的全量列表；失败时静默忽略 */
export async function writePersistedFileList(prefix: string, records: FileRecord[]): Promise<void> {
  try {
    const db = await openDb()
    const payload: PersistedSnapshot = {
      prefix: snapshotKey(prefix),
      records,
      savedAt: new Date().toISOString(),
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(payload)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'))
    })

    db.close()
  } catch {
    // ignore persistence errors
  }
}

export async function clearPersistedFileList(prefix: string): Promise<void> {
  try {
    const db = await openDb()
    const key = snapshotKey(prefix)

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
    })

    db.close()
  } catch {
    // ignore
  }
}
