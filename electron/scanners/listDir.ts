import fs from 'fs'
import path from 'path'
import { run } from './utils'

export interface DirEntry {
  name: string
  path: string
  size: number
  isDir: boolean
  modified: string
  ext: string
}

export async function listDirContents(dirPath: string, maxItems = 40): Promise<DirEntry[]> {
  if (!fs.existsSync(dirPath)) return []

  try {
    // Single du call for all children — vastly faster than one du per child
    const duOut = await run(
      `du -sk "${dirPath}"/* 2>/dev/null | sort -rn | head -${maxItems}`,
      30000
    )

    if (!duOut) {
      // Fallback: just list without sizes (dir might have no sub-items readable by du)
      return listWithoutSizes(dirPath, maxItems)
    }

    const results: DirEntry[] = []

    for (const line of duOut.split('\n').filter(Boolean)) {
      const tabIdx = line.indexOf('\t')
      if (tabIdx === -1) continue
      const sizeKB = parseInt(line.slice(0, tabIdx).trim(), 10)
      const fullPath = line.slice(tabIdx + 1).trim()
      if (!fullPath) continue

      try {
        const stat = fs.statSync(fullPath)
        const isDir = stat.isDirectory()
        results.push({
          name: path.basename(fullPath),
          path: fullPath,
          size: sizeKB * 1024,
          isDir,
          modified: stat.mtime.toISOString(),
          ext: isDir ? '' : path.extname(fullPath).replace('.', '').toLowerCase(),
        })
      } catch {
        // skip inaccessible entries
      }
    }

    return results.slice(0, maxItems)
  } catch {
    return listWithoutSizes(dirPath, maxItems)
  }
}

/** Fallback: list entries without sizes when du fails */
function listWithoutSizes(dirPath: string, maxItems: number): DirEntry[] {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => e.name !== '.DS_Store')
      .slice(0, maxItems)
      .map(entry => {
        const fullPath = path.join(dirPath, entry.name)
        try {
          const stat = fs.statSync(fullPath)
          const isDir = entry.isDirectory()
          return {
            name: entry.name,
            path: fullPath,
            size: isDir ? 0 : stat.size,
            isDir,
            modified: stat.mtime.toISOString(),
            ext: isDir ? '' : path.extname(entry.name).replace('.', '').toLowerCase(),
          }
        } catch {
          return null
        }
      })
      .filter((e): e is DirEntry => e !== null)
  } catch {
    return []
  }
}
