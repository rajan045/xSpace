import os from 'os'
import fs from 'fs'
import { getDirSizeAsync } from './utils'

export interface CacheCategory {
  id: string
  name: string
  description: string
  path: string
  size: number
  safeToDelete: boolean
  icon: string
}

export async function getCacheInfo(): Promise<CacheCategory[]> {
  const home = os.homedir()

  const cacheTargets = [
    {
      id: 'system-cache',
      name: 'System Cache',
      description: 'macOS system and app cache files',
      path: `${home}/Library/Caches`,
      safeToDelete: true,
      icon: 'monitor',
    },
    {
      id: 'npm',
      name: 'npm Cache',
      description: 'Node.js package manager cache',
      path: `${home}/.npm`,
      safeToDelete: true,
      icon: 'package',
    },
    {
      id: 'yarn',
      name: 'Yarn Cache',
      description: 'Yarn package manager cache',
      path: `${home}/.yarn/cache`,
      safeToDelete: true,
      icon: 'package',
    },
    {
      id: 'pnpm',
      name: 'pnpm Store',
      description: 'pnpm package manager cache',
      path: `${home}/Library/pnpm/store`,
      safeToDelete: true,
      icon: 'package',
    },
    {
      id: 'brew',
      name: 'Homebrew Cache',
      description: 'Homebrew download cache',
      path: `${home}/Library/Caches/Homebrew`,
      safeToDelete: true,
      icon: 'beer',
    },
    {
      id: 'xcode-derived',
      name: 'Xcode Derived Data',
      description: 'Build artifacts from Xcode projects',
      path: `${home}/Library/Developer/Xcode/DerivedData`,
      safeToDelete: true,
      icon: 'hammer',
    },
    {
      id: 'xcode-archives',
      name: 'Xcode Archives',
      description: 'Old Xcode app archives',
      path: `${home}/Library/Developer/Xcode/Archives`,
      safeToDelete: false,
      icon: 'archive',
    },
    {
      id: 'pip',
      name: 'pip Cache',
      description: 'Python package installer cache',
      path: `${home}/Library/Caches/pip`,
      safeToDelete: true,
      icon: 'code',
    },
    {
      id: 'gradle',
      name: 'Gradle Cache',
      description: 'Android/Java build system cache',
      path: `${home}/.gradle/caches`,
      safeToDelete: true,
      icon: 'layers',
    },
    {
      id: 'cocoapods',
      name: 'CocoaPods Cache',
      description: 'iOS/macOS dependency manager cache',
      path: `${home}/Library/Caches/CocoaPods`,
      safeToDelete: true,
      icon: 'smartphone',
    },
    {
      id: 'docker',
      name: 'Docker',
      description: 'Docker images and containers data',
      path: `${home}/Library/Containers/com.docker.docker/Data`,
      safeToDelete: false,
      icon: 'box',
    },
    {
      id: 'safari',
      name: 'Safari Cache',
      description: 'Safari browser cache',
      path: `${home}/Library/Caches/com.apple.Safari`,
      safeToDelete: true,
      icon: 'globe',
    },
    {
      id: 'chrome',
      name: 'Chrome Cache',
      description: 'Google Chrome browser cache',
      path: `${home}/Library/Caches/Google/Chrome`,
      safeToDelete: true,
      icon: 'globe',
    },
    {
      id: 'cursor',
      name: 'Cursor Cache',
      description: 'Cursor IDE cache files',
      path: `${home}/Library/Caches/Cursor`,
      safeToDelete: true,
      icon: 'code',
    },
    {
      id: 'vscode',
      name: 'VS Code Cache',
      description: 'Visual Studio Code cache',
      path: `${home}/Library/Caches/com.microsoft.VSCode`,
      safeToDelete: true,
      icon: 'code',
    },
  ]

  // Scan all sizes in parallel — non-blocking
  const results = await Promise.all(
    cacheTargets
      .filter(t => fs.existsSync(t.path))
      .map(async target => ({
        ...target,
        size: await getDirSizeAsync(target.path),
      }))
  )

  return results
    .filter(c => c.size > 0)
    .sort((a, b) => b.size - a.size)
}
