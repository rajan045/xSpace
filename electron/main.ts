import { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } from 'electron'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

/** Load `.env` from the first path that exists (compiled `dist-electron/electron` vs `cwd`). */
function loadEnvFile(): void {
  const candidates = [
    path.join(__dirname, '../../.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p })
      return
    }
  }
  dotenv.config()
}

loadEnvFile()

// Default API URL for local runs when `.env` is missing or not loaded (non-packaged app only).
if (!process.env.XSPACE_API_URL?.trim() && !app.isPackaged) {
  process.env.XSPACE_API_URL = 'http://localhost:4000'
}

import os from 'os'
import { getDiskInfo } from './scanners/diskInfo'
import { getLargeFiles } from './scanners/largeFiles'
import { getCacheInfo } from './scanners/caches'
import { getDuplicates } from './scanners/duplicates'
import { getTrashInfo, emptyTrash } from './scanners/trash'
import { getIOSData } from './scanners/iosData'
import { deleteItems, moveToTrash } from './scanners/fileOps'
import { listDirContents } from './scanners/listDir'
import { runSmartScan } from './scanners/smartScan'
import { getSystemDataBreakdown } from './scanners/systemData'
import {
  getRunningOverview,
  quitUserProcess,
  unloadUserLaunchAgent,
} from './scanners/runningOverview'
import { getInstalledApps, findAppLeftovers } from './scanners/appUninstaller'
import { startBrowserLogin, getStatus as getAuthStatus, logout as authLogout } from './auth'
import { postAppLaunchEventFireAndForget } from './subscriptionTracking'

const isDev = process.env.NODE_ENV === 'development'

function windowIcon(): Electron.NativeImage | undefined {
  const iconPath = path.join(__dirname, '../../build/icon.png')
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath)
  }
  return undefined
}

function createWindow() {
  const icon = windowIcon()
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  win.once('ready-to-show', () => win.show())
}

app.whenReady().then(() => {
  createWindow()
  postAppLaunchEventFireAndForget()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('get-disk-info', async () => {
  return getDiskInfo()
})

ipcMain.handle('get-large-files', async (_e, minSizeMB: number = 50) => {
  return getLargeFiles(minSizeMB)
})

ipcMain.handle('get-cache-info', async () => {
  return getCacheInfo()
})

ipcMain.handle('get-duplicates', async () => {
  return getDuplicates()
})

ipcMain.handle('get-trash-info', async () => {
  return getTrashInfo()
})

ipcMain.handle('empty-trash', async () => {
  return emptyTrash()
})

ipcMain.handle('get-ios-data', async () => {
  return getIOSData()
})

ipcMain.handle('move-to-trash', async (_e, paths: string[]) => {
  return moveToTrash(paths)
})

ipcMain.handle('delete-permanently', async (_e, paths: string[]) => {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancel', 'Delete Permanently'],
    defaultId: 0,
    cancelId: 0,
    title: 'Permanent Delete',
    message: `Permanently delete ${paths.length} item${paths.length > 1 ? 's' : ''}?`,
    detail: 'This cannot be undone. Files will NOT be moved to Trash.',
  })
  if (response === 1) {
    return deleteItems(paths)
  }
  return { success: false, cancelled: true, errors: [] as string[], freedBytes: 0, deletedPaths: [] as string[] }
})

ipcMain.handle('smart-scan', async () => {
  return runSmartScan()
})

ipcMain.handle('smart-clean', async (_e, paths: string[]) => {
  const trashCanonical = path.join(os.homedir(), '.Trash')
  const norm = (p: string) => path.normalize(p)
  const trashPaths = paths.filter(p => norm(p) === norm(trashCanonical))
  const otherPaths = paths.filter(p => norm(p) !== norm(trashCanonical))

  let freedBytes = 0
  const errors: string[] = []
  const deletedPaths: string[] = []

  if (otherPaths.length > 0) {
    const res = await deleteItems(otherPaths)
    freedBytes += res.freedBytes
    errors.push(...res.errors)
    deletedPaths.push(...res.deletedPaths)
  }

  if (trashPaths.length > 0) {
    const res = await emptyTrash()
    if (res.success) {
      freedBytes += res.freedBytes
      deletedPaths.push(...trashPaths)
    } else {
      errors.push('Could not empty Trash via Finder')
    }
  }

  return { success: errors.length === 0, freedBytes, errors, deletedPaths }
})

ipcMain.handle('list-dir-contents', async (_e, dirPath: string) => {
  return listDirContents(dirPath)
})

ipcMain.handle('get-system-data', async () => {
  return getSystemDataBreakdown()
})

ipcMain.handle('get-running-overview', async () => {
  return getRunningOverview()
})

ipcMain.handle('quit-user-process', async (_e, pid: number) => {
  return quitUserProcess(pid)
})

ipcMain.handle('unload-user-launch-agent', async (_e, plistPath: string) => {
  return unloadUserLaunchAgent(plistPath)
})

ipcMain.handle('auth:start-login', async () => {
  try {
    return await startBrowserLogin()
  } catch (e) {
    return { signedIn: false, error: e instanceof Error ? e.message : 'Sign-in failed' }
  }
})

ipcMain.handle('auth:status', async () => {
  return getAuthStatus()
})

ipcMain.handle('auth:logout', async () => {
  return authLogout()
})

ipcMain.handle('get-installed-apps', async () => {
  return getInstalledApps()
})

ipcMain.handle('find-app-leftovers', async (_e, appPath: string, bundleId: string, appName: string) => {
  return findAppLeftovers(appPath, bundleId, appName)
})

ipcMain.handle('show-in-finder', async (_e, filePath: string) => {
  shell.showItemInFolder(filePath)
  return true
})

ipcMain.handle('open-path', async (_e, filePath: string) => {
  await shell.openPath(filePath)
  return true
})

ipcMain.handle('open-external', (_e, url: string) => {
  shell.openExternal(url)
  return true
})
