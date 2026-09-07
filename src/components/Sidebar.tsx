import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileSearch,
  Trash2,
  Copy,
  Layers,
  Smartphone,
  ShieldCheck,
  Activity,
  AppWindow,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import AccountButton from './AccountButton'
import { applyTheme, getTheme, nextTheme, type Theme } from '../theme'

const THEME_META: Record<Theme, { icon: React.ReactNode; label: string }> = {
  dark: { icon: <Moon size={13} />, label: 'Dark' },
  light: { icon: <Sun size={13} />, label: 'Light' },
  system: { icon: <Monitor size={13} />, label: 'System' },
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', exact: true },
  { to: '/large-files', icon: FileSearch, label: 'Large Files' },
  { to: '/caches', icon: Layers, label: 'Caches' },
  { to: '/duplicates', icon: Copy, label: 'Duplicates' },
  { to: '/trash', icon: Trash2, label: 'Trash' },
  { to: '/ios-data', icon: Smartphone, label: 'iOS & Xcode' },
  { to: '/apps', icon: AppWindow, label: 'Uninstaller' },
  { to: '/running', icon: Activity, label: 'Running' },
]

export default function Sidebar() {
  const [theme, setTheme] = useState<Theme>(getTheme)

  function cycleTheme() {
    const next = nextTheme(theme)
    applyTheme(next)
    setTheme(next)
  }

  return (
    <aside className="flex flex-col w-[208px] shrink-0 h-full bg-mac-sidebar border-r border-white/[0.07]">
      {/* Title bar spacer — aligns with traffic lights */}
      <div className="drag-region h-[52px] shrink-0 border-b border-mac-separator" />

      <div className="no-drag flex flex-col flex-1 min-h-0 pt-3 pb-2">
        {/* App identity — Finder / Settings style */}
        <div className="px-3 pb-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-mac-sm bg-mac-window border border-white/[0.08] flex items-center justify-center shadow-mac-sm overflow-hidden p-0.5">
            <AppLogo size={34} className="rounded-[6px]" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white/90 leading-tight truncate">xSpace</div>
            <div className="text-[11px] text-white/40 leading-tight">Mac Cleaner</div>
          </div>
        </div>

        {/* Primary action — looks like a filled control */}
        <div className="px-2 mb-3">
          <NavLink
            to="/smart-clean"
            className={({ isActive }) =>
              `flex items-center gap-2 px-2.5 py-2 rounded-mac-sm text-[13px] font-medium transition-all duration-150 border outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                isActive
                  ? 'bg-accent-green text-mac-window border-transparent'
                  : 'bg-accent-green/90 text-mac-window border-transparent hover:bg-accent-green'
              }`
            }
          >
            <ShieldCheck size={15} strokeWidth={2} />
            Smart Clean
          </NavLink>
        </div>

        <p className="px-3 mb-1 text-[11px] font-semibold text-white/35 uppercase tracking-wide">
          Library
        </p>

        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto min-h-0">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-1.5 rounded-mac-sm text-[13px] transition-colors duration-100 outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50 ${
                  isActive
                    ? 'bg-white/[0.12] text-white font-medium'
                    : 'text-white/55 hover:text-white/85 hover:bg-white/[0.06]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={isActive ? 2 : 1.75} className={isActive ? 'text-accent-blue opacity-100' : 'opacity-80'} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 pt-2 mt-auto border-t border-mac-separator space-y-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cycleTheme}
              title={`Appearance: ${THEME_META[theme].label} — click to change`}
              className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-mac-sm text-[12px] text-white/60 bg-white/[0.04] border border-white/[0.08] hover:text-white/90 hover:bg-white/[0.08] transition-colors mac-focus"
            >
              {THEME_META[theme].icon}
              <span className="truncate">{THEME_META[theme].label}</span>
            </button>
            <span className="flex items-center gap-0.5 px-1.5 py-1.5 text-[11px] text-white/30 select-none" title="Command palette">
              <kbd>⌘</kbd><kbd>K</kbd>
            </span>
          </div>
          <AccountButton />
          <p className="text-[10px] text-white/25 text-center px-1 pb-1">
            Trash is reversible
          </p>
        </div>
      </div>
    </aside>
  )
}
