/** Extended help for System Data breakdown rows — keys are absolute paths from systemData.ts */

export interface SystemFolderHelp {
  contains: string
  impact: string
}

export const SYSTEM_FOLDER_INFO: Record<string, SystemFolderHelp> = {
  '/System': {
    contains:
      'The read-only macOS system volume: kernel, frameworks, built-in apps, fonts, and firmware that the OS needs to start and run.',
    impact:
      'You cannot normally delete this from the GUI; SIP protects it. Do not try to “clean” /System manually — you risk an unbootable Mac. Free space here is not something users reclaim by deleting files.',
  },
  '/Library': {
    contains:
      'System-wide Library: LaunchDaemons, Frameworks, Audio/Plug-Ins, Preferences for all users, printer drivers, and support files for apps installed for every account.',
    impact:
      'Removing the wrong folder can break Wi‑Fi, printing, audio, or all users’ apps. Only advanced users should change specific subfolders. Prefer app uninstallers or Apple’s storage tools over bulk deletes.',
  },
  '/usr': {
    contains:
      'Unix layer: shells, compilers, system binaries, and shared libraries used by Terminal and many system services (not your personal files).',
    impact:
      'Deleting or renaming items here can break Terminal, scripts, and system updates. macOS updates can restore some files, but you may need to reinstall macOS if things go wrong.',
  },
  '/private/var/folders': {
    contains:
      'Per-user and system temporary sandboxes: app caches, Xcode intermediates, browser temp data, and short-lived files. Organized as hashed subfolders.',
    impact:
      'macOS and apps recreate these as needed. Deleting active temp files while apps run can cause crashes; safest cleanup is after quitting heavy apps, or use this app’s cache tools. Usually safe in principle, messy in practice.',
  },
  '/private/var/log': {
    contains:
      'System and service logs: install logs, Wi‑Fi diagnostics, crash reports metadata, and historical diagnostic text.',
    impact:
      'Removing logs frees a little space and does not break apps, but you lose history that Apple Support might ask for. New logs appear immediately after.',
  },
  '/private/var/vm': {
    contains:
      'Swap files and sleep images: macOS extends RAM to disk when memory is tight, and stores a hibernation image on some Macs.',
    impact:
      'Do not delete these while the Mac is running — the system may recreate them anyway, but forced removal can cause kernel panics or failed sleep/wake. Let macOS manage this; add RAM or close apps if swap is huge.',
  },
  '/cores': {
    contains:
      'Core dump files written when a program crashes badly (if core dumps are enabled). Often empty on typical setups.',
    impact:
      'Safe to delete existing core files to free space. They are only for developers debugging crashes; removing them does not affect normal use. They may reappear after future crashes.',
  },
  '/.MobileBackups': {
    contains:
      'Legacy local snapshots used by older Time Machine local-backup behavior on laptops. May be absent on newer macOS versions.',
    impact:
      'macOS manages snapshots. Manual deletion is not recommended unless you know the consequences; use System Settings → Storage or `tmutil` if you need to thin snapshots.',
  },
}

export function getSystemFolderHelp(path: string): SystemFolderHelp | undefined {
  return SYSTEM_FOLDER_INFO[path]
}

export function defaultSystemFolderImpact(safeToDelete: boolean): string {
  return safeToDelete
    ? 'These files are not required for macOS to run. Removing them frees space; they may come back if the same condition happens again (e.g. another crash dump).'
    : 'This location is required for a working system or stable sleep/memory behavior. Deleting or editing files here can prevent boot, break updates, or cause data loss. Browse only; do not bulk-delete.'
}
