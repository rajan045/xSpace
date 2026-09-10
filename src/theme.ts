export type Theme = 'dark' | 'light' | 'system'

const KEY = 'xspace.theme'

export function getTheme(): Theme {
  const saved = localStorage.getItem(KEY)
  return saved === 'dark' || saved === 'light' ? saved : 'system'
}

/** 'system' removes the attribute so the CSS media query takes over. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  localStorage.setItem(KEY, theme)
}

/** Cycle dark → light → system. */
export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
}

/** Call before first paint. */
export function initTheme() {
  applyTheme(getTheme())
}
