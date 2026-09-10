import fs from 'fs'
import os from 'os'
import path from 'path'
import { getDirSizeAsync, run, shellQuote } from './utils'

export interface InstalledApp {
  name: string
  path: string
  bundleId: string
  size: number
  modified: string
  /** Where the .app lives — affects whether removal may need admin rights. */
  location: 'system-apps' | 'user-apps'
}

export interface LeftoverItem {
  path: string
  size: number
  /** Human label for the kind of support file. */
  category: string
}

const APP_DIRS: { dir: string; location: InstalledApp['location'] }[] = [
  { dir: '/Applications', location: 'system-apps' },
  { dir: path.join(os.homedir(), 'Applications'), location: 'user-apps' },
]

async function readBundleId(appPath: string): Promise<string> {
  const quotedApp = shellQuote(`${appPath}/Contents/Info`)
  const id = await run(`defaults read ${quotedApp} CFBundleIdentifier 2>/dev/null`, 5000)
  return id.trim()
}

/** List installed apps in /Applications and ~/Applications (top level + Utilities). */
export async function getInstalledApps(): Promise<InstalledApp[]> {
  const found: { path: string; location: InstalledApp['location'] }[] = []

  for (const { dir, location } of APP_DIRS) {
    if (!fs.existsSync(dir)) continue
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.name.endsWith('.app')) {
        found.push({ path: path.join(dir, e.name), location })
      } else if (e.name === 'Utilities' && e.isDirectory()) {
        try {
          for (const u of fs.readdirSync(path.join(dir, e.name))) {
            if (u.endsWith('.app')) found.push({ path: path.join(dir, e.name, u), location })
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (found.length === 0) return []

  // One batched `du` for every app — avoids spawning a process per app (which
  // floods the disk and makes the scan look frozen). Bundle id is read lazily
  // at uninstall time, not here.
  const sizeMap = await getSizes(found.map(f => f.path))

  const apps = found.map(({ path: appPath, location }) => {
    let modified = ''
    try {
      modified = fs.statSync(appPath).mtime.toISOString()
    } catch {
      /* ignore */
    }
    return {
      name: path.basename(appPath).replace(/\.app$/i, ''),
      path: appPath,
      bundleId: '',
      size: sizeMap.get(appPath) ?? 0,
      modified,
      location,
    } as InstalledApp
  })

  return apps.sort((a, b) => b.size - a.size)
}

/** Get sizes for many paths in a single `du` call. Returns bytes keyed by path. */
async function getSizes(paths: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (paths.length === 0) return map
  const quoted = paths.map(shellQuote).join(' ')
  const out = await run(`du -sk ${quoted} 2>/dev/null`, 90000)
  for (const line of out.split('\n')) {
    const m = line.match(/^(\d+)\s+(.*)$/)
    if (m) map.set(m[2], parseInt(m[1], 10) * 1024)
  }
  return map
}

/**
 * Find support/leftover files an app scatters across ~/Library.
 * Strict matching on bundle id (and exact app-name folders) to avoid touching
 * unrelated apps' data.
 */
export async function findAppLeftovers(
  appPath: string,
  bundleId: string,
  appName: string,
): Promise<LeftoverItem[]> {
  const L = path.join(os.homedir(), 'Library')
  // Bundle id is read here (lazily) when the list scan didn't carry it.
  const bid = (bundleId || (await readBundleId(appPath))).trim()
  const name = appName.trim()

  // Exact-path candidates keyed by bundle id.
  const byId: [string, string][] = bid
    ? [
        [path.join(L, 'Containers', bid), 'Container'],
        [path.join(L, 'Preferences', `${bid}.plist`), 'Preferences'],
        [path.join(L, 'Saved Application State', `${bid}.savedState`), 'Saved State'],
        [path.join(L, 'Caches', bid), 'Cache'],
        [path.join(L, 'HTTPStorages', bid), 'Web Storage'],
        [path.join(L, 'WebKit', bid), 'WebKit Data'],
        [path.join(L, 'Application Support', bid), 'Application Support'],
        [path.join(L, 'Logs', bid), 'Logs'],
        [path.join(L, 'Cookies', `${bid}.binarycookies`), 'Cookies'],
      ]
    : []

  // Folders commonly named by the app's display name.
  const byName: [string, string][] = name
    ? [
        [path.join(L, 'Application Support', name), 'Application Support'],
        [path.join(L, 'Caches', name), 'Cache'],
        [path.join(L, 'Logs', name), 'Logs'],
      ]
    : []

  const candidates = new Map<string, string>()
  for (const [p, c] of [...byId, ...byName]) {
    if (!candidates.has(p)) candidates.set(p, c)
  }

  // Prefix/substring matches inside known dirs (LaunchAgents, Group Containers).
  if (bid) {
    addMatches(candidates, path.join(L, 'LaunchAgents'), 'Launch Agent', f => f.startsWith(bid) && f.endsWith('.plist'))
    addMatches(candidates, path.join(L, 'Group Containers'), 'Group Container', f => f.includes(bid))
  }

  const items = await Promise.all(
    [...candidates.entries()].map(async ([p, category]) => {
      if (!fs.existsSync(p)) return null
      const size = await sizeOf(p)
      return { path: p, size, category } as LeftoverItem
    }),
  )

  return items
    .filter((i): i is LeftoverItem => i !== null)
    .sort((a, b) => b.size - a.size)
}

function addMatches(
  out: Map<string, string>,
  dir: string,
  category: string,
  pred: (fileName: string) => boolean,
): void {
  if (!fs.existsSync(dir)) return
  try {
    for (const f of fs.readdirSync(dir)) {
      if (pred(f)) {
        const full = path.join(dir, f)
        if (!out.has(full)) out.set(full, category)
      }
    }
  } catch {
    /* ignore */
  }
}

async function sizeOf(p: string): Promise<number> {
  try {
    const stat = fs.statSync(p)
    return stat.isFile() ? stat.size : getDirSizeAsync(p)
  } catch {
    return 0
  }
}
