/** Plain-language help for Disk Overview categories — keys must match diskInfo category names */

export interface CategoryHelp {
  /** What typically lives in this bucket */
  contains: string
  /** What happens if you delete or change things here */
  impact: string
}

export const OVERVIEW_CATEGORY_INFO: Record<string, CategoryHelp> = {
  'System & Other': {
    contains:
      'The catch-all bucket: everything not matched to a folder category above. Includes macOS itself, system files under /System and /Library, swap and sleep images, logs, Time Machine local snapshots, and caches outside your home folder. Because xSpace measures by folder, this number is usually larger than the “System Data” shown in macOS System Settings (which splits out macOS, Documents-by-type, etc.).',
    impact:
      'Most of this is required to run macOS. Deleting the wrong items can stop your Mac from booting or break updates. Browse only what you understand; avoid bulk deletes. Safe cleanups usually happen via this app’s Smart Clean / Caches — not by deleting random system paths.',
  },
  Applications: {
    contains:
      'Apps installed for all users in /Applications, plus apps in your own ~/Applications folder.',
    impact:
      'Removing an app’s folder uninstalls that app. Your personal files in Documents, Desktop, etc. are separate. You can reinstall from the App Store or the original installer if you still need the app.',
  },
  'Library & Caches': {
    contains:
      'Your ~/Library folder minus Mail, iCloud Drive, and Developer (those are counted separately). Includes Caches, Application Support, preferences, saved app state, and many support files for apps you use.',
    impact:
      'Caches and temp data are often safe to clear and will rebuild. Deleting whole app support folders can log you out of apps or reset settings. Prefer cleaning named cache folders or use the Caches page rather than deleting Library at random.',
  },
  Developer: {
    contains:
      'Xcode Derived Data, iOS Simulator runtimes, archives, SwiftPM caches, and other files under ~/Library/Developer.',
    impact:
      'Deleting Derived Data or simulators frees a lot of space; Xcode rebuilds or re-downloads them when needed. Removing active project data you care about can slow you down until you rebuild — usually harmless.',
  },
  Documents: {
    contains:
      'Files in your Documents folder — what you (and apps) saved as documents, projects, exports, etc.',
    impact:
      'Deleting here removes your real work. Always review before trashing. Moving to Trash is reversible until you empty Trash.',
  },
  Downloads: {
    contains:
      'Everything in your Downloads folder: installers, zips, images, PDFs, and anything you downloaded from the browser or Mail.',
    impact:
      'Safe to remove files you no longer need; installers are often redundant after installation. Deleting something you still need means re-downloading or restoring from backup.',
  },
  Photos: {
    contains:
      'Your Photos library (Photos Library.photoslibrary) if present, otherwise the Pictures folder — photos, albums, and photo app data.',
    impact:
      'Deleting the library or originals can permanently remove photos unless they’re in iCloud and you can re-download. Use Photos or Time Machine before removing large photo data.',
  },
  'iCloud Drive': {
    contains:
      'Files synced via iCloud Drive under ~/Library/Mobile Documents — Desktop & Documents sync, iCloud folders, and some app containers.',
    impact:
      'Removing files here deletes them from iCloud on all devices once sync completes. Other devices may lose access. Prefer managing files from Finder’s iCloud Drive.',
  },
  Mail: {
    contains:
      'Local Mail app data: downloaded messages, attachments cache, and mailbox databases under ~/Library/Mail.',
    impact:
      'Deleting Mail data removes local copies; IMAP/Exchange can often re-sync mail from the server, but you may need to re-download everything. Offline-only or POP mail could be harder to recover.',
  },
  Desktop: {
    contains:
      'Everything on your Desktop — files, folders, and shortcuts you placed there.',
    impact:
      'Same as deleting any personal file: Trash is undoable; permanent delete is not. If Desktop is synced to iCloud, changes propagate to other devices.',
  },
}

export function getCategoryHelp(name: string): CategoryHelp | undefined {
  return OVERVIEW_CATEGORY_INFO[name]
}
