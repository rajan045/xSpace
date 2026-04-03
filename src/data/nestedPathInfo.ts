/**
 * Contextual help for arbitrary paths shown in Overview drill-down.
 * Uses path segments, folder names, and file type — always returns something useful.
 */

export interface NestedItemHelp {
  contains: string
  impact: string
}

function genericFolder(categoryName?: string): NestedItemHelp {
  const ctx = categoryName ? ` under “${categoryName}”` : ''
  return {
    contains: `A subfolder${ctx}. It may hold more folders and files belonging to apps or the system.`,
    impact:
      'Deleting a folder removes everything inside. If it belongs to an app, that app may reset settings or stop working until you reinstall. Prefer moving to Trash so you can restore from Finder.',
  }
}

function genericFile(categoryName?: string, ext?: string): NestedItemHelp {
  const ctx = categoryName ? ` in your “${categoryName}” area` : ''
  const extHint =
    ext && ext.length > 0
      ? ` This is a .${ext} file${ctx}.`
      : ` This is a single file${ctx}.`
  return {
    contains: `A file on disk.${extHint}`,
    impact:
      'Deleting removes only this file. There is no automatic restore unless you use Trash (then Put Back) or a backup. Make sure you do not need it before permanent delete.',
  }
}

type Matcher = (pathLower: string, nameLower: string, isDir: boolean) => NestedItemHelp | null

