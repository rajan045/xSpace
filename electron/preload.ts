import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getDiskInfo: () => ipcRenderer.invoke('get-disk-info'),
  getLargeFiles: (minSizeMB?: number) => ipcRenderer.invoke('get-large-files', minSizeMB),
  getCacheInfo: () => ipcRenderer.invoke('get-cache-info'),
  getDuplicates: () => ipcRenderer.invoke('get-duplicates'),
  getTrashInfo: () => ipcRenderer.invoke('get-trash-info'),
  emptyTrash: () => ipcRenderer.invoke('empty-trash'),
  getIOSData: () => ipcRenderer.invoke('get-ios-data'),
  moveToTrash: (paths: string[]) => ipcRenderer.invoke('move-to-trash', paths),
  deletePermanently: (paths: string[]) => ipcRenderer.invoke('delete-permanently', paths),
  smartScan: () => ipcRenderer.invoke('smart-scan'),
  smartClean: (paths: string[]) => ipcRenderer.invoke('smart-clean', paths),
  listDirContents: (path: string) => ipcRenderer.invoke('list-dir-contents', path),
  getSystemData: () => ipcRenderer.invoke('get-system-data'),
  showInFinder: (path: string) => ipcRenderer.invoke('show-in-finder', path),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
})
