import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { run } from './utils'

const execAsync = promisify(exec)

/** Comms we never offer to quit (system / session critical). */
const BLOCKED_COMMS = new Set(
  [
    'kernel_task',
    'windowserver',
    'loginwindow',
    'launchd',
    'mds',
    'mds_stores',
    'mds_sync',
    'sysmond',
    'opendirectoryd',
    'powerd',
    'bluetoothd',
    'coreaudiod',
    'hidd',
    'locationd',
    'trustd',
    'usbd',
    'thermalmonitord',
    'watchdogd',
    'remoted',
    'logind',
    'cfprefsd',
    'runningboardd',
    'symptomsd',
    'audioclocksyncd',
    'airportd',
    'configd',
    'diskarbitrationd',
    'securityd',
  ].map(s => s.toLowerCase()),
)

const MAX_PROCESSES = 45

export type RunningProcessRow = {
  pid: number
  ppid: number
  cpuPercent: number
  memoryMB: number
  comm: string
  canQuit: boolean
}

export type UserLaunchAgentRow = {
  plistPath: string
  label: string
  fileName: string
  /** PID from launchctl list if loaded, else null */
  loadedPid: number | null
  canUnload: boolean
}

export type RunningOverviewResult = {
  /** User-visible apps: safe to quit from xSpace (sorted by CPU). */
  processes: RunningProcessRow[]
  /** System / protected processes: informational only; never quit from xSpace. */
  protectedProcesses: RunningProcessRow[]
  launchAgents: UserLaunchAgentRow[]
  platformNote?: string
}

type RowInternal = Omit<RunningProcessRow, 'memoryMB'> & { memoryMb: number }

function normalizeComm(comm: string): string {
  return path.basename(comm.trim()).toLowerCase()
}

function isPidBlocked(pid: number, commNorm: string): boolean {
  if (pid <= 1) return true
  if (pid === process.pid) return true
  if (BLOCKED_COMMS.has(commNorm)) return true
  return false
}

/**
 * Parse `ps -axo pid,ppid,pcpu,rss,comm` lines. RSS on macOS is KB.
 */
function parsePsLine(line: string): RowInternal | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const parts = trimmed.split(/\s+/)
  if (parts.length < 5) return null
  const pid = parseInt(parts[0], 10)
  const ppid = parseInt(parts[1], 10)
  const pcpu = parseFloat(parts[2])
  const rssKb = parseInt(parts[3], 10)
  const comm = parts.slice(4).join(' ')
  if (Number.isNaN(pid) || Number.isNaN(ppid) || pid <= 0) return null
  const commNorm = normalizeComm(comm)
  const canQuit = !isPidBlocked(pid, commNorm)
  const memMb = Number.isFinite(rssKb) ? rssKb / 1024 : 0
  return {
    pid,
    ppid,
    cpuPercent: Number.isFinite(pcpu) ? pcpu : 0,
    memoryMb: memMb,
    comm: comm || commNorm,
    canQuit,
  }
}

function rowToPublic(r: RowInternal): RunningProcessRow {
  return {
    pid: r.pid,
    ppid: r.ppid,
    cpuPercent: r.cpuPercent,
    memoryMB: r.memoryMb,
    comm: r.comm,
    canQuit: r.canQuit,
  }
}

async function getProcessesDarwin(): Promise<{
  processes: RunningProcessRow[]
  protectedProcesses: RunningProcessRow[]
}> {
  const out = await run(
    'ps -axo pid,ppid,pcpu,rss,comm',
    20000,
  )
  if (!out) return { processes: [], protectedProcesses: [] }

  const lines = out.split('\n').filter(Boolean)
  // Skip header if present (first line might be "PID PPID ...")
  const dataLines = lines[0]?.toUpperCase().includes('PID') ? lines.slice(1) : lines

  const rows: RowInternal[] = []
  for (const line of dataLines) {
    const parsed = parsePsLine(line)
    if (!parsed) continue
    rows.push(parsed)
  }

  const safe = rows.filter(r => r.canQuit)
  safe.sort((a, b) => b.cpuPercent - a.cpuPercent || b.memoryMb - a.memoryMb)

  const blocked = rows.filter(r => !r.canQuit)
  blocked.sort((a, b) => b.cpuPercent - a.cpuPercent || b.memoryMb - a.memoryMb)

  return {
    processes: safe.slice(0, MAX_PROCESSES).map(r => rowToPublic(r)),
    protectedProcesses: blocked.slice(0, MAX_PROCESSES).map(r => rowToPublic(r)),
  }
}

