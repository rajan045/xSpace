import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getDiskInfo: (force?: boolean) => ipcRenderer.invoke('get-disk-info', force),
  getLargeFiles: (minSizeMB?: number, force?: boolean) => ipcRenderer.invoke('get-large-files', minSizeMB, force),
  getCacheInfo: (force?: boolean) => ipcRenderer.invoke('get-cache-info', force),
  getDuplicates: (force?: boolean) => ipcRenderer.invoke('get-duplicates', force),
  getTrashInfo: () => ipcRenderer.invoke('get-trash-info'),
  emptyTrash: () => ipcRenderer.invoke('empty-trash'),
  getIOSData: (force?: boolean) => ipcRenderer.invoke('get-ios-data', force),
  moveToTrash: (paths: string[]) => ipcRenderer.invoke('move-to-trash', paths),
  deletePermanently: (paths: string[]) => ipcRenderer.invoke('delete-permanently', paths),
  smartScan: (force?: boolean) => ipcRenderer.invoke('smart-scan', force),
  smartClean: (paths: string[]) => ipcRenderer.invoke('smart-clean', paths),
  listDirContents: (path: string) => ipcRenderer.invoke('list-dir-contents', path),
  getSystemData: () => ipcRenderer.invoke('get-system-data'),
  getRunningOverview: () => ipcRenderer.invoke('get-running-overview'),
  quitUserProcess: (pid: number) => ipcRenderer.invoke('quit-user-process', pid),
  unloadUserLaunchAgent: (plistPath: string) =>
    ipcRenderer.invoke('unload-user-launch-agent', plistPath),
  authStartLogin: () => ipcRenderer.invoke('auth:start-login'),
  authStatus: () => ipcRenderer.invoke('auth:status'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  startCheckout: (currency?: 'INR' | 'USD') => ipcRenderer.invoke('checkout:start', currency),
  getInstalledApps: () => ipcRenderer.invoke('get-installed-apps'),
  findAppLeftovers: (appPath: string, bundleId: string, appName: string) =>
    ipcRenderer.invoke('find-app-leftovers', appPath, bundleId, appName),
  showInFinder: (path: string) => ipcRenderer.invoke('show-in-finder', path),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
})
