import { exec, spawn } from 'child_process'
import fs from 'fs'
import { promisify } from 'util'

export const execAsync = promisify(exec)

/**
 * Every `du` in the app queues here. Without a GLOBAL cap the parallel scans
 * spawn ~50 processes that thrash the same disk and end up slower than one.
 */
const MAX_CONCURRENT_DU = 12
let duActive = 0
const duQueue: Array<() => void> = []

async function withDuSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (duActive >= MAX_CONCURRENT_DU) {
    await new Promise<void>(resolve => duQueue.push(resolve))
  }
  duActive++
  try {
    return await fn()
  } finally {
    duActive--
    duQueue.shift()?.()
  }
}

/** Run a shell command async — never blocks the main thread */
export async function run(cmd: string, timeoutMs = 30000): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { maxBuffer: 32 * 1024 * 1024, timeout: timeoutMs })
    return stdout.trim()
  } catch (err: any) {
    // A non-zero exit is normal here: `du` returns 1 when it hits a directory it
    // cannot read (~/Library has several), but everything it DID measure is
    // already on stdout. Throwing that away silently zeroed whole categories.
    return typeof err?.stdout === 'string' ? err.stdout.trim() : ''
  }
}

/**
 * Bytes this file actually occupies on disk.
 *
 * stat.size is the APPARENT size. Sparse files (Docker.raw, VM images, DB files
 * with holes) report a huge apparent size while allocating almost nothing —
 * Docker.raw claims 245 GB and occupies 6 GB. Deleting it frees the 6 GB, so a
 * cleaner must report allocated blocks, not apparent size. st_blocks is always
 * in 512-byte units. This matches what `du` reports.
 */
export function diskBytes(stat: { size: number; blocks?: number }): number {
  return typeof stat.blocks === 'number' ? stat.blocks * 512 : stat.size
}

/** Get directory size in bytes using du -sk, async */
export async function getDirSizeAsync(dirPath: string, timeoutMs = 60000): Promise<number> {
  const [size] = await getDirSizesAsync([dirPath], timeoutMs)
  return size ?? 0
}

/**
 * Sizes for many paths in ONE `du` process instead of one spawn each.
 * `-x` stays on the boot volume (a mounted DMG or network share under $HOME
 * would otherwise be walked and counted). Returns bytes in the input order.
 */
export async function getDirSizesAsync(paths: string[], timeoutMs = 60000): Promise<number[]> {
  if (paths.length === 0) return []
  const byPath = new Map<string, number>()

  // One du process is serial on getattr and leaves the SSD idle, so split the
  // work across several. Chunk size is picked to hit PARALLEL processes (never
  // more than ~60 paths per process — ARG_MAX is ~1 MB on macOS).
  const PARALLEL = 8
  const CHUNK = Math.min(60, Math.max(1, Math.ceil(paths.length / PARALLEL)))
  const chunks: string[][] = []
  for (let i = 0; i < paths.length; i += CHUNK) chunks.push(paths.slice(i, i + CHUNK))

  await Promise.all(chunks.map(async chunk => {
    const args = chunk.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ')
    const out = await withDuSlot(() => run(`du -skx ${args} 2>/dev/null`, timeoutMs))
    for (const line of out.split('\n')) {
      const m = line.match(/^(\d+)\t(.+)$/)
      if (m) byPath.set(m[2], parseInt(m[1], 10) * 1024)
    }
  }))

  return paths.map(p => byPath.get(p) ?? 0)
}

/**
 * Total for a directory AND the total for each of its immediate children, in one
 * parallel pass. A single `du` (even `du -d 1`) walks serially and leaves the SSD
 * mostly idle; fanning out over the children is ~1.6x faster on the same tree and
 * gives the per-child numbers for free.
 */
export async function getDirBreakdown(
  dirPath: string,
  timeoutMs = 90000,
): Promise<{ total: number; children: Map<string, number> }> {
  let childDirs: string[]
  try {
    childDirs = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.isSymbolicLink())
      .map(e => `${dirPath}/${e.name}`)
  } catch {
    return { total: 0, children: new Map() }
  }

  const [childSizes, looseKb] = await Promise.all([
    getDirSizesAsync(childDirs, timeoutMs),
    // Files sitting directly in dirPath — small, but they belong in the total.
    run(`find "${dirPath}" -maxdepth 1 -type f -print0 2>/dev/null | xargs -0 du -sk 2>/dev/null | awk '{s+=$1} END {print s+0}'`, timeoutMs),
  ])

  const children = new Map<string, number>()
  childDirs.forEach((p, i) => children.set(p, childSizes[i]))
  const total = childSizes.reduce((a, b) => a + b, 0) + (parseInt(looseKb, 10) || 0) * 1024
  return { total, children }
}

/**
 * Build `find` args that PRUNE unwanted directories instead of filtering them
 * out of the output. A trailing `! -path` filter on node_modules still walks
 * every file inside it and then discards them; -prune never descends at all.
 * Same results, ~30x faster.
 */
export function findArgs(
  roots: string[],
  predicates: string[],
  pruneDirNames: string[] = [],
): string[] {
  if (pruneDirNames.length === 0) return [...roots, ...predicates, '-print']
  const prune: string[] = ['(']
  pruneDirNames.forEach((name, i) => {
    if (i > 0) prune.push('-o')
    prune.push('-name', name)
  })
  prune.push(')', '-prune', '-o')
  return [...roots, ...prune, ...predicates, '-print']
}

/** Stream output of a long-running find command, resolving once it ends or times out */
export function streamFind(
  args: string[],
  timeoutMs = 90000,
  maxResults = 5000,
): Promise<string[]> {
  return new Promise(resolve => {
    const lines: string[] = []
    const proc = spawn('find', args, { timeout: timeoutMs })
    let done = false
    const finish = (result: string[]) => {
      if (done) return
      done = true
      resolve(result)
    }

    let buf = ''
    proc.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString()
      const parts = buf.split('\n')
      buf = parts.pop() ?? ''
      lines.push(...parts.filter(Boolean))
      // Stop early if we have enough
      if (lines.length >= maxResults) {
        proc.kill()
        finish(lines.slice(0, maxResults))
      }
    })

    proc.on('close', () => {
      if (buf) lines.push(buf)
      finish(lines)
    })

    proc.on('error', () => finish(lines))
  })
}
