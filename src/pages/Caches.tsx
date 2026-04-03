import React, { useState, useEffect, useMemo } from 'react'
import {
  Trash2, Layers, ShieldCheck, ShieldAlert,
  ChevronDown, ChevronRight, Folder, FileText,
  ExternalLink, Loader2,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ScanButton from '../components/ScanButton'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import ConfirmModal from '../components/ConfirmModal'
import DeleteSuccessModal from '../components/DeleteSuccessModal'
import InfoBanner from '../components/InfoBanner'
import { formatBytes, formatDate, formatPath, getExtColor } from '../utils/format'

interface CacheCategory {
  id: string
  name: string
  description: string
  path: string
  size: number
  safeToDelete: boolean
  icon: string
}

interface DirEntry {
  name: string
  path: string
  size: number
  isDir: boolean
  modified: string
  ext: string
}

export default function Caches() {
  const [caches, setCaches] = useState<CacheCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState<{ open: boolean; summary?: string }>({ open: false })

  // Expand state: cacheId → DirEntry[] | 'loading' | null
  const [expanded, setExpanded] = useState<Record<string, DirEntry[] | 'loading'>>({})

  async function scan() {
    setLoading(true)
    setSelected(new Set())
    setExpanded({})
    try {
      const result = await window.electronAPI.getCacheInfo()
      setCaches(result || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { scan() }, [])

  async function toggleExpand(cache: CacheCategory) {
    if (expanded[cache.id] !== undefined) {
      // Collapse
      setExpanded(prev => {
        const next = { ...prev }
        delete next[cache.id]
        return next
      })
      return
    }
    // Expand — load contents
    setExpanded(prev => ({ ...prev, [cache.id]: 'loading' }))
    try {
      const entries = await window.electronAPI.listDirContents(cache.path)
      setExpanded(prev => ({ ...prev, [cache.id]: entries }))
    } catch {
      setExpanded(prev => ({ ...prev, [cache.id]: [] }))
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectSafe() {
    setSelected(new Set(caches.filter(c => c.safeToDelete).map(c => c.id)))
  }

  const selectedCaches = caches.filter(c => selected.has(c.id))
  const totalSize = selectedCaches.reduce((sum, c) => sum + c.size, 0)

  const cacheDeleteContext = useMemo(() => {
    if (!modal) return null
    const sel = caches.filter(c => selected.has(c.id))
    if (sel.length === 0) return { aboutContains: '', aboutImpact: '', names: [] as string[] }
    if (sel.length === 1) {
      const c = sel[0]
      return {
        aboutContains: `${c.name} — ${c.description}`,
        aboutImpact: c.safeToDelete
          ? 'This folder holds cache or temp data your apps can recreate. Cleaning uses permanent delete (not Trash).'
          : 'Marked “review first” — may include archives or data worth keeping. Only continue if you checked the folder in Finder.',
        names: [c.name],
      }
    }
    return {
      aboutContains: `${sel.length} cache folders (browsers, Xcode, package managers, etc.).`,
      aboutImpact:
        'All selected folders are removed at once. Safe entries rebuild on next launch; reviewed entries might still matter to you.',
      names: sel.map(c => c.name),
    }
  }, [modal, caches, selected])
  const allTotal = caches.reduce((sum, c) => sum + c.size, 0)

  async function doClean() {
    const paths = selectedCaches.map(c => c.path)
    const n = paths.length
    const bytes = totalSize
    try {
      await window.electronAPI.deletePermanently(paths)
      setCaches(prev => prev.filter(c => !selected.has(c.id)))
      setSelected(new Set())
      setExpanded({})
      const freed = bytes > 0 ? ` About ${formatBytes(bytes)} of cache space cleared.` : ''
      setDeleteSuccess({
        open: true,
        summary: `${n} cache location${n === 1 ? '' : 's'} cleaned.${freed}`,
      })
    } catch (err) {
      console.error(err)
    }
    setModal(false)
  }

  return (
    <div className="fade-in flex flex-col h-full">
      <PageHeader
        title="Cache Cleaner"
        subtitle="Browser caches, build artifacts, and package manager caches"
        totalSize={allTotal}
        itemCount={caches.length}
      >
        <ScanButton onClick={scan} loading={loading} />
      </PageHeader>

      <InfoBanner id="caches" title="What are caches?">
        Caches are temporary files apps create to load faster. They are <strong className="text-white/60">always safe to delete</strong> —
        apps recreate them automatically on next launch. Items marked <strong className="text-white/60">"Review first"</strong> might
        contain data you want to keep (like Xcode Archives).
      </InfoBanner>

      {/* Quick actions */}
      {!loading && caches.length > 0 && (
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <button
            onClick={selectSafe}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green/15 text-accent-green text-xs font-medium hover:bg-accent-green/25 transition-all border border-accent-green/20"
          >
            <ShieldCheck size={12} /> Select Safe to Delete
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-medium hover:text-white/70 transition-all"
            >
              Clear Selection
            </button>
          )}
        </div>
      )}

      {/* Selected action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-accent-blue/10 border border-accent-blue/20 rounded-lg mb-4 shrink-0">
          <span className="text-sm text-accent-blue flex-1">
            {selected.size} selected · {formatBytes(totalSize)} to free
          </span>
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all"
          >
            <Trash2 size={12} /> Clean Selected
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {loading ? (
          <LoadingState message="Scanning cache directories..." />
        ) : caches.length === 0 ? (
          <EmptyState title="No caches found" subtitle="Your cache directories are already clean" />
        ) : (
          caches.map(cache => {
            const isExpanded = expanded[cache.id] !== undefined
            const entries = expanded[cache.id]
            const isLoadingEntries = entries === 'loading'

            return (
              <div
                key={cache.id}
                className={`rounded-xl border overflow-hidden transition-all ${
                  selected.has(cache.id)
                    ? 'border-accent-blue/30 bg-accent-blue/5'
                    : 'border-white/5 bg-dark-700/50'
                }`}
              >
                {/* Cache row */}
                <div className="flex items-center gap-3 px-4 py-4">
                  {/* Checkbox */}
                  <div
                    onClick={() => toggle(cache.id)}
                    className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
                      selected.has(cache.id) ? 'bg-accent-blue border-accent-blue' : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {selected.has(cache.id) && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(cache)}
                    className="text-white/30 hover:text-white/60 transition-colors shrink-0"
                    title={isExpanded ? 'Collapse' : 'Expand to see contents'}
                  >
                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>

                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-accent-purple/15 flex items-center justify-center shrink-0">
                    <Layers size={16} className="text-accent-purple" />
                  </div>

                  {/* Info */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => toggleExpand(cache)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{cache.name}</span>
                      {cache.safeToDelete ? (
                        <span className="flex items-center gap-1 text-[10px] text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded">
                          <ShieldCheck size={9} /> Safe
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          <ShieldAlert size={9} /> Review first
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/30 mt-0.5">{cache.description}</div>
                    <div className="text-xs text-white/20 mt-0.5 truncate">{formatPath(cache.path)}</div>
                  </div>

                  {/* Size */}
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-sm font-semibold text-white/80">{formatBytes(cache.size)}</div>
                  </div>

                  {/* Open in Finder */}
                  <button
                    onClick={() => window.electronAPI.showInFinder(cache.path)}
                    className="p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-all shrink-0"
                    title="Open in Finder"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>

                {/* Expanded contents */}
                {isExpanded && (
                  <div className="border-t border-white/5">
                    {isLoadingEntries ? (
                      <div className="flex items-center gap-2 px-6 py-4 text-white/30 text-sm">
                        <Loader2 size={14} className="animate-spin" />
                        Loading contents…
                      </div>
                    ) : (entries as DirEntry[]).length === 0 ? (
                      <div className="px-6 py-4 text-sm text-white/30 italic">
                        Directory is empty or inaccessible
                      </div>
                    ) : (
                      <div className="divide-y divide-white/3">
                        {(entries as DirEntry[]).map(entry => (
                          <div
                            key={entry.path}
                            className="flex items-center gap-3 pl-14 pr-4 py-2.5 hover:bg-white/3 group transition-colors"
                          >
                            {/* File/folder icon */}
                            <div className="shrink-0">
                              {entry.isDir ? (
                                <Folder size={14} className="text-accent-blue/60" />
                              ) : (
                                <div
                                  className="w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-bold uppercase"
                                  style={{ backgroundColor: `${getExtColor(entry.ext)}20`, color: getExtColor(entry.ext) }}
                                >
                                  {entry.ext ? entry.ext.slice(0, 2) : <FileText size={8} />}
                                </div>
                              )}
                            </div>

                            {/* Name */}
                            <span className="flex-1 text-xs text-white/60 truncate">{entry.name}</span>

                            {/* Modified */}
                            <span className="text-xs text-white/25 shrink-0 hidden group-hover:block">
                              {formatDate(entry.modified)}
                            </span>

                            {/* Size */}
                            <span className="text-xs font-medium text-white/50 shrink-0 w-16 text-right">
                              {formatBytes(entry.size)}
                            </span>

                            {/* Show in Finder */}
                            <button
                              onClick={() => window.electronAPI.showInFinder(entry.path)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-all shrink-0"
                              title="Show in Finder"
                            >
                              <ExternalLink size={11} />
                            </button>
                          </div>
                        ))}

                        {/* Summary footer */}
                        <div className="flex items-center justify-between pl-14 pr-4 py-2 bg-dark-800/50">
                          <span className="text-xs text-white/25">
                            Top {(entries as DirEntry[]).length} items by size
                          </span>
                          <button
                            onClick={() => window.electronAPI.showInFinder(cache.path)}
                            className="text-xs text-accent-blue/60 hover:text-accent-blue transition-colors"
                          >
                            Open folder in Finder →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <ConfirmModal
        open={modal}
        title="Clean Cache Files"
        message="Cache files will be permanently deleted."
        totalSize={totalSize}
        itemCount={selected.size}
        danger
        confirmLabel="Clean Now"
        aboutContains={cacheDeleteContext?.aboutContains}
        aboutImpact={cacheDeleteContext?.aboutImpact}
        selectedNames={cacheDeleteContext?.names}
        consequences={[
          'Apps rebuild caches automatically on next launch',
          'App data (logins, settings, history) is NOT affected',
          'Apps may open slightly slower the first time after cleaning',
        ]}
        restoreHint="No manual restore needed — each app recreates its cache automatically."
        onConfirm={doClean}
        onCancel={() => setModal(false)}
      />

      <DeleteSuccessModal
        open={deleteSuccess.open}
        summary={deleteSuccess.summary}
        onClose={() => setDeleteSuccess({ open: false })}
      />
    </div>
  )
}