async function readPlistLabel(plistPath: string): Promise<string | null> {
  const escaped = plistPath.replace(/"/g, '\\"')
  const label = await run(`defaults read "${escaped}" Label 2>/dev/null`, 5000)
  return label ? label.trim() : null
}

/**
 * Build a map label -> first column PID (or null if not running)
 */
async function launchctlLabelToPid(): Promise<Map<string, number | null>> {
  const out = await run('launchctl list 2>/dev/null', 20000)
  const map = new Map<string, number | null>()
  if (!out) return map

  for (const line of out.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('PID')) continue
    const parts = t.split(/\s+/)
    if (parts.length < 3) continue
    const pidStr = parts[0]
    const label = parts.slice(2).join(' ')
    if (!label) continue
    if (pidStr === '-') {
      map.set(label, null)
    } else {
      const pid = parseInt(pidStr, 10)
      map.set(label, Number.isFinite(pid) ? pid : null)
    }
  }
  return map
}

function resolveLaunchAgentsDir(): string {
  return path.join(os.homedir(), 'Library/LaunchAgents')
}

function isPathInsideLaunchAgents(filePath: string): boolean {
  const base = resolveLaunchAgentsDir()
  const realBase = fs.existsSync(base) ? fs.realpathSync(base) : base
  let realFile: string
  try {
    realFile = fs.realpathSync(filePath)
  } catch {
    return false
  }
  const rel = path.relative(realBase, realFile)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

async function getUserLaunchAgentsDarwin(): Promise<UserLaunchAgentRow[]> {
  const dir = resolveLaunchAgentsDir()
  if (!fs.existsSync(dir)) return []

  let files: string[]
  try {
    files = fs.readdirSync(dir).filter(f => f.endsWith('.plist'))
  } catch {
    return []
  }

  const labelPid = await launchctlLabelToPid()
  const rows: UserLaunchAgentRow[] = []

  for (const f of files) {
    const plistPath = path.join(dir, f)
    const label = (await readPlistLabel(plistPath)) || f.replace(/\.plist$/i, '')
    let loadedPid: number | null = null
    if (labelPid.has(label)) {
      const v = labelPid.get(label)
      loadedPid = v === undefined ? null : v
    }
    rows.push({
      plistPath,
      label,
      fileName: f,
      loadedPid,
      canUnload: true,
    })
  }

  rows.sort((a, b) => a.label.localeCompare(b.label))
  return rows
}

export async function getRunningOverview(): Promise<RunningOverviewResult> {
  if (process.platform !== 'darwin') {
    return {
      processes: [],
      protectedProcesses: [],
      launchAgents: [],
      platformNote: 'Running & startup is only available on macOS.',
    }
  }

  const [{ processes, protectedProcesses }, launchAgents] = await Promise.all([
    getProcessesDarwin(),
    getUserLaunchAgentsDarwin(),
  ])

  return { processes, protectedProcesses, launchAgents }
}

async function getCommForPid(pid: number): Promise<string | null> {
  const out = await run(`ps -p ${pid} -o comm= 2>/dev/null`, 3000)
  return out ? normalizeComm(out) : null
}

export async function quitUserProcess(pid: number): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: 'Only available on macOS.' }
  }
  const n = Math.floor(pid)
  if (!Number.isFinite(n) || n <= 1) {
    return { ok: false, error: 'Invalid process.' }
  }
  if (n === process.pid) {
    return { ok: false, error: 'Cannot quit the xSpace process from here.' }
  }

  const comm = await getCommForPid(n)
  if (!comm) {
    return { ok: false, error: 'Process not found or already exited.' }
  }
  if (isPidBlocked(n, comm)) {
    return { ok: false, error: 'This process is protected and cannot be stopped from xSpace.' }
  }

  try {
    await execAsync(`kill -15 ${n}`)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg || 'Failed to send quit signal.' }
  }
}

export async function unloadUserLaunchAgent(
  plistPath: string,
): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: 'Only available on macOS.' }
  }
  const normalized = path.normalize(plistPath)
  if (!normalized.endsWith('.plist') || !fs.existsSync(normalized)) {
    return { ok: false, error: 'Invalid plist path.' }
  }
  if (!isPathInsideLaunchAgents(normalized)) {
    return { ok: false, error: 'Only user LaunchAgents in ~/Library/LaunchAgents can be unloaded.' }
  }

  const uid = os.userInfo().uid
  const guiTarget = `gui/${uid}`
  const escaped = normalized.replace(/"/g, '\\"')

  try {
    await execAsync(`launchctl bootout ${guiTarget} "${escaped}"`, {
      timeout: 15000,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg || 'bootout failed. The service may not be loaded.' }
  }
}
