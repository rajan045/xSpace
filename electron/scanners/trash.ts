import os from 'os'
import fs from 'fs'
import path from 'path'
import { getDirSizeAsync, run } from './utils'

export interface TrashInfo {
  size: number
  fileCount: number
  files: TrashFile[]
}

export interface TrashFile {
  path: string
  name: string
  size: number
  modified: string
  ext: string
}

export async function getTrashInfo(): Promise<TrashInfo> {
  const trashPath = path.join(os.homedir(), '.Trash')

  if (!fs.existsSync(trashPath)) {
    return { size: 0, fileCount: 0, files: [] }
  }

  const size = await getDirSizeAsync(trashPath)
  let files: TrashFile[] = []

  try {
    const entries = fs.readdirSync(trashPath, { withFileTypes: true })
    const mapped = await Promise.all(
      entries
        .filter(e => e.name !== '.DS_Store')
        .map(async entry => {
          const fullPath = path.join(trashPath, entry.name)
          try {
            const stat = fs.statSync(fullPath)
            const ext = path.extname(entry.name).replace('.', '').toLowerCase()
            const fileSize = entry.isDirectory()
              ? await getDirSizeAsync(fullPath)
              : stat.size
            return { path: fullPath, name: entry.name, size: fileSize, modified: stat.mtime.toISOString(), ext }
          } catch {
            return null
          }
        })
    )
    files = mapped
      .filter((f): f is TrashFile => f !== null)
      .sort((a, b) => b.size - a.size)
      .slice(0, 50)
  } catch {}

  return { size, fileCount: files.length, files }
}

export async function emptyTrash(): Promise<{ success: boolean; freedBytes: number }> {
  try {
    const trashPath = path.join(os.homedir(), '.Trash')
    const sizeBefore = await getDirSizeAsync(trashPath)
    await run(`osascript -e 'tell application "Finder" to empty trash'`, 30000)
    return { success: true, freedBytes: sizeBefore }
  } catch (err) {
    console.error('emptyTrash error:', err)
    return { success: false, freedBytes: 0 }
  }
}
