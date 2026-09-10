export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  // macOS Finder & System Settings report storage in base-1000 (1 GB = 1,000,000,000 bytes).
  const k = 1000
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

export function formatPath(fullPath: string): string {
  const home = fullPath.indexOf('/Users/')
  if (home !== -1) {
    const afterUsers = fullPath.indexOf('/', home + 7)
    if (afterUsers !== -1) {
      return '~' + fullPath.substring(afterUsers)
    }
  }
  return fullPath
}

/** Two-color system: every "color" in the UI is the foreground tone at some opacity. */
export function tone(alpha: number): string {
  return `rgb(var(--fg) / ${alpha})`
}

/** Fill behind a tone (badges, chips, category swatches). */
export function toneFill(alpha = 0.1): string {
  return `rgb(var(--fg) / ${alpha})`
}

/** Ordered ramp for charts and category lists — distinct by weight, not by hue. */
export const TONE_RAMP = [0.92, 0.74, 0.58, 0.44, 0.32, 0.22, 0.16].map(tone)

export function getExtColor(ext: string): string {
  const strong = ['mp4', 'mov', 'avi', 'mkv', 'pdf', 'dmg', 'pkg']
  const medium = ['jpg', 'jpeg', 'png', 'gif', 'mp3', 'wav', 'flac', 'doc', 'docx']
  const light = ['zip', 'tar', 'gz', 'rar', 'js', 'ts', 'py']
  const e = ext.toLowerCase()
  if (strong.includes(e)) return tone(0.9)
  if (medium.includes(e)) return tone(0.7)
  if (light.includes(e)) return tone(0.5)
  return tone(0.35)
}
