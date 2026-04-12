import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onLicenseChanged: (callback: () => void) => {
    const fn = () => callback()
    ipcRenderer.on('license-changed', fn)
    return () => ipcRenderer.removeListener('license-changed', fn)
  },
  authLogin: (email: string, password: string) =>
    ipcRenderer.invoke('auth-login', email, password),
  authRegister: (email: string, password: string) =>
    ipcRenderer.invoke('auth-register', email, password),
  authLogout: () => ipcRenderer.invoke('auth-logout'),
  authGetState: () => ipcRenderer.invoke('auth-get-state'),
  authSetApiToken: (token: string) => ipcRenderer.invoke('auth-set-api-token', token),
  authSyncEntitlement: () => ipcRenderer.invoke('auth-sync-entitlement'),
  authGenerateToken: () => ipcRenderer.invoke('auth-generate-token'),
  authFetchDevices: () => ipcRenderer.invoke('auth-fetch-devices'),
  authDeleteDevice: (deviceId: string) =>
    ipcRenderer.invoke('auth-delete-device', deviceId),
  authDeleteAllDevices: () => ipcRenderer.invoke('auth-delete-all-devices'),
  authFetchTokenMe: () => ipcRenderer.invoke('auth-fetch-token-me'),
  authRevokeTokens: () => ipcRenderer.invoke('auth-revoke-tokens'),
  subscriptionHistoryMe: (limit?: number) =>
    ipcRenderer.invoke('subscription-history-me', limit),
  licenseStatus: () => ipcRenderer.invoke('license-status'),
  dismissTrialWelcome: () => ipcRenderer.invoke('dismiss-trial-welcome'),
  setLicenseKey: (key: string) => ipcRenderer.invoke('set-license-key', key),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
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
  getRunningOverview: () => ipcRenderer.invoke('get-running-overview'),
  quitUserProcess: (pid: number) => ipcRenderer.invoke('quit-user-process', pid),
  unloadUserLaunchAgent: (plistPath: string) =>
    ipcRenderer.invoke('unload-user-launch-agent', plistPath),
  showInFinder: (path: string) => ipcRenderer.invoke('show-in-finder', path),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
})
