import React, { useState, useMemo, useEffect } from 'react'
import {
  HardDrive, RefreshCw, Zap, ChevronRight,
  Folder, FileText, ExternalLink, Loader2,
  ShieldAlert, ShieldCheck, Info,
} from 'lucide-react'
import { formatBytes, formatDate, formatPath, getExtColor, toneFill } from '../utils/format'
import ConfirmModal from '../components/ConfirmModal'
import DeleteSuccessModal from '../components/DeleteSuccessModal'
import CategoryInfoTooltip from '../components/CategoryInfoTooltip'
import HoverInfoTooltip from '../components/HoverInfoTooltip'
import InfoBanner from '../components/InfoBanner'
import { getSystemFolderHelp, defaultSystemFolderImpact } from '../data/systemFolderInfo'
import { getNestedItemHelp } from '../data/nestedPathInfo'
import { buildOverviewDrillDeleteContext } from '../utils/deleteConfirmContext'

interface DiskCategory {
  name: string
  size: number
  color: string
  path?: string
}

interface DiskInfo {
  total: number
  used: number
  free: number
  usedPercent: number
  freePercent: number
  categories: DiskCategory[]
}

interface DirEntry {
  name: string
  path: string
  size: number
  isDir: boolean
  modified: string
  ext: string
}

interface SystemEntry {
  name: string
  path: string
  size: number
  description: string
  safeToDelete: boolean
}

