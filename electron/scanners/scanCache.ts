/**
 * Scans walk hundreds of thousands of inodes — 10–50s each. Nothing on disk
 * changes fast enough to justify redoing that when the user tabs away and back,
 * so results are held briefly and reused. Explicit Refresh passes force=true.
 */
type Entry = { at: number; value: unknown }

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()

export const DEFAULT_TTL_MS = 5 * 60 * 1000

export async function cached<T>(
  key: string,
  ttlMs: number,
  force: boolean,
  produce: () => Promise<T>,
): Promise<T> {
  if (force) {
    cache.delete(key)
  } else {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as T
    // A second caller during an in-flight scan waits for it instead of starting its own.
    const running = inflight.get(key)
    if (running) return running as Promise<T>
  }

  const p = produce()
    .then(value => {
      cache.set(key, { at: Date.now(), value })
      return value
    })
    .finally(() => inflight.delete(key))

  inflight.set(key, p)
  return p
}

/** Drop cached results — call after a delete so sizes aren't stale. */
export function invalidateScans(): void {
  cache.clear()
}
