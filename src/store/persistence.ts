import Dexie, { type Table } from 'dexie'

/**
 * Persistence boundary.
 *
 * Everything above this file talks to `PersistenceAdapter`. The IndexedDB
 * implementation is one swap away from a cloud-backed one; nothing in the app
 * assumes local storage beyond this interface.
 */
export interface PersistenceAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

interface KvRow {
  key: string
  value: string
}

interface BlobRow {
  key: string
  blob: Blob
  contentType: string
  width?: number
  height?: number
  savedAt: string
}

class LunavotaDb extends Dexie {
  kv!: Table<KvRow, string>
  blobs!: Table<BlobRow, string>

  constructor() {
    super('lunavota')
    this.version(1).stores({
      kv: 'key',
      blobs: 'key',
    })
  }
}

export const db = new LunavotaDb()

export const indexedDbAdapter: PersistenceAdapter = {
  async getItem(key) {
    try {
      const row = await db.kv.get(key)
      return row?.value ?? null
    } catch {
      return null
    }
  },
  async setItem(key, value) {
    try {
      await db.kv.put({ key, value })
    } catch {
      // A full or blocked database must never break the session in progress.
    }
  },
  async removeItem(key) {
    try {
      await db.kv.delete(key)
    } catch {
      /* ignore */
    }
  },
}

/* ------------------------------------------------------------------ */
/* Artwork blob store                                                  */
/* ------------------------------------------------------------------ */

const objectUrls = new Map<string, string>()

export async function putBlob(
  key: string,
  blob: Blob,
  meta: { width?: number; height?: number } = {},
): Promise<void> {
  await db.blobs.put({
    key,
    blob,
    contentType: blob.type,
    width: meta.width,
    height: meta.height,
    savedAt: new Date().toISOString(),
  })
  const existing = objectUrls.get(key)
  if (existing) {
    URL.revokeObjectURL(existing)
    objectUrls.delete(key)
  }
}

/** Resolves a cached artwork blob to an object URL, memoised per session. */
export async function blobUrl(key: string): Promise<string | undefined> {
  const cached = objectUrls.get(key)
  if (cached) return cached
  const row = await db.blobs.get(key)
  if (!row) return undefined
  const url = URL.createObjectURL(row.blob)
  objectUrls.set(key, url)
  return url
}

export async function deleteBlob(key: string): Promise<void> {
  await db.blobs.delete(key)
  const url = objectUrls.get(key)
  if (url) {
    URL.revokeObjectURL(url)
    objectUrls.delete(key)
  }
}

export async function listBlobKeys(): Promise<string[]> {
  return db.blobs.toCollection().primaryKeys()
}

export async function clearEverything(): Promise<void> {
  await Promise.all([db.kv.clear(), db.blobs.clear()])
  for (const url of objectUrls.values()) URL.revokeObjectURL(url)
  objectUrls.clear()
}