export default function Overview() {
  const [disk, setDisk] = useState<DiskInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanned, setScanned] = useState(false)

  const [drillCat, setDrillCat] = useState<DiskCategory | null>(null)
  const [drillPath, setDrillPath] = useState<string | null>(null)
  const [drillStack, setDrillStack] = useState<{ label: string; path: string }[]>([])
  const [drillEntries, setDrillEntries] = useState<DirEntry[]>([])
  const [systemEntries, setSystemEntries] = useState<SystemEntry[]>([])
  const [isSystemView, setIsSystemView] = useState(false)
  const [drillLoading, setDrillLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<{ open: boolean; permanent: boolean }>({ open: false, permanent: false })
  const [deleteSuccess, setDeleteSuccess] = useState<{ open: boolean; summary?: string }>({ open: false })

  async function scan(force = false) {
    setLoading(true)
    try {
      const info = await window.electronAPI.getDiskInfo(force)
      setDisk(info)
      setScanned(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Scan on first open — the blank "press scan" screen was a dead end.
  useEffect(() => { scan() }, [])

  async function openCategory(cat: DiskCategory) {
    setDrillCat(cat)
    setSelected(new Set())

    if (!cat.path) {
      setDrillPath(null)
      setDrillStack([])
      setDrillEntries([])
      setSystemEntries([])
      setIsSystemView(false)
      setDrillLoading(false)
      return
    }

    setDrillLoading(true)

    if (cat.path === '__system__') {
      setIsSystemView(true)
      setDrillStack([{ label: cat.name, path: '__system__' }])
      setDrillPath('__system__')
      try {
        const entries = await window.electronAPI.getSystemData()
        setSystemEntries(entries || [])
      } catch (err) {
        console.error(err)
        setSystemEntries([])
      } finally {
        setDrillLoading(false)
      }
    } else {
      setIsSystemView(false)
      setDrillStack([{ label: cat.name, path: cat.path }])
      setDrillPath(cat.path)
      await loadDir(cat.path)
    }
  }

  async function loadDir(dirPath: string) {
    setDrillLoading(true)
    try {
      const entries = await window.electronAPI.listDirContents(dirPath)
      setDrillEntries(entries || [])
    } catch (err) {
      console.error(err)
      setDrillEntries([])
    } finally {
      setDrillLoading(false)
    }
  }

  async function drillInto(entry: DirEntry) {
    if (!entry.isDir) return
    const newStack = [...drillStack, { label: entry.name, path: entry.path }]
    setDrillStack(newStack)
    setDrillPath(entry.path)
    setSelected(new Set())
    setIsSystemView(false)
    await loadDir(entry.path)
  }

  async function drillIntoSystem(entry: SystemEntry) {
    const newStack = [...drillStack, { label: entry.name, path: entry.path }]
    setDrillStack(newStack)
    setDrillPath(entry.path)
    setSelected(new Set())
    setIsSystemView(false)
    await loadDir(entry.path)
  }

  async function navigateTo(stackIdx: number) {
    const target = drillStack[stackIdx]
    const newStack = drillStack.slice(0, stackIdx + 1)
    setDrillStack(newStack)
    setDrillPath(target.path)
    setSelected(new Set())

    if (target.path === '__system__') {
      setIsSystemView(true)
      setDrillLoading(true)
      try {
        const entries = await window.electronAPI.getSystemData()
        setSystemEntries(entries || [])
      } finally {
        setDrillLoading(false)
      }
    } else {
      setIsSystemView(false)
      await loadDir(target.path)
    }
  }

  function closeDrill() {
    setDrillCat(null)
    setDrillPath(null)
    setDrillStack([])
    setDrillEntries([])
    setSystemEntries([])
    setIsSystemView(false)
    setSelected(new Set())
  }

  function toggleSelect(path: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  function selectAll() {
    if (isSystemView) {
      const deletable = systemEntries.filter(e => e.safeToDelete).map(e => e.path)
      setSelected(new Set(deletable))
    } else {
      setSelected(new Set(drillEntries.map(e => e.path)))
    }
  }
  function clearSel() { setSelected(new Set()) }

  const selectedEntries = drillEntries.filter(e => selected.has(e.path))
  const totalSelectedSize = selectedEntries.reduce((s, e) => s + e.size, 0)

  const drillDeleteContext = useMemo(
    () =>
      modal.open
        ? buildOverviewDrillDeleteContext(selected, drillEntries, drillCat?.name, modal.permanent)
        : null,
    [modal.open, modal.permanent, selected, drillEntries, drillCat?.name]
  )

  async function doDelete(permanent: boolean) {
    const paths = Array.from(selected)
    const n = paths.length
    const bytes = totalSelectedSize
    const perm = permanent
    try {
      if (perm) await window.electronAPI.deletePermanently(paths)
      else await window.electronAPI.moveToTrash(paths)
      setDrillEntries(prev => prev.filter(e => !selected.has(e.path)))
      setSelected(new Set())
      const freed = bytes > 0 ? ` About ${formatBytes(bytes)} cleared from this view.` : ''
      setDeleteSuccess({
        open: true,
        summary: `${n} ${n === 1 ? 'item' : 'items'} ${perm ? 'permanently removed' : 'moved to Trash'}.${freed}`,
      })
    } catch (err) { console.error(err) }
    setModal({ open: false, permanent: false })
  }

  const detailPanelOpen = Boolean(drillCat && drillPath)
  const browseUnavailable = Boolean(drillCat && !drillCat.path)

  // ── Not yet scanned ───────────────────────────────────────────────────────
  if (!scanned) {
    return (
      <div className="fade-in flex flex-col items-center justify-center h-full pb-16">
        <div className="w-[72px] h-[72px] rounded-mac bg-dark-800 border border-white/[0.08] shadow-mac-sm flex items-center justify-center mb-5">
          <HardDrive size={30} className="text-accent-blue" />
        </div>
        <h1 className="text-[22px] font-semibold text-white mb-1.5 tracking-tight">Disk Overview</h1>
        <p className="text-white/45 text-[13px] mb-8 text-center max-w-sm leading-relaxed">
          Scan your disk for a breakdown like System Settings — then click a category to browse files on the right.
        </p>
        <button
          type="button"
          onClick={() => scan(true)}
          disabled={loading}
          className="mac-btn-primary flex items-center gap-2.5 px-5 py-2.5 text-[15px] disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><RefreshCw size={17} className="animate-spin" /> Scanning… (20–30s)</>
          ) : (
            <><Zap size={17} /> Scan My Disk</>
          )}
        </button>
        {loading && <p className="text-white/30 text-[12px] mt-4">Measuring folders…</p>}
      </div>
    )
  }

  // ── Overview + right detail panel ───────────────────────────────────────
  return (
    <div className="fade-in flex flex-col h-full min-h-0 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div>
          <h1 className="text-[22px] font-semibold text-white flex items-center gap-2 tracking-tight">
            <HardDrive size={20} className="text-accent-blue" />
            Disk Overview
          </h1>
          <p className="text-[13px] text-white/45 mt-0.5">Full system storage breakdown</p>
        </div>
        <button
          type="button"
          onClick={() => scan(true)}
          disabled={loading}
          className="mac-btn-primary flex items-center gap-2 disabled:opacity-45"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Scanning…' : 'Refresh'}
        </button>
      </div>

      {disk && (
        <>
          <InfoBanner id="overview-method" title="Why these numbers differ from System Settings">
            xSpace measures the <strong className="text-white/70">real disk space each folder uses</strong> (physical
            bytes, like Finder’s Get Info). macOS System Settings instead groups storage <strong className="text-white/70">by
            file type</strong> and counts iCloud copies, so its categories and totals look different — e.g. a large
            <em> .zip</em> in Downloads shows under “Downloads” here but under “Documents” there.{' '}
            <strong className="text-white/70">System &amp; Other</strong> is everything not in a folder above
            (macOS, system caches, snapshots), so it reads higher than the “System Data” in Settings.
          </InfoBanner>

          <div className="flex gap-3 mb-5 shrink-0 items-stretch">
            <DiskRing usedPercent={disk.usedPercent} free={formatBytes(disk.free)} />
            <div className="grid grid-cols-3 gap-3 flex-1">
              <StatCard label="Total Storage" value={formatBytes(disk.total)} color="text-white" bg="bg-dark-800" />
              <StatCard label="Used" value={formatBytes(disk.used)} sub={`${disk.usedPercent}% of total`} color="text-accent-blue" bg="bg-dark-800" />
              <StatCard label="Available" value={formatBytes(disk.free)} sub={`${disk.freePercent}% of total`} color="text-white/70" bg="bg-dark-800" />
            </div>
          </div>

          <div className="mac-panel p-4 mb-5 shrink-0">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] text-white/55">Storage Usage</span>
              <span className="text-[13px] font-semibold text-white tabular-nums">{disk.usedPercent}%</span>
            </div>
            <div className="h-3.5 bg-dark-900 rounded-full overflow-hidden flex gap-px">
              {disk.categories.map((cat, i) => (
                <div
                  key={i}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-700 cursor-pointer hover:opacity-85"
                  style={{
                    width: `${(cat.size / disk.total) * 100}%`,
                    backgroundColor: cat.color,
                    minWidth: cat.size / disk.total > 0.01 ? 2 : 0,
                  }}
                  title={`${cat.name}: ${formatBytes(cat.size)}`}
                  onClick={() => openCategory(cat)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2.5">
              {disk.categories
                .slice()
                .sort((a, b) => b.size - a.size)
                .map(cat => (
                  <button
                    key={cat.name}
                    type="button"
                    className="mac-focus flex items-center gap-1.5 text-[11px] text-white/55 hover:text-white/85 rounded-mac-sm px-1 -mx-1"
                    onClick={() => openCategory(cat)}
                    title={`${cat.name} · ${formatBytes(cat.size)}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span>{cat.name}</span>
                    <span className="text-white/40 tabular-nums">{formatBytes(cat.size)}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Bottom: category list | detail panel */}
          <div className="flex flex-1 min-h-0 gap-4 items-stretch" style={{ minHeight: 'min(520px, calc(100dvh - 22rem))' }}>
            <div className="min-w-0 flex-1 max-w-[420px] overflow-y-auto pr-1">
              <div className="mac-panel p-4 h-fit">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[12px] font-semibold text-white/45 uppercase tracking-wide">By Category</h3>
                  <span className="text-[10px] text-white/30">Click row →</span>
                </div>
                <div className="space-y-1.5">
                  {disk.categories
                    .slice()
                    .sort((a, b) => b.size - a.size)
                    .map(cat => {
                      const active = drillCat?.name === cat.name
                      return (
                        <div
                          key={cat.name}
                          className={`flex items-stretch rounded-mac-sm transition-colors border ${
                            active
                              ? 'bg-accent-blue/14 border-accent-blue/35'
                              : 'border-transparent hover:bg-white/[0.06] hover:border-white/[0.06]'
                          }`}
                        >
                          <button
                            type="button"
                            className="flex-1 min-w-0 text-left px-2 py-1.5"
                            onClick={() => openCategory(cat)}
                          >
                            <div className="flex justify-between items-center mb-0.5 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                <span className="text-[13px] text-white/80 truncate">{cat.name}</span>
                                <ChevronRight size={11} className="text-white/25 shrink-0" />
                              </div>
                              <span className="text-[13px] font-medium text-white tabular-nums shrink-0">{formatBytes(cat.size)}</span>
                            </div>
                            <div className="h-1 bg-dark-900 rounded-full overflow-hidden ml-4">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${(cat.size / disk.used) * 100}%`,
                                  backgroundColor: cat.color,
                                  opacity: 0.75,
                                }}
                              />
                            </div>
                          </button>
                          <div className="flex items-start pt-1 pr-1 shrink-0">
                            <CategoryInfoTooltip categoryName={cat.name} />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>

            {/* Right: files & folders for selected category */}
            <div className="flex-1 min-w-[280px] mac-panel flex flex-col min-h-0 overflow-hidden border-l border-mac-separator">
              {!drillCat && (
                <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-12">
                  <div className="w-14 h-14 rounded-full bg-dark-900 border border-white/[0.06] flex items-center justify-center mb-3">
                    <Folder size={26} className="text-white/25" />
                  </div>
                  <p className="text-[14px] font-medium text-white/55">Contents</p>
                  <p className="text-[12px] text-white/35 mt-1.5 max-w-[220px] leading-relaxed">
                    Select a category on the left to see the largest folders and files here.
                  </p>
                </div>
              )}

              {browseUnavailable && (
                <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-8">
                  <HardDrive size={28} className="text-white/25 mb-3" />
                  <p className="text-[13px] text-white/55 font-medium">{drillCat?.name}</p>
                  <p className="text-[12px] text-white/35 mt-2 max-w-[260px] leading-relaxed">
                    This slice can’t be opened as a single folder. Use other categories or Large Files to clean user data.
                  </p>
                </div>
              )}

              {detailPanelOpen && drillCat && (
                <>
                  <div className="shrink-0 px-3 py-2.5 border-b border-mac-separator flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={closeDrill}
                      className="text-[12px] text-white/45 hover:text-white/80 px-1.5 py-0.5 rounded-mac-sm hover:bg-white/[0.06]"
                    >
                      Clear
                    </button>
                    <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto no-drag">
                      {drillStack.map((crumb, i) => (
                        <React.Fragment key={`${crumb.path}-${i}`}>
                          {i > 0 && <ChevronRight size={10} className="text-white/20 shrink-0 mx-0.5" />}
                          <button
                            type="button"
                            onClick={() => i < drillStack.length - 1 ? navigateTo(i) : undefined}
                            className={`text-[11px] truncate max-w-[100px] shrink-0 ${
                              i === drillStack.length - 1
                                ? 'text-white/85 font-medium'
                                : 'text-white/40 hover:text-white/70'
                            }`}
                          >
                            {crumb.label}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: drillCat.color }} />
                      <span className="text-[11px] text-white/40 tabular-nums">{formatBytes(drillCat.size)}</span>
                    </div>
                    {!isSystemView && drillPath && drillPath !== '__system__' && (
                      <>
                        <button type="button" onClick={selectAll} className="text-[11px] text-accent-blue hover:underline px-1">All</button>
                        <button
                          type="button"
                          onClick={() => window.electronAPI.showInFinder(drillPath)}
                          className="text-[11px] text-white/45 hover:text-white/75 flex items-center gap-0.5"
                        >
                          <ExternalLink size={11} /> Finder
                        </button>
                      </>
                    )}
                    {isSystemView && (
                      <button type="button" onClick={selectAll} className="text-[11px] text-accent-blue hover:underline px-1">Safe only</button>
                    )}
                  </div>

                  {selected.size > 0 && !isSystemView && (
                    <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-accent-blue/10 border-b border-accent-blue/15 flex-wrap">
                      <span className="text-[11px] text-accent-blue flex-1 min-w-0">
                        {selected.size} · {formatBytes(totalSelectedSize)}
                      </span>
                      <button type="button" onClick={clearSel} className="text-[11px] text-white/45">Clear</button>
                      <button
                        type="button"
                        onClick={() => setModal({ open: true, permanent: false })}
                        className="text-[11px] px-2 py-1 rounded-mac-sm bg-amber-500/20 text-amber-300"
                      >
                        Trash
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ open: true, permanent: true })}
                        className="text-[11px] px-2 py-1 rounded-mac-sm bg-accent-red/20 text-accent-red"
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto min-h-0 p-2">
                    {isSystemView ? (
                      drillLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2">
                          <Loader2 size={22} className="animate-spin text-white/30" />
                          <span className="text-[12px] text-white/35">Scanning system folders…</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-2 px-2 py-2 mb-2 rounded-mac-sm bg-amber-500/8 border border-amber-500/15">
                            <Info size={12} className="text-amber-400/80 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-white/45 leading-relaxed">
                              <strong className="text-white/65">System Data</strong> spans many protected paths. Open a row to browse; only Core Dumps are safe to delete.
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            {systemEntries.map(entry => {
                              const sysHelp = getSystemFolderHelp(entry.path)
                              return (
                                <div
                                  key={entry.path}
                                  role="button"
                                  tabIndex={0}
                                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-mac-sm border border-white/[0.06] bg-dark-900/40 hover:bg-dark-800 cursor-pointer group"
                                  onClick={() => drillIntoSystem(entry)}
                                  onKeyDown={e => e.key === 'Enter' && drillIntoSystem(entry)}
                                >
                                  <div
                                    className="w-8 h-8 rounded-mac-sm flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: toneFill(0.08) }}
                                  >
                                    {entry.safeToDelete
                                      ? <ShieldCheck size={14} className="text-accent-green" />
                                      : <ShieldAlert size={14} style={{ color: drillCat.color }} />
                                    }
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[12px] font-medium text-white/90 truncate">{entry.name}</span>
                                      <ChevronRight size={11} className="text-white/20 shrink-0" />
                                    </div>
                                    <div className="text-[10px] text-white/35 truncate">{entry.path}</div>
                                  </div>
                                  <span className="text-[12px] font-semibold tabular-nums shrink-0" style={{ color: drillCat.color }}>
                                    {formatBytes(entry.size)}
                                  </span>
                                  <HoverInfoTooltip
                                    ariaLabel={entry.name}
                                    whatInside={sysHelp?.contains ?? entry.description}
                                    ifYouDelete={sysHelp?.impact ?? defaultSystemFolderImpact(entry.safeToDelete)}
                                    iconSize={13}
                                    className="text-white/35"
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Show ${entry.name} in Finder`}
                                    title="Show in Finder"
                                    className="mac-focus p-1 rounded-mac-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white/10 text-white/40"
                                    onClick={e => { e.stopPropagation(); window.electronAPI.showInFinder(entry.path) }}
                                  >
                                    <ExternalLink size={12} />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )
                    ) : (
                      drillLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2">
                          <Loader2 size={22} className="animate-spin text-white/30" />
                          <span className="text-[12px] text-white/35">Loading…</span>
                        </div>
                      ) : drillEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Folder size={22} className="text-white/20 mb-2" />
                          <span className="text-[12px] text-white/35">Empty or not accessible</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {drillEntries.map(entry => {
                            const isSelected = selected.has(entry.path)
                            const color = entry.isDir ? drillCat.color : getExtColor(entry.ext)
                            const nestedHelp = getNestedItemHelp(entry.path, entry.name, entry.isDir, drillCat.name)
                            return (
                              <div
                                key={entry.path}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-mac-sm border transition-colors group ${
                                  isSelected
                                    ? 'bg-accent-blue/12 border-accent-blue/30'
                                    : 'border-transparent hover:bg-white/[0.05] hover:border-white/[0.06]'
                                }`}
                              >
                                <div
                                  role="checkbox"
                                  aria-checked={isSelected}
                                  className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center cursor-pointer ${
                                    isSelected ? 'bg-accent-blue border-accent-blue' : 'border-white/25'
                                  }`}
                                  onClick={() => toggleSelect(entry.path)}
                                >
                                  {isSelected && (
                                    <svg viewBox="0 0 10 8" className="w-2 h-2">
                                      <path d="M1 4l2.5 2.5L9 1" stroke="rgb(var(--bg))" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <div
                                  className="w-7 h-7 rounded-mac-sm flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: toneFill(0.08) }}
                                >
                                  {entry.isDir
                                    ? <Folder size={13} style={{ color }} />
                                    : <FileText size={13} style={{ color }} />
                                  }
                                </div>
                                <div
                                  className="flex-1 min-w-0 cursor-pointer py-0.5"
                                  onClick={() => entry.isDir ? drillInto(entry) : toggleSelect(entry.path)}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className="text-[12px] font-medium text-white/90 truncate">{entry.name}</span>
                                    {entry.isDir && <ChevronRight size={10} className="text-white/25 shrink-0" />}
                                  </div>
                                  <div className="text-[10px] text-white/35 truncate">{formatPath(entry.path)}</div>
                                </div>
                                <span className="text-[11px] font-semibold text-white/65 tabular-nums shrink-0">
                                  {entry.size > 0 ? formatBytes(entry.size) : '—'}
                                </span>
                                <HoverInfoTooltip
                                  ariaLabel={entry.name}
                                  whatInside={nestedHelp.contains}
                                  ifYouDelete={nestedHelp.impact}
                                  iconSize={12}
                                  className="text-white/35"
                                />
                                <button
                                  type="button"
                                  aria-label={`Show ${entry.name} in Finder`}
                                  title="Show in Finder"
                                  className="mac-focus p-1 rounded-mac-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white/10 text-white/35"
                                  onClick={e => { e.stopPropagation(); window.electronAPI.showInFinder(entry.path) }}
                                >
                                  <ExternalLink size={11} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={modal.open}
        title={modal.permanent ? 'Delete Permanently' : 'Move to Trash'}
        message={modal.permanent
          ? `${selected.size} item${selected.size !== 1 ? 's' : ''} will be permanently deleted.`
          : `${selected.size} item${selected.size !== 1 ? 's' : ''} will be moved to Trash.`}
        totalSize={totalSelectedSize}
        itemCount={selected.size}
        danger={modal.permanent}
        confirmLabel={modal.permanent ? 'Delete Permanently' : 'Move to Trash'}
        aboutContains={drillDeleteContext?.aboutContains}
        aboutImpact={drillDeleteContext?.aboutImpact}
        selectedNames={drillDeleteContext?.names}
        consequences={modal.permanent
          ? ['Cannot be recovered after this', 'Make sure you reviewed these items']
          : ['Goes to Trash — nothing is lost yet', 'Open Trash and click "Put Back" to undo']}
        restoreHint={modal.permanent ? undefined : 'Tip: Move to Trash is always reversible.'}
        onConfirm={() => doDelete(modal.permanent)}
        onCancel={() => setModal({ open: false, permanent: false })}
      />

      <DeleteSuccessModal
        open={deleteSuccess.open}
        summary={deleteSuccess.summary}
        onClose={() => setDeleteSuccess({ open: false })}
      />
    </div>
  )
}

function StatCard({ label, value, sub, color, bg }: {
  label: string; value: string; sub?: string; color: string; bg: string
}) {
  return (
    <div className={`${bg} rounded-mac p-3.5 border border-white/[0.06] shadow-mac-sm`}>
      <div className="text-[11px] text-white/40 font-medium uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-white/35 mt-0.5">{sub}</div>}
    </div>
  )
}

/** Compact donut — used share of the disk, drawn with the single accent tone. */
function DiskRing({ usedPercent, free }: { usedPercent: number; free: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, usedPercent))

  return (
    <div className="mac-panel px-4 py-3 flex items-center gap-3.5 shrink-0">
      <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0 -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgb(var(--fg) / 0.10)" strokeWidth="9" />
        <circle
          cx="42" cy="42" r={r} fill="none"
          stroke="rgb(var(--fg) / 0.85)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          style={{ transition: 'stroke-dasharray 0.7s ease' }}
        />
      </svg>
      <div className="min-w-0">
        <div className="text-[24px] font-semibold text-white tabular-nums leading-none">{pct}%</div>
        <div className="text-[11px] text-white/40 uppercase tracking-wide mt-1">Disk used</div>
        <div className="text-[12px] text-white/55 mt-1.5 whitespace-nowrap">{free} free</div>
      </div>
    </div>
  )
}
