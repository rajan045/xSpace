import os from 'os'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { findArgs, streamFind } from './utils'

export interface DuplicateGroup {
  hash: string
  size: number
  totalWasted: number
  files: DuplicateFile[]
}

export interface DuplicateFile {
  path: string
  name: string
  size: number
  modified: string
}

/** SHA-256 of the whole file, read in chunks so a multi-GB duplicate never lands in memory. */
export function hashFile(filePath: string): string | null {
  const CHUNK = 1024 * 1024
  let fd: number | null = null
  try {
    const hash = crypto.createHash('sha256')
    fd = fs.openSync(filePath, 'r')
    const buf = Buffer.allocUnsafe(CHUNK)
    let bytesRead: number
    while ((bytesRead = fs.readSync(fd, buf, 0, CHUNK, null)) > 0) {
      hash.update(bytesRead === CHUNK ? buf : buf.subarray(0, bytesRead))
    }
    return hash.digest('hex')
  } catch {
    return null
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd) } catch {}
    }
  }
}

export async function getDuplicates(): Promise<DuplicateGroup[]> {
  const home = os.homedir()
  const minSizeBytes = 1024 * 1024 // 1 MB

  // Search common user dirs — not the whole home (too slow)
  const searchArgs: string[] = []
  for (const dir of ['Downloads', 'Documents', 'Desktop', 'Pictures', 'Movies']) {
    const fullPath = `${home}/${dir}`
    if (fs.existsSync(fullPath)) searchArgs.push(fullPath)
  }
  if (searchArgs.length === 0) return []

  const paths = await streamFind(
    findArgs(
      searchArgs,
      ['-type', 'f', '-size', '+1M'],
      ['node_modules', '.git'],
    ),
    60000,
  )

  // Group by size first (cheap filter)
  const sizeGroups: Record<number, string[]> = {}
  for (const filePath of paths) {
    try {
      const stat = fs.statSync(filePath)
      if (stat.size < minSizeBytes) continue
      if (!sizeGroups[stat.size]) sizeGroups[stat.size] = []
      sizeGroups[stat.size].push(filePath)
    } catch {}
  }

  // Hash only files that share a size
  const hashGroups: Record<string, DuplicateFile[]> = {}
  for (const [sizeStr, filePaths] of Object.entries(sizeGroups)) {
    if (filePaths.length < 2) continue
    const size = parseInt(sizeStr)
    for (const filePath of filePaths) {
      const hash = hashFile(filePath)
      if (!hash) continue
      try {
        const stat = fs.statSync(filePath)
        if (!hashGroups[hash]) hashGroups[hash] = []
        hashGroups[hash].push({
          path: filePath,
          name: path.basename(filePath),
          size,
          modified: stat.mtime.toISOString(),
        })
      } catch {}
    }
  }

  return Object.entries(hashGroups)
    .filter(([, files]) => files.length > 1)
    .map(([hash, files]) => ({
      hash,
      size: files[0].size,
      totalWasted: files[0].size * (files.length - 1),
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
    }))
    .sort((a, b) => b.totalWasted - a.totalWasted)
    .slice(0, 50)
}
