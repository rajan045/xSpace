import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import path from 'path'
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

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e',
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

ipcMain.handle('show-in-finder', async (_e, filePath: string) => {
  shell.showItemInFolder(filePath)
  return true
})

ipcMain.handle('open-path', async (_e, filePath: string) => {
  await shell.openPath(filePath)
  return true
})
