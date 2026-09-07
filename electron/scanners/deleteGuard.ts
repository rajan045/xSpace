import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * Deliberately free of any `electron` import so it can be unit tested in plain node.
 */

/**
 * Locations that must never be deleted outright, however a scanner reports them.
 *
 * This guards the catastrophic case — a scan bug returning a container rather than an
 * item inside it. It deliberately does NOT block files *inside* these folders: deleting
 * a large file from ~/Documents is a legitimate thing a user asks for, and over-blocking
 * would break Large Files and Duplicates.
 */
export function protectedRoots(): string[] {
  const home = os.homedir()
  const named = [
    'Documents', 'Desktop', 'Downloads', 'Pictures', 'Movies', 'Music',
    'Library', 'Applications', 'Public', '.Trash', '.ssh',
    'Library/Mobile Documents', // iCloud Drive
  ]
  return [
    '/', '/System', '/Library', '/Applications', '/Users', '/usr', '/bin', '/sbin',
    '/etc', '/var', '/private', '/opt', '/tmp',
    home,
    ...named.map(d => path.join(home, d)),
  ]
}

const strip = (p: string) => p.replace(/\/+$/, '') || '/'

/**
 * Protected roots as their real paths, since the candidate is realpath'd before
 * comparison. macOS symlinks /tmp -> /private/tmp (likewise /var and /etc), so a
 * literal-string list would let `/tmp` slip straight past the entry meant to catch it.
 * Both spellings are kept — either can be what a scanner hands us.
 */
function protectedRealPaths(): Set<string> {
  const out = new Set<string>()
  for (const root of protectedRoots()) {
    out.add(strip(root))
    try {
      out.add(strip(fs.realpathSync(root)))
    } catch {
      /* root may not exist on this machine — the literal form still guards it */
    }
  }
  return out
}

/**
 * Why this path must not be deleted, or null when it is safe to.
 *
 * Resolves symlinks first: a link named `old-cache` pointing at $HOME would otherwise
 * pass the name check and take the whole account with it.
 */
export function refuseReason(p: string): string | null {
  if (typeof p !== 'string' || !p.trim()) return 'empty path'
  if (!path.isAbsolute(p)) return `not an absolute path: ${p}`

  let resolved: string
  try {
    resolved = fs.realpathSync(p)
  } catch {
    resolved = path.resolve(p)
  }
  const target = strip(path.normalize(resolved))

  if (protectedRealPaths().has(target)) {
    return `refusing to delete a protected location: ${target}`
  }

  // An ancestor of the home directory would take everything below it.
  const home = strip(os.homedir())
  if (home === target || home.startsWith(`${target}/`)) {
    return `refusing to delete ${target} — it contains your home folder`
  }

  return null
}
