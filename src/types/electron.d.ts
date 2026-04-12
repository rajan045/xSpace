export {}

type LicenseStatusResult =
  | { state: 'licensed'; email?: string }
  | { state: 'trial'; daysLeft: number; showWelcome: boolean }
  | { state: 'expired' }

type AuthLoginResult = { ok: true } | { ok: false; error: string }

type AuthState = {
  hasApiToken: boolean
  hasSession: boolean
  email: string | null
  subscriptionActive: boolean
  machineId: string
}

type GenerateTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: string }

type SetApiTokenResult = { ok: true } | { ok: false; error: string }

type DeviceRow = {
  id: string
  machineIdHash: string
  lastSeenAt: string
  createdAt: string
}

type DevicesListResult = {
  maxDevices: number
  activeDevices: number
  devices: DeviceRow[]
}

type FetchDevicesResult =
  | { ok: true; data: DevicesListResult }
  | { ok: false; error: string }

type DeleteDeviceResult = { ok: true } | { ok: false; error: string }

type DeleteAllDevicesResult =
  | { ok: true; removed: number }
  | { ok: false; error: string }

type TokenMeInfo = {
  id: string
  tokenMasked: string
  name: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

type FetchTokenMeResult =
  | { ok: true; token: TokenMeInfo | null }
  | { ok: false; error: string }

type RevokeTokensResult = { ok: true } | { ok: false; error: string }

type SubscriptionHistoryEvent = {
  _id?: string
  eventType?: string
  createdAt?: string
  metadata?: Record<string, unknown>
  source?: string
}

type SubscriptionHistoryMeResult =
  | {
      ok: true
      data: {
        email: string
        subscriptionType?: string
        paymentId?: string
        events: SubscriptionHistoryEvent[]
      }
    }
  | { ok: false; error: string }

declare global {
  interface Window {
    electronAPI: {
      onLicenseChanged: (callback: () => void) => () => void
      authLogin: (email: string, password: string) => Promise<AuthLoginResult>
      authRegister: (email: string, password: string) => Promise<AuthLoginResult>
      authLogout: () => Promise<boolean>
      authGetState: () => Promise<AuthState>
      authSetApiToken: (token: string) => Promise<SetApiTokenResult>
      authSyncEntitlement: () => Promise<AuthState>
      authGenerateToken: () => Promise<GenerateTokenResult>
      authFetchDevices: () => Promise<FetchDevicesResult>
      authDeleteDevice: (deviceId: string) => Promise<DeleteDeviceResult>
      authDeleteAllDevices: () => Promise<DeleteAllDevicesResult>
      authFetchTokenMe: () => Promise<FetchTokenMeResult>
      authRevokeTokens: () => Promise<RevokeTokensResult>
      subscriptionHistoryMe: (limit?: number) => Promise<SubscriptionHistoryMeResult>
      licenseStatus: () => Promise<LicenseStatusResult>
      dismissTrialWelcome: () => Promise<LicenseStatusResult>
      setLicenseKey: (key: string) => Promise<{ ok: boolean; error?: string }>
      openExternal: (url: string) => Promise<boolean>
      getDiskInfo: () => Promise<any>
      getLargeFiles: (minSizeMB?: number) => Promise<any[]>
      getCacheInfo: () => Promise<any[]>
      getDuplicates: () => Promise<any[]>
      getTrashInfo: () => Promise<any>
      emptyTrash: () => Promise<any>
      getIOSData: () => Promise<any>
      moveToTrash: (paths: string[]) => Promise<any>
      deletePermanently: (paths: string[]) => Promise<any>
      smartScan: () => Promise<{ items: any[]; totalSize: number }>
      smartClean: (paths: string[]) => Promise<{
        success: boolean
        freedBytes: number
        errors: string[]
        deletedPaths: string[]
      }>
      listDirContents: (path: string) => Promise<any[]>
      getSystemData: () => Promise<any[]>
      getRunningOverview: () => Promise<{
        processes: Array<{
          pid: number
          ppid: number
          cpuPercent: number
          memoryMB: number
          comm: string
          canQuit: boolean
        }>
        protectedProcesses: Array<{
          pid: number
          ppid: number
          cpuPercent: number
          memoryMB: number
          comm: string
          canQuit: boolean
        }>
        launchAgents: Array<{
          plistPath: string
          label: string
          fileName: string
          loadedPid: number | null
          canUnload: boolean
        }>
        platformNote?: string
      }>
      quitUserProcess: (pid: number) => Promise<{ ok: boolean; error?: string }>
      unloadUserLaunchAgent: (plistPath: string) => Promise<{ ok: boolean; error?: string }>
      showInFinder: (path: string) => Promise<boolean>
      openPath: (path: string) => Promise<boolean>
    }
  }
}
