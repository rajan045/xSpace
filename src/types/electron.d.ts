export {}

declare global {
  interface Window {
    electronAPI: {
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
      showInFinder: (path: string) => Promise<boolean>
      openPath: (path: string) => Promise<boolean>
    }
  }
}
