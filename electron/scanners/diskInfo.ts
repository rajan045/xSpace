import os from 'os'
import { run, getDirBreakdown, getDirSizesAsync } from './utils'

export interface DiskInfo {
  total: number
  used: number
  free: number
  usedPercent: number
  freePercent: number
  categories: DiskCategory[]
}

export interface DiskCategory {
  name: string
  size: number
  color: string
  /** Folder path to drill into — undefined means not browsable */
  path?: string
}

function parseBytes(output: string, key: string): number {
  const regex = new RegExp(`${key}:\\s+[\\d.]+ [A-Z]+ \\((\\d+) Bytes\\)`, 'i')
  const match = output.match(regex)
  return match ? parseInt(match[1], 10) : 0
}

async function getTotalAndFree(): Promise<{ total: number; used: number; free: number }> {
  const diskutil = await run('diskutil info / 2>/dev/null', 10000)

  // APFS: Container Total Space = physical disk, Container Free = unallocated
  const totalMatch = diskutil.match(/Container Total Space:\s+[\d.]+ [A-Z]+ \((\d+) Bytes\)/i)
  const freeMatch  = diskutil.match(/Container Free Space:\s+[\d.]+ [A-Z]+ \((\d+) Bytes\)/i)

  if (totalMatch && freeMatch) {
    const total = parseInt(totalMatch[1], 10)
    const free  = parseInt(freeMatch[1],  10)
    return { total, free, used: total - free }
  }

  // Fallback: Volume Used + Free
  const volUsed = parseBytes(diskutil, 'Volume Used Space')
  const volFree = parseBytes(diskutil, 'Volume Free Space')
  if (volUsed > 0 || volFree > 0) {
    return { total: volUsed + volFree, used: volUsed, free: volFree }
  }

  // Last resort: df -k
  const dfOut = await run("df -k / | tail -1", 5000)
  const parts = dfOut.split(/\s+/)
  const total = parseInt(parts[1], 10) * 1024
  const used  = parseInt(parts[2], 10) * 1024
  const free  = parseInt(parts[3], 10) * 1024
  return { total, used, free }
}

export async function getDiskInfo(): Promise<DiskInfo> {
  const home = os.homedir()
  const { total, used, free } = await getTotalAndFree()

  // ~/Library and ~/Pictures are the expensive trees and several categories live
  // inside them. One breakdown each gives the parent AND every child, so Library
  // is walked once instead of four times and the Photos library once instead of twice.
  // Every large tree gets the fan-out treatment — a single `du` on ~/Desktop alone
  // measured 20.6s vs 11.8s split across its children.
  const [lib, pics, desktop_, docs_, downloads_, appSizes] = await Promise.all([
    getDirBreakdown(`${home}/Library`),
    getDirBreakdown(`${home}/Pictures`),
    getDirBreakdown(`${home}/Desktop`),
    getDirBreakdown(`${home}/Documents`),
    getDirBreakdown(`${home}/Downloads`),
    getDirSizesAsync(['/Applications', `${home}/Applications`]),
  ])

  const [appSize, userAppSize] = appSizes
  const docSize       = docs_.total
  const downloadsSize = downloads_.total
  const desktopSize   = desktop_.total
  const picturesSize  = pics.total
  const photosLibSize = pics.children.get(`${home}/Pictures/Photos Library.photoslibrary`) ?? 0

  const rawLibSize = lib.total
  const devSize    = lib.children.get(`${home}/Library/Developer`) ?? 0
  const mailSize   = lib.children.get(`${home}/Library/Mail`) ?? 0
  const iCloudSize = lib.children.get(`${home}/Library/Mobile Documents`) ?? 0
  const libDevSize = devSize

  const applications = appSize + userAppSize
  const developer    = devSize
  const documents    = docSize
  const downloads    = downloadsSize
  const desktop      = desktopSize
  const photos       = photosLibSize > 0 ? photosLibSize : picturesSize
  const iCloud       = iCloudSize
  const mail         = mailSize
  // Library minus sub-dirs already counted
  const library      = Math.max(0, rawLibSize - libDevSize - mailSize - iCloudSize)

  const knownTotal = applications + developer + documents + downloads + desktop + photos + iCloud + mail + library
  const systemData = Math.max(0, used - knownTotal)

  const categories: DiskCategory[] = [
    { name: 'System & Other',    size: systemData,   color: 'rgb(var(--fg) / 0.22)', path: '__system__' },
    { name: 'Applications',      size: applications, color: 'rgb(var(--fg) / 0.92)', path: '/Applications' },
    { name: 'Library & Caches',  size: library,      color: 'rgb(var(--fg) / 0.74)', path: `${home}/Library` },
    { name: 'Developer',         size: developer,    color: 'rgb(var(--fg) / 0.58)', path: `${home}/Library/Developer` },
    { name: 'Documents',         size: documents,    color: 'rgb(var(--fg) / 0.44)', path: `${home}/Documents` },
    { name: 'Downloads',         size: downloads,    color: 'rgb(var(--fg) / 0.32)', path: `${home}/Downloads` },
    { name: 'Photos',            size: photos,       color: 'rgb(var(--fg) / 0.5)', path: `${home}/Pictures` },
    { name: 'iCloud Drive',      size: iCloud,       color: 'rgb(var(--fg) / 0.38)', path: `${home}/Library/Mobile Documents` },
    { name: 'Mail',              size: mail,         color: 'rgb(var(--fg) / 0.26)', path: `${home}/Library/Mail` },
    { name: 'Desktop',           size: desktop,      color: 'rgb(var(--fg) / 0.66)', path: `${home}/Desktop` },
  ].filter(c => c.size > 1024 * 1024)

  return {
    total,
    used,
    free,
    usedPercent: total > 0 ? Math.round((used / total) * 100) : 0,
    freePercent: total > 0 ? Math.round((free / total) * 100) : 0,
    categories,
  }
}
