import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileSearch, Trash2, Copy, Layers, Smartphone,
  ShieldCheck, Activity, AppWindow, Search, Sun, Moon, Monitor,
} from 'lucide-react'
import { applyTheme, getTheme, type Theme } from '../theme'

export interface Command {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands: Command[] = useMemo(() => {
    const go = (to: string) => () => navigate(to)
    const theme = (t: Theme) => () => applyTheme(t)
    return [
      { id: 'smart', label: 'Smart Clean', hint: '⌘0', icon: <ShieldCheck size={15} />, run: go('/smart-clean') },
      { id: 'overview', label: 'Overview', hint: '⌘1', icon: <LayoutDashboard size={15} />, run: go('/') },
      { id: 'large', label: 'Large Files', hint: '⌘2', icon: <FileSearch size={15} />, run: go('/large-files') },
      { id: 'caches', label: 'Caches', hint: '⌘3', icon: <Layers size={15} />, run: go('/caches') },
      { id: 'dupes', label: 'Duplicates', hint: '⌘4', icon: <Copy size={15} />, run: go('/duplicates') },
      { id: 'trash', label: 'Trash', hint: '⌘5', icon: <Trash2 size={15} />, run: go('/trash') },
      { id: 'ios', label: 'iOS & Xcode', hint: '⌘6', icon: <Smartphone size={15} />, run: go('/ios-data') },
      { id: 'apps', label: 'Uninstaller', hint: '⌘7', icon: <AppWindow size={15} />, run: go('/apps') },
      { id: 'running', label: 'Running Processes', hint: '⌘8', icon: <Activity size={15} />, run: go('/running') },
      { id: 'dark', label: 'Appearance: Dark', icon: <Moon size={15} />, run: theme('dark') },
      { id: 'light', label: 'Appearance: Light', icon: <Sun size={15} />, run: theme('light') },
      { id: 'system', label: 'Appearance: Match System', icon: <Monitor size={15} />, run: theme('system') },
    ]
  }, [navigate])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c => c.label.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      // focus after the element is actually mounted
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => { setCursor(0) }, [query])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  function pick(cmd?: Command) {
    if (!cmd) return
    cmd.run()
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => (results.length ? (c + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => (results.length ? (c - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(results[cursor])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[16vh] px-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-[520px] rounded-mac border border-white/[0.12] bg-mac-panel shadow-mac overflow-hidden fade-in"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 px-3.5 h-[46px] border-b border-white/[0.08]">
          <Search size={15} className="text-white/35 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Jump to a page or change appearance…"
            className="flex-1 bg-transparent outline-none text-[14px] text-white placeholder:text-white/30"
          />
          <kbd>esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-white/35">No matches</p>
          ) : results.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              data-active={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(cmd)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors ${
                i === cursor ? 'bg-white/[0.10] text-white' : 'text-white/65'
              }`}
            >
              <span className={i === cursor ? 'text-accent-blue' : 'text-white/40'}>{cmd.icon}</span>
              <span className="flex-1 truncate">{cmd.label}</span>
              {cmd.hint && <span className="text-[11px] text-white/30 tabular-nums">{cmd.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
