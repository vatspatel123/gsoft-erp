/**
 * This PC's own copy of what the screens show, so a screen opens at once with
 * the last data it had and then refreshes from the server in the background.
 *
 * Reads only. Every save (bills, purchases, stock, edits) still goes to the
 * server exactly as before; a screen re-reads after saving, which refreshes
 * this copy too. If anything here fails, readLocal returns nothing and the
 * screen loads from the server the way it always did.
 *
 * IndexedDB, not localStorage: localStorage holds ~5 MB and the product list
 * alone is 1.3 MB of it.
 */

const DB_NAME = 'erp-local'
const STORE = 'screens'
// Bump when the shape of what a screen keeps changes: copies made by an older
// build are then ignored and rebuilt from the server instead of misread.
const FORMAT = 1

let opening: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    opening.catch(() => { opening = null })   // try again next time
  }
  return opening
}

function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(d => new Promise<T>((resolve, reject) => {
    const req = op(d.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  }))
}

const k = (key: string) => `${FORMAT}:${key}`

/** The copy kept for `key`, or undefined when there is none (or storage fails). */
export async function readLocal<T>(key: string): Promise<T | undefined> {
  try {
    const row = await run<{ data: T; at: number } | undefined>('readonly', s => s.get(k(key)))
    return row?.data
  } catch { return undefined }
}

/** Keep the server's latest answer for `key`. Failure only means no copy next time. */
export async function writeLocal(key: string, data: unknown): Promise<void> {
  try { await run('readwrite', s => s.put({ data, at: Date.now() }, k(key))) } catch { /* not kept */ }
}

/**
 * Show the kept copy of `key` straight away — unless the server has already
 * answered (`isFresh`), in which case the copy is older and must not replace it.
 */
export function seedLocal<T>(key: string, apply: (data: T) => void, isFresh: () => boolean): void {
  void readLocal<T>(key).then(d => { if (d !== undefined && !isFresh()) apply(d) })
}

/** Forget every copy; each screen then loads from the server and keeps a fresh one. */
export async function clearLocal(): Promise<void> {
  try { await run('readwrite', s => s.clear()) } catch { /* nothing kept */ }
}
