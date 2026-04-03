import fs from 'fs'
import path from 'path'
import os from 'os'
import { getDirSizeAsync, run } from './utils'

export interface FileOpResult {
  success: boolean
  errors: string[]
  freedBytes: number
  deletedPaths: string[]
}

async function getSize(p: string): Promise<number> {
  try {
    const stat = fs.statSync(p)
    if (stat.isFile()) return stat.size
    return getDirSizeAsync(p)
  } catch {
    return 0
  }
}

export async function moveToTrash(paths: string[]): Promise<FileOpResult> {
  const errors: string[] = []
  const deletedPaths: string[] = []
  let freedBytes = 0

  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) continue
      const size = await getSize(p)
      const escaped = p.replace(/"/g, '\\"')
      await run(
        `osascript -e 'tell application "Finder" to move POSIX file "${escaped}" to trash'`,
        15000
      )
      freedBytes += size
      deletedPaths.push(p)
    } catch (err: any) {
      errors.push(`Failed to move ${path.basename(p)}: ${err.message}`)
    }
  }

  return { success: errors.length === 0, errors, freedBytes, deletedPaths }
}

export async function deleteItems(paths: string[]): Promise<FileOpResult> {
  const errors: string[] = []
  const deletedPaths: string[] = []
  let freedBytes = 0

  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) continue
      const size = await getSize(p)
      const stat = fs.statSync(p)
      if (stat.isDirectory()) {
        fs.rmSync(p, { recursive: true, force: true })
      } else {
        fs.unlinkSync(p)
      }
      freedBytes += size
      deletedPaths.push(p)
    } catch (err: any) {
      errors.push(`Failed to delete ${path.basename(p)}: ${err.message}`)
    }
  }

  return { success: errors.length === 0, errors, freedBytes, deletedPaths }
}
