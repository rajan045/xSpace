import os from 'os'
import fs from 'fs'
import path from 'path'
import { getDirSizeAsync, getDirSizesAsync, run } from './utils'
import { scanNodeModules } from './nodeModulesScan'

export interface SafeItem {
  id: string
  label: string
  reason: string
  path: string
  size: number
  category: 'cache' | 'build' | 'simulator' | 'trash' | 'nodemodules'
}

export interface SmartScanResult {
  items: SafeItem[]
  totalSize: number
}

// Callback so the UI can show live progress during scan
export type ProgressCallback = (label: string) => void

const HOME = os.homedir()

// ── Safe cache paths ──────────────────────────────────────────────────────────

const SAFE_CACHE_ITEMS: Array<{ id: string; label: string; reason: string; rel: string }> = [
  {
    id: 'npm-cache',
    label: 'npm Cache',
    reason: 'Recreated automatically by npm on next install',
    rel: '.npm',
  },
  {
    id: 'yarn-cache',
    label: 'Yarn Cache',
    reason: 'Recreated automatically by Yarn on next install',
    rel: '.yarn/cache',
  },
  {
    id: 'pnpm-cache',
    label: 'pnpm Store',
    reason: 'Recreated automatically by pnpm on next install',
    rel: 'Library/pnpm/store',
  },
  {
    id: 'pip-cache',
    label: 'pip Cache',
    reason: 'Recreated automatically by pip on next install',
    rel: 'Library/Caches/pip',
  },
  {
    id: 'brew-cache',
    label: 'Homebrew Cache',
    reason: 'Old download archives — Homebrew re-downloads if needed',
    rel: 'Library/Caches/Homebrew',
  },
  {
    id: 'cursor-cache',
    label: 'Cursor Cache',
    reason: 'IDE cache — Cursor rebuilds it on next launch',
    rel: 'Library/Caches/Cursor',
  },
  {
    id: 'vscode-cache',
    label: 'VS Code Cache',
    reason: 'IDE cache — VS Code rebuilds it on next launch',
    rel: 'Library/Caches/com.microsoft.VSCode',
  },
  {
    id: 'gradle-cache',
    label: 'Gradle Cache',
    reason: 'Build cache — Gradle re-downloads on next build',
    rel: '.gradle/caches',
  },
  {
    id: 'cocoapods-cache',
    label: 'CocoaPods Cache',
    reason: 'iOS dependency cache — re-downloaded on pod install',
    rel: 'Library/Caches/CocoaPods',
  },
]

