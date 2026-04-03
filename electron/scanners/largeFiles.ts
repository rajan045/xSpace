import os from 'os'
import path from 'path'
import fs from 'fs'
import { streamFind } from './utils'

export interface LargeFile {
  path: string
  name: string
  size: number
  modified: string
  ext: string
}

export async function getLargeFiles(minSizeMB: number = 50): Promise<LargeFile[]> {
  const home = os.homedir()
  const minSizeBytes = minSizeMB * 1024 * 1024

  // Use streamFind (spawn-based, non-blocking) instead of execSync
  const paths = await streamFind([
    home,
    '-type', 'f',
    '-size', `+${minSizeMB}M`,
    '!', '-path', '*/.git/*',
    '!', '-path', '*/node_modules/*',
    '!', '-path', '*/Library/Application Support/MobileSync/*',
    '!', '-path', '*/Library/Application Support/com.apple.shazam/*',
  ], 120000)

  const files: LargeFile[] = paths
    .map(filePath => {
      try {
        const stat = fs.statSync(filePath)
        return {
          path: filePath,
          name: path.basename(filePath),
          size: stat.size,
          modified: stat.mtime.toISOString(),
          ext: path.extname(filePath).toLowerCase().replace('.', ''),
        }
      } catch {
        return null
      }
    })
    .filter((f): f is LargeFile => f !== null && f.size >= minSizeBytes)
    .sort((a, b) => b.size - a.size)
    .slice(0, 100)

  return files
}