const matchers: Matcher[] = [
  (p, n, isDir) => {
    if (!isDir && (n.endsWith('.dmg') || n.endsWith('.pkg'))) {
      return {
        contains: 'A macOS installer disk image or package you downloaded.',
        impact:
          'Safe to delete after the app is installed if you will not reinstall from this file. You can usually re-download from the vendor. Deleting does not uninstall an already-installed app.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (n.endsWith('.app') && isDir) {
      return {
        contains: 'An application bundle (right-click → Show Package Contents to see inside).',
        impact:
          'Removing this uninstalls that app. Your documents elsewhere are untouched. You can reinstall from the App Store or installer if needed.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('deriveddata') || n === 'deriveddata') {
      return {
        contains: 'Xcode build products, indexes, and intermediates for projects you opened.',
        impact:
          'Safe to delete: Xcode rebuilds this on next build. First build may take longer. Source code in your project folder is not stored here.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('archives') && p.includes('xcode')) {
      return {
        contains: 'Archived .xcarchive builds used for TestFlight and App Store submission.',
        impact:
          'Deleting removes old release snapshots. You may need them to symbolicate crashes or resubmit; keep recent archives if you ship apps.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('coresimulator') || p.includes('iphonesimulator') || n.includes('simulator')) {
      return {
        contains: 'iOS Simulator device data, apps installed on simulators, and related files.',
        impact:
          'Deleting frees space; Xcode can recreate simulators. You lose simulator-only data (not your real iPhone backups, which live elsewhere).',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (n === 'caches' || p.endsWith('/caches') || p.includes('/caches/')) {
      return {
        contains: 'Temporary cache files apps use to start faster or store thumbnails.',
        impact:
          'Usually safe: apps recreate caches. First launch after delete may be slower. Rarely, an app may need to re-download large offline data.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (n === 'logs' || p.endsWith('/logs') || p.includes('/logs/')) {
      return {
        contains: 'Text logs from apps or the system for debugging and history.',
        impact:
          'Deleting frees little space and is usually safe; new logs appear as apps run. You lose diagnostic history Apple Support might ask for.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('application support')) {
      return {
        contains: 'App-specific data: databases, offline content, plugins, and settings many apps store here.',
        impact:
          'Deleting a subfolder can log you out, remove game saves, or reset that app. Do not remove blindly — prefer the app’s own “clear data” or uninstaller.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('saved application state')) {
      return {
        contains: 'Resume state so macOS can restore windows when you reopen an app.',
        impact:
          'Safe to delete: you only lose “reopen windows” snapshots. The app itself and your documents are unchanged.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('/containers/') || p.includes('group containers')) {
      return {
        contains: 'Sandboxed app storage (Documents, tmp, preferences) for Mac App Store and sandboxed apps.',
        impact:
          'Removing the wrong container deletes that app’s data inside the sandbox. Other apps are isolated. Use caution — this is not a generic cache folder.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (n === 'preferences' || p.endsWith('/preferences')) {
      return {
        contains: '.plist and other preference files that store app and system settings.',
        impact:
          'Deleting a plist resets that app or feature to defaults. The app usually recreates it. Wrong deletions can break keyboard shortcuts, dock, etc.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (n === 'node_modules' || p.includes('node_modules')) {
      return {
        contains: 'JavaScript packages installed by npm/yarn/pnpm for a project.',
        impact:
          'Safe to delete for space: run npm install (or yarn) in the project folder to restore. Your source code is not inside node_modules as “your” files.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (n.endsWith('.photoslibrary') || p.includes('.photoslibrary')) {
      return {
        contains: 'Apple Photos library: originals, edits, faces data, and database.',
        impact:
          'Deleting this removes photos from this Mac unless iCloud Photos can re-download. Always export or verify iCloud before deleting.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('mobile documents') || p.includes('icloud')) {
      return {
        contains: 'Files synced with iCloud Drive (and some app iCloud containers).',
        impact:
          'Deleting here removes or orphans cloud-backed files on all synced devices once sync runs. Prefer deleting from Finder’s iCloud Drive.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('/mail/') || p.includes('mail data')) {
      return {
        contains: 'Mail app mailboxes, downloaded messages, and attachments cache.',
        impact:
          'Removing folders can make mail disappear locally; IMAP/Exchange often re-syncs from the server. POP-only or local mail may be harder to recover.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (n === '.trash' || p.includes('/.trash')) {
      return {
        contains: 'The Trash folder — files you already chose to delete from Finder.',
        impact:
          'Emptying Trash permanently removes these items. Until then you can still Put Back from Finder.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('/downloads/') || (isDir && n === 'downloads')) {
      return {
        contains: 'Items you downloaded from the browser, Mail, or other apps.',
        impact:
          'Deleting is final after Trash is emptied. Installers and zips are often safe to remove if you no longer need them.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('/desktop/') || (isDir && n === 'desktop')) {
      return {
        contains: 'Files and folders sitting on your Desktop.',
        impact:
          'Same as deleting any personal file. If Desktop is in iCloud, changes sync to other devices.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('/documents/') || (isDir && n === 'documents')) {
      return {
        contains: 'Your Documents folder — projects, exports, and files you saved here.',
        impact:
          'These are typically important user files. Use Trash first so you can undo.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('library/developer')) {
      return {
        contains: 'Developer tools data: Xcode, SwiftPM, Playgrounds, device support files.',
        impact:
          'Many subfolders are safe to remove (Derived Data, old device support) and are recreated by Xcode. Keep what you need for shipping apps.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('homebrew') || p.includes('/opt/homebrew') || p.includes('/usr/local/cellar')) {
      return {
        contains: 'Homebrew packages, bottles, and caches.',
        impact:
          'Removing Cellar entries uninstalls those formulae; run brew cleanup for caches. Do not delete the whole Homebrew tree unless you intend to reinstall.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('google/chrome') && (p.includes('cache') || n === 'cache' || n === 'gpucache')) {
      return {
        contains: 'Chrome browser cache (pages, images, scripts for faster reload).',
        impact:
          'Safe to delete: Chrome rebuilds as you browse. You stay logged into sites unless you also clear cookies elsewhere.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (p.includes('com.apple.') && isDir) {
      return {
        contains: 'An Apple or third-party app’s container or group data under a bundle identifier.',
        impact:
          'Holds that app’s sandboxed files. Deleting it resets or breaks that app; others are unaffected.',
      }
    }
    return null
  },
  (p, n, isDir) => {
    if (!isDir) {
      const video = ['mp4', 'mov', 'mkv', 'avi', 'm4v']
      const img = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'webp', 'raw']
      const arch = ['zip', 'tar', 'gz', 'rar', '7z']
      const ext = n.includes('.') ? n.slice(n.lastIndexOf('.') + 1) : ''
      if (video.includes(ext)) {
        return {
          contains: 'A video file.',
          impact: 'Deleting removes the video permanently after Trash is emptied. Ensure it is backed up or in Photos/iCloud if you care about it.',
        }
      }
      if (img.includes(ext)) {
        return {
          contains: 'An image file.',
          impact: 'Deleting removes the image from this location. Check Photos or backups if it might be the only copy.',
        }
      }
      if (arch.includes(ext)) {
        return {
          contains: 'A compressed archive (may contain many files inside).',
          impact: 'Safe to delete if you already extracted what you need or have another copy.',
        }
      }
    }
    return null
  },
]

/**
 * Help text for a nested file or folder in the Overview browser.
 */
export function getNestedItemHelp(
  fullPath: string,
  entryName: string,
  isDir: boolean,
  categoryName?: string
): NestedItemHelp {
  const pathLower = fullPath.toLowerCase()
  const nameLower = entryName.toLowerCase()

  for (const m of matchers) {
    const hit = m(pathLower, nameLower, isDir)
    if (hit) return hit
  }

  if (isDir) return genericFolder(categoryName)
  const ext = entryName.includes('.') ? entryName.slice(entryName.lastIndexOf('.') + 1).toLowerCase() : ''
  return genericFile(categoryName, ext)
}
