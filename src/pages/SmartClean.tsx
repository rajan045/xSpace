import React, { useState } from 'react'
import { Zap, ShieldCheck, Loader2, CheckCircle2, Trash2, RefreshCw, Package, Layers, Smartphone } from 'lucide-react'
import { formatBytes } from '../utils/format'

interface SafeItem {
  id: string
  label: string
  reason: string
  path: string
  size: number
  category: 'cache' | 'build' | 'simulator' | 'trash' | 'nodemodules'
}

interface ScanResult {
  items: SafeItem[]
  totalSize: number
}

type PageState = 'idle' | 'scanning' | 'results' | 'cleaning' | 'done'

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  cache:        { label: 'Caches',           icon: <Layers size={14} />,     color: '#BF5AF2' },
  build:        { label: 'Build Artifacts',  icon: <Package size={14} />,    color: '#64D2FF' },
  simulator:    { label: 'iOS Simulators',   icon: <Smartphone size={14} />, color: '#0A84FF' },
  trash:        { label: 'Trash',            icon: <Trash2 size={14} />,     color: '#FF453A' },
  nodemodules:  { label: 'node_modules',   icon: <Package size={14} />,    color: '#30D158' },
}

export default function SmartClean() {
  const [state, setState] = useState<PageState>('idle')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [freedBytes, setFreedBytes] = useState(0)
  const [errors, setErrors] = useState<string[]>([])

  async function scan() {
    setState('scanning')
    setResult(null)
    setSelected(new Set())
    try {
      const data = await window.electronAPI.smartScan()
      const items = Array.isArray(data?.items) ? data.items : []
      const totalSize =
        typeof data?.totalSize === 'number'
          ? data.totalSize
          : items.reduce((s: number, i: SafeItem) => s + (i.size || 0), 0)
      setResult({ items, totalSize })
      setSelected(new Set(items.map((i: SafeItem) => i.id)))
      setState('results')
    } catch (err) {
      console.error(err)
      setState('idle')
    }
  }

  async function clean() {
    if (!result) return
    const toDelete = result.items.filter(i => selected.has(i.id))
    const paths = toDelete.map(i => i.path)

    setState('cleaning')
    try {
      const res = await window.electronAPI.smartClean(paths)
      const deletedSet = new Set(res.deletedPaths ?? [])
      setFreedBytes(res.freedBytes)
      setErrors(res.errors || [])
      setResult(prev =>
        prev
          ? {
              ...prev,
              items: prev.items.filter(i => !deletedSet.has(i.path)),
            }
          : null
      )
      setSelected(new Set())
      if (deletedSet.size > 0 || res.freedBytes > 0) {
        setState('done')
      } else {
        setState('results')
      }
    } catch (err) {
      console.error(err)
      setState('results')
    }
  }

  function toggleItem(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Group items by category
  const grouped = result?.items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, SafeItem[]>) ?? {}

  const selectedItems = result?.items.filter(i => selected.has(i.id)) ?? []
  const selectedTotal = selectedItems.reduce((sum, i) => sum + i.size, 0)

  // ── Idle state ───────────────────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="fade-in flex flex-col items-center justify-center h-full pb-16">
        <div className="w-[72px] h-[72px] rounded-mac bg-dark-800 border border-white/[0.08] shadow-mac-sm flex items-center justify-center mb-5">
          <ShieldCheck size={30} className="text-accent-green" />
        </div>
        <h1 className="text-[22px] font-semibold text-white mb-1.5 tracking-tight">Smart Clean</h1>
        <p className="text-white/45 text-[13px] mb-2 text-center max-w-sm leading-relaxed">
          Finds data that is <span className="text-white/80 font-medium">safe to remove</span> — caches,{' '}
          <span className="text-white/70">node_modules</span> (restored with npm/yarn), and other rebuildable junk.
        </p>
        <p className="text-white/30 text-[12px] mb-8 text-center max-w-xs">
          Does not remove browser history, cookies, saved logins, bookmarks, or extensions. Scans your home folder for{' '}
          <code className="text-white/45">node_modules</code> (skips Library, Trash, .npm). Review paths before deleting.
        </p>
        <button type="button" onClick={scan} className="mac-btn-primary flex items-center gap-2.5 px-5 py-2.5 text-[15px] bg-accent-green hover:brightness-110 shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]">
          <Zap size={17} />
          Scan for Safe Junk
        </button>
      </div>
    )
  }

  // ── Scanning state ───────────────────────────────────────────────────────────
  if (state === 'scanning') {
    const categories = ['Caches', 'Build Artifacts', 'iOS Simulators', 'Trash']
    return (
      <div className="fade-in flex flex-col items-center justify-center h-full pb-16">
        <div className="w-14 h-14 rounded-mac bg-dark-800 border border-white/[0.08] flex items-center justify-center mb-5">
          <Loader2 size={26} className="text-accent-green animate-spin" />
        </div>
        <h2 className="text-[17px] font-semibold text-white mb-1">Scanning your Mac…</h2>
        <p className="text-white/40 text-[13px] mb-8">Finding safe-to-delete data</p>
        <div className="w-72 space-y-3">
          {categories.map((cat, i) => (
            <div key={cat} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-accent-green/40 flex items-center justify-center shrink-0">
                <Loader2 size={11} className="text-accent-green animate-spin" style={{ animationDelay: `${i * 150}ms` }} />
              </div>
              <span className="text-sm text-white/50">{cat}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Done state ───────────────────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <div className="fade-in flex flex-col items-center justify-center h-full pb-16">
        <div className="w-20 h-20 rounded-full bg-accent-green/15 flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-accent-green" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">All Clean!</h2>
        <p className="text-white/40 text-sm mb-6">
          Freed up <span className="text-accent-green font-bold text-base">{formatBytes(freedBytes)}</span> of storage
        </p>
        {errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 max-w-sm w-full">
            <p className="text-xs text-red-400 font-medium mb-2">{errors.length} item(s) could not be deleted:</p>
            {errors.slice(0, 3).map((e, i) => (
              <p key={i} className="text-xs text-red-400/70 truncate">{e}</p>
            ))}
          </div>
        )}
        <button
          onClick={() => { setState('idle'); setResult(null) }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-medium text-sm transition-all border border-white/10"
        >
          <RefreshCw size={14} />
          Scan Again
        </button>
      </div>
    )
  }

  // ── Results + Cleaning states ─────────────────────────────────────────────────
  return (
    <div className="fade-in flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-accent-green" />
            Smart Clean
          </h1>
          <p className="text-sm text-white/40 mt-0.5">
            {result?.items.length ?? 0} safe items found ·{' '}
            <span className="text-accent-green font-medium">{formatBytes(result?.totalSize ?? 0)}</span> recoverable
          </p>
        </div>
        <button
          onClick={scan}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 font-medium text-sm transition-all border border-white/10"
        >
          <RefreshCw size={13} />
          Re-scan
        </button>
      </div>

      {/* No items found */}
      {result?.items.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] pb-16">
          <div className="w-14 h-14 rounded-full bg-accent-green/10 flex items-center justify-center mb-4">
            <CheckCircle2 size={26} className="text-accent-green" />
          </div>
          <h3 className="text-base font-semibold text-white/70">Your Mac is already clean!</h3>
          <p className="text-sm text-white/30 mt-1">No safe-to-delete junk was found.</p>
        </div>
      )}

      {/* Category groups + sticky action bar (flex footer — avoids broken absolute positioning) */}
      {result && result.items.length > 0 && (
        <>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {Object.entries(grouped).map(([category, items]) => {
          const meta = CATEGORY_META[category] ?? {
            label: category,
            icon: <Layers size={14} />,
            color: '#8e8e93',
          }
          const categoryTotal = items.reduce((sum, i) => sum + i.size, 0)
          const allSelected = items.every(i => selected.has(i.id))

          return (
            <div key={category}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="flex items-center gap-1.5" style={{ color: meta.color }}>
                  {meta.icon}
                  <span className="text-xs font-semibold uppercase tracking-wider">{meta.label}</span>
                </div>
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-white/30">{formatBytes(categoryTotal)}</span>
                <button
                  onClick={() => {
                    const ids = items.map(i => i.id)
                    setSelected(prev => {
                      const next = new Set(prev)
                      if (allSelected) ids.forEach(id => next.delete(id))
                      else ids.forEach(id => next.add(id))
                      return next
                    })
                  }}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors ml-1"
                >
                  {allSelected ? 'Deselect' : 'Select all'}
                </button>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all ${
                      selected.has(item.id)
                        ? 'bg-accent-green/8 border-accent-green/25'
                        : 'bg-dark-700/50 border-white/5 hover:border-white/10'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                        selected.has(item.id) ? 'bg-accent-green border-accent-green' : 'border-white/20'
                      }`}
                    >
                      {selected.has(item.id) && (
                        <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
                          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Category dot */}
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{item.label}</div>
                      <div className="text-xs text-white/35 mt-0.5 flex items-center gap-1">
                        <ShieldCheck size={10} className="text-accent-green shrink-0" />
                        {item.reason}
                      </div>
                    </div>

                    {/* Size */}
                    <div className="text-sm font-semibold text-white/70 shrink-0">
                      {formatBytes(item.size)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="shrink-0 pt-3 mt-2 border-t border-white/[0.06] bg-[#1e1e1e]">
          <div className="flex items-center gap-4 mac-panel px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/50">
                {selected.size} item{selected.size !== 1 ? 's' : ''} selected
              </div>
              <div className="text-lg font-bold text-accent-green">
                Free {formatBytes(selectedTotal)}
              </div>
            </div>

            <button
              onClick={() => {
                const allIds = result.items.map(i => i.id)
                if (selected.size === allIds.length) setSelected(new Set())
                else setSelected(new Set(allIds))
              }}
              className="text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-2 shrink-0"
            >
              {selected.size === result.items.length ? 'Deselect all' : 'Select all'}
            </button>

            <button
              type="button"
              onClick={clean}
              disabled={selected.size === 0 || state === 'cleaning'}
              className="flex items-center gap-2 rounded-mac-sm px-4 py-2 text-[13px] font-semibold bg-accent-green text-white hover:brightness-110 border border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {state === 'cleaning' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Cleaning…
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Clean {formatBytes(selectedTotal)} Now
                </>
              )}
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