function safeIdPart(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function scanSafariCacheOnly(): Promise<SafeItem[]> {
  const safariBase = path.join(HOME, 'Library/Caches/com.apple.Safari')
  if (!fs.existsSync(safariBase)) return []
  const size = await getDirSizeAsync(safariBase)
  if (size < 1024 * 1024) return []
  return [
    {
      id: 'safari-cache',
      label: 'Safari Cache',
      reason: 'Cache files only — does not remove history, cookies, saved logins, or bookmarks',
      path: safariBase,
      size,
      category: 'cache',
    },
  ]
}

async function scanChromeCacheOnly(): Promise<SafeItem[]> {
  // IMPORTANT: We only allowlist known cache subfolders. We never touch profile data,
  // cookies, history, extensions, saved passwords, etc.
  const chromeBase = path.join(HOME, 'Library/Caches/Google/Chrome')
  if (!fs.existsSync(chromeBase)) return []

  const profileNames: string[] = []
  try {
    const entries = fs.readdirSync(chromeBase, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      if (e.name === 'Default' || /^Profile \\d+$/.test(e.name)) profileNames.push(e.name)
    }
  } catch {
    // If we can't read profiles, fall back to scanning known default paths only.
    profileNames.push('Default')
  }

  const ALLOWED_SUBFOLDERS = ['Cache', 'Code Cache', 'GPUCache'] as const

  const targets = profileNames.flatMap(profile =>
    ALLOWED_SUBFOLDERS.map(sub => ({ profile, sub, fullPath: path.join(chromeBase, profile, sub) }))
  ).filter(t => fs.existsSync(t.fullPath))

  const sizes = await getDirSizesAsync(targets.map(t => t.fullPath))

  return targets.flatMap((t, i) => {
    const size = sizes[i]
    if (size < 1024 * 1024) return []
    return [{
      id: `chrome-cache-${safeIdPart(t.profile)}-${safeIdPart(t.sub)}`,
      label: `Chrome Cache (${t.profile})`,
      reason: `Cache files only (${t.sub}) — does not remove history, cookies, saved logins, or extensions`,
      path: t.fullPath,
      size,
      category: 'cache' as const,
    }]
  })
}

// ── Build artifact paths ──────────────────────────────────────────────────────

const SAFE_BUILD_ITEMS: Array<{ id: string; label: string; reason: string; rel: string }> = [
  {
    id: 'xcode-derived',
    label: 'Xcode Derived Data',
    reason: 'Build artifacts — Xcode rebuilds automatically on next build',
    rel: 'Library/Developer/Xcode/DerivedData',
  },
]

// ── Scanner helpers ───────────────────────────────────────────────────────────

async function scanCaches(): Promise<SafeItem[]> {
  const present = SAFE_CACHE_ITEMS
    .map(item => ({ ...item, fullPath: path.join(HOME, item.rel) }))
    .filter(item => fs.existsSync(item.fullPath))

  const sizes = await getDirSizesAsync(present.map(i => i.fullPath))
  const base: SafeItem[] = present.flatMap((item, i) => {
    const size = sizes[i]
    if (size < 1024 * 1024) return [] // skip anything < 1 MB
    return [{ id: item.id, label: item.label, reason: item.reason, path: item.fullPath, size, category: 'cache' as const }]
  })
  const [chrome, safari] = await Promise.all([scanChromeCacheOnly(), scanSafariCacheOnly()])
  return [...base, ...chrome, ...safari]
}

async function scanBuildArtifacts(): Promise<SafeItem[]> {
  const present = SAFE_BUILD_ITEMS
    .map(item => ({ ...item, fullPath: path.join(HOME, item.rel) }))
    .filter(item => fs.existsSync(item.fullPath))

  const sizes = await getDirSizesAsync(present.map(i => i.fullPath))
  return present.flatMap((item, i) => {
    const size = sizes[i]
    if (size < 1024 * 1024) return []
    return [{ id: item.id, label: item.label, reason: item.reason, path: item.fullPath, size, category: 'build' as const }]
  })
}

async function scanSimulators(): Promise<SafeItem[]> {
  const simulatorsBase = path.join(HOME, 'Library/Developer/CoreSimulator/Devices')
  if (!fs.existsSync(simulatorsBase)) return []

  try {
    const rawJson = await run('xcrun simctl list devices --json 2>/dev/null', 15000)
    if (!rawJson) return []

    const data = JSON.parse(rawJson)

    const devices = Object.entries(data.devices as Record<string, any[]>)
      .flatMap(([runtime, deviceList]) => deviceList
        .filter(device => device.state !== 'Booted') // never delete a running simulator
        .map(device => ({
          device,
          devicePath: path.join(simulatorsBase, device.udid),
          runtimeLabel: runtime
            .replace('com.apple.CoreSimulator.SimRuntime.', '')
            .replace(/-/g, ' '),
        })))
      .filter(d => fs.existsSync(d.devicePath))

    const sizes = await getDirSizesAsync(devices.map(d => d.devicePath))

    return devices.flatMap((d, i) => {
      const size = sizes[i]
      if (size < 1024 * 1024) return []
      return [{
        id: `sim-${d.device.udid}`,
        label: `${d.device.name} (${d.runtimeLabel})`,
        reason: 'Simulator not running — reinstallable from Xcode',
        path: d.devicePath,
        size,
        category: 'simulator' as const,
      }]
    })
  } catch {
    return []
  }
}

async function scanTrash(): Promise<SafeItem[]> {
  const trashPath = path.join(HOME, '.Trash')
  if (!fs.existsSync(trashPath)) return []
  const size = await getDirSizeAsync(trashPath)
  if (size < 1024) return []
  return [{
    id: 'trash',
    label: 'Trash',
    reason: "You've already deleted these — just needs to be emptied",
    path: trashPath,
    size,
    category: 'trash',
  }]
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runSmartScan(): Promise<SmartScanResult> {
  const [caches, build, simulators, trash, nodeModules] = await Promise.all([
    scanCaches(),
    scanBuildArtifacts(),
    scanSimulators(),
    scanTrash(),
    scanNodeModules(),
  ])

  const items = [...caches, ...build, ...simulators, ...trash, ...nodeModules]
    .sort((a, b) => b.size - a.size)

  const totalSize = items.reduce((sum, i) => sum + i.size, 0)
  return { items, totalSize }
}
