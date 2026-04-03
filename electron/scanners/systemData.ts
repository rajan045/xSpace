import { getDirSizeAsync, run } from './utils'
import fs from 'fs'
import os from 'os'

export interface SystemDataEntry {
  name: string
  path: string
  size: number
  description: string
  safeToDelete: boolean
}

const SYSTEM_DIRS: Omit<SystemDataEntry, 'size'>[] = [
  {
    name: 'macOS System Files',
    path: '/System',
    description: 'Core macOS operating system — cannot be modified',
    safeToDelete: false,
  },
  {
    name: 'System Library',
    path: '/Library',
    description: 'System-wide apps, frameworks, and preferences',
    safeToDelete: false,
  },
  {
    name: 'Unix Tools & Binaries',
    path: '/usr',
    description: 'Built-in Unix command-line tools and libraries',
    safeToDelete: false,
  },
  {
    name: 'System Caches & Logs',
    path: '/private/var/folders',
    description: 'Temporary system cache files — macOS clears these automatically',
    safeToDelete: false,
  },
  {
    name: 'System Logs',
    path: '/private/var/log',
    description: 'macOS system and crash logs',
    safeToDelete: false,
  },
  {
    name: 'Virtual Memory / Swap',
    path: '/private/var/vm',
    description: 'Swap files used when RAM is full — do not delete',
    safeToDelete: false,
  },
  {
    name: 'Core Dumps',
    path: '/cores',
    description: 'App crash dump files — safe to delete if present',
    safeToDelete: true,
  },
  {
    name: 'Time Machine Local Snapshots',
    path: '/.MobileBackups',
    description: 'Local Time Machine snapshots — macOS manages these automatically',
    safeToDelete: false,
  },
]

export async function getSystemDataBreakdown(): Promise<SystemDataEntry[]> {
  const results = await Promise.all(
    SYSTEM_DIRS
      .filter(d => fs.existsSync(d.path))
      .map(async d => ({
        ...d,
        size: await getDirSizeAsync(d.path).catch(() => 0),
      }))
  )

  return results
    .filter(d => d.size > 1024 * 1024) // only > 1 MB
    .sort((a, b) => b.size - a.size)
}
