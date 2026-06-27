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

export function getExtColor(ext: string): string {
  const colorMap: Record<string, string> = {
    mp4: '#FF453A', mov: '#FF453A', avi: '#FF453A', mkv: '#FF453A',
    mp3: '#BF5AF2', wav: '#BF5AF2', flac: '#BF5AF2',
    jpg: '#30D158', jpeg: '#30D158', png: '#30D158', gif: '#30D158',
    zip: '#FF9F0A', tar: '#FF9F0A', gz: '#FF9F0A', rar: '#FF9F0A',
    pdf: '#FF453A', doc: '#0A84FF', docx: '#0A84FF',
    dmg: '#64D2FF', pkg: '#64D2FF',
    js: '#FF9F0A', ts: '#0A84FF', py: '#30D158',
  }
  return colorMap[ext.toLowerCase()] || '#8e8e93'
}
