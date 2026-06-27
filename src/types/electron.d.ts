export {}

declare global {
  interface AuthAccount {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
    subscriptionActive: boolean
    trialActive: boolean
    trialDaysLeft: number
  }

  interface Window {
    electronAPI: {
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
      authStartLogin: () => Promise<{ signedIn: boolean; user?: AuthAccount; error?: string }>
      authStatus: () => Promise<{ signedIn: boolean; user?: AuthAccount }>
      authLogout: () => Promise<{ signedIn: boolean }>
      getInstalledApps: () => Promise<Array<{
        name: string
        path: string
        bundleId: string
        size: number
        modified: string
        location: 'system-apps' | 'user-apps'
      }>>
      findAppLeftovers: (appPath: string, bundleId: string, appName: string) => Promise<Array<{
        path: string
        size: number
        category: string
      }>>
      quitUserProcess: (pid: number) => Promise<{ ok: boolean; error?: string }>
      unloadUserLaunchAgent: (plistPath: string) => Promise<{ ok: boolean; error?: string }>
      showInFinder: (path: string) => Promise<boolean>
      openPath: (path: string) => Promise<boolean>
    }
  }
}
