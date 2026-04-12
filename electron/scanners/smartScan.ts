import os from 'os'
import fs from 'fs'
import path from 'path'
import { getDirSizeAsync, run } from './utils'
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
  const results: SafeItem[] = []

  for (const profile of profileNames) {
    for (const sub of ALLOWED_SUBFOLDERS) {
      const fullPath = path.join(chromeBase, profile, sub)
      if (!fs.existsSync(fullPath)) continue
      const size = await getDirSizeAsync(fullPath)
      if (size < 1024 * 1024) continue
      results.push({
        id: `chrome-cache-${safeIdPart(profile)}-${safeIdPart(sub)}`,
        label: `Chrome Cache (${profile})`,
        reason: `Cache files only (${sub}) — does not remove history, cookies, saved logins, or extensions`,
        path: fullPath,
        size,
        category: 'cache',
      })
    }
  }

  return results
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
  const items = await Promise.all(
    SAFE_CACHE_ITEMS.map(async item => {
      const fullPath = path.join(HOME, item.rel)
      if (!fs.existsSync(fullPath)) return null
      const size = await getDirSizeAsync(fullPath)
      if (size < 1024 * 1024) return null // skip anything < 1 MB
      const result: SafeItem = { id: item.id, label: item.label, reason: item.reason, path: fullPath, size, category: 'cache' }
      return result
    })
  )

  const base = items.filter((i): i is SafeItem => i !== null)
  const [chrome, safari] = await Promise.all([scanChromeCacheOnly(), scanSafariCacheOnly()])
  return [...base, ...chrome, ...safari]
}

async function scanBuildArtifacts(): Promise<SafeItem[]> {
  const items = await Promise.all(
    SAFE_BUILD_ITEMS.map(async item => {
      const fullPath = path.join(HOME, item.rel)
      if (!fs.existsSync(fullPath)) return null
      const size = await getDirSizeAsync(fullPath)
      if (size < 1024 * 1024) return null
      const result: SafeItem = { id: item.id, label: item.label, reason: item.reason, path: fullPath, size, category: 'build' }
      return result
    })
  )
  return items.filter((i): i is SafeItem => i !== null)
}

async function scanSimulators(): Promise<SafeItem[]> {
  const simulatorsBase = path.join(HOME, 'Library/Developer/CoreSimulator/Devices')
  if (!fs.existsSync(simulatorsBase)) return []

  try {
    const rawJson = await run('xcrun simctl list devices --json 2>/dev/null', 15000)
    if (!rawJson) return []

    const data = JSON.parse(rawJson)
    const results: SafeItem[] = []

    for (const [runtime, deviceList] of Object.entries(data.devices as Record<string, any[]>)) {
      for (const device of deviceList) {
        if (device.state === 'Booted') continue // never delete a running simulator
        const devicePath = path.join(simulatorsBase, device.udid)
        if (!fs.existsSync(devicePath)) continue
        const size = await getDirSizeAsync(devicePath)
        if (size < 1024 * 1024) continue
        const runtimeLabel = runtime
          .replace('com.apple.CoreSimulator.SimRuntime.', '')
          .replace(/-/g, ' ')
        results.push({
          id: `sim-${device.udid}`,
          label: `${device.name} (${runtimeLabel})`,
          reason: 'Simulator not running — reinstallable from Xcode',
          path: devicePath,
          size,
          category: 'simulator',
        })
      }
    }
    return results
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
