import os from 'os'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { streamFind } from './utils'

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

function hashFile(filePath: string): string | null {
  try {
    const hash = crypto.createHash('md5')
    hash.update(fs.readFileSync(filePath))
    return hash.digest('hex')
  } catch {
    return null
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

  const paths = await streamFind([
    ...searchArgs,
    '-type', 'f',
    '-size', '+1M',
    '!', '-path', '*/.git/*',
    '!', '-path', '*/node_modules/*',
  ], 60000)

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
