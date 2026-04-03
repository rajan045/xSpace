import os from 'os'
import fs from 'fs'
import path from 'path'
import { getDirSizeAsync, run } from './utils'

export interface IOSDataInfo {
  simulators: SimulatorDevice[]
  derivedData: DerivedDataEntry[]
  totalSimulatorSize: number
  totalDerivedDataSize: number
  xcodeArchivesSize: number
  iosDeviceBackupsSize: number
}

export interface SimulatorDevice {
  udid: string
  name: string
  runtime: string
  state: string
  size: number
  path: string
}

export interface DerivedDataEntry {
  name: string
  path: string
  size: number
  modified: string
}

async function getSimulators(): Promise<SimulatorDevice[]> {
  const simulatorsBase = path.join(os.homedir(), 'Library/Developer/CoreSimulator/Devices')
  if (!fs.existsSync(simulatorsBase)) return []

  try {
    const rawJson = await run('xcrun simctl list devices --json 2>/dev/null', 15000)
    if (!rawJson) return []
    const data = JSON.parse(rawJson)
    const devices: SimulatorDevice[] = []

    for (const [runtime, deviceList] of Object.entries(data.devices as Record<string, any[]>)) {
      for (const device of deviceList) {
        const devicePath = path.join(simulatorsBase, device.udid)
        if (!fs.existsSync(devicePath)) continue
        devices.push({
          udid: device.udid,
          name: device.name,
          runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', '').replace(/-/g, ' '),
          state: device.state,
          size: 0, // filled below
          path: devicePath,
        })
      }
    }

    // Get sizes in parallel
    const withSizes = await Promise.all(
      devices.map(async d => ({ ...d, size: await getDirSizeAsync(d.path) }))
    )
    return withSizes.filter(d => d.size > 0).sort((a, b) => b.size - a.size)
  } catch {
    return []
  }
}

async function getDerivedData(): Promise<DerivedDataEntry[]> {
  const base = path.join(os.homedir(), 'Library/Developer/Xcode/DerivedData')
  if (!fs.existsSync(base)) return []

  try {
    const entries = fs.readdirSync(base, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))

    return (await Promise.all(
      entries.map(async entry => {
        const fullPath = path.join(base, entry.name)
        try {
          const stat = fs.statSync(fullPath)
          const size = await getDirSizeAsync(fullPath)
          return {
            name: entry.name.replace(/-[a-z0-9]+$/i, ''),
            path: fullPath,
            size,
            modified: stat.mtime.toISOString(),
          }
        } catch {
          return null
        }
      })
    )).filter((e): e is DerivedDataEntry => e !== null && e.size > 0)
     .sort((a, b) => b.size - a.size)
  } catch {
    return []
  }
}

export async function getIOSData(): Promise<IOSDataInfo> {
  const home = os.homedir()
  const xcodeArchivesPath = `${home}/Library/Developer/Xcode/Archives`
  const iosBackupsPath    = `${home}/Library/Application Support/MobileSync/Backup`

  const [simulators, derivedData, xcodeArchivesSize, iosDeviceBackupsSize] = await Promise.all([
    getSimulators(),
    getDerivedData(),
    getDirSizeAsync(xcodeArchivesPath),
    getDirSizeAsync(iosBackupsPath),
  ])

  return {
    simulators,
    derivedData,
    totalSimulatorSize:    simulators.reduce((s, d) => s + d.size, 0),
    totalDerivedDataSize:  derivedData.reduce((s, d) => s + d.size, 0),
    xcodeArchivesSize,
    iosDeviceBackupsSize,
  }
}
