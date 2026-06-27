import React, { useState, useEffect, useMemo } from 'react'
import { AppWindow, Trash2, ExternalLink, Search, Loader2, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ScanButton from '../components/ScanButton'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import ConfirmModal from '../components/ConfirmModal'
import DeleteSuccessModal from '../components/DeleteSuccessModal'
import InfoBanner from '../components/InfoBanner'
import { formatBytes, formatDate, formatPath } from '../utils/format'

interface InstalledApp {
  name: string
  path: string
  bundleId: string
  size: number
  modified: string
  location: 'system-apps' | 'user-apps'
}

interface LeftoverItem {
  path: string
  size: number
  category: string
}

export default function Apps() {
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [target, setTarget] = useState<InstalledApp | null>(null)
  const [leftovers, setLeftovers] = useState<LeftoverItem[]>([])
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState<{ open: boolean; summary?: string }>({ open: false })

  async function scan() {
    setLoading(true)
    setError(null)
    try {
      if (typeof window.electronAPI?.getInstalledApps !== 'function') {
        throw new Error(
          'The Uninstaller’s background service isn’t loaded. Fully quit xSpace (⌘Q) and run “npm run dev” again — a Vite reload alone doesn’t reload Electron.',
        )
      }
      const result = await window.electronAPI.getInstalledApps()
      setApps(result || [])
      if (!result || result.length === 0) {
        setError('No apps found in /Applications or ~/Applications. If you have apps there, try Rescan.')
      }
    } catch (err: any) {
      console.error(err)
      setApps([])
      setError(err?.message || 'Could not load installed apps.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { scan() }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return apps
    return apps.filter(a => a.name.toLowerCase().includes(q) || a.bundleId.toLowerCase().includes(q))
  }, [apps, query])

  const totalSize = apps.reduce((s, a) => s + a.size, 0)
  const leftoverSize = leftovers.reduce((s, l) => s + l.size, 0)
  const removeTotal = (target?.size ?? 0) + leftoverSize

  async function startUninstall(app: InstalledApp) {
    setBusyPath(app.path)
    try {
      const found = await window.electronAPI.findAppLeftovers(app.path, app.bundleId, app.name)
      setLeftovers(found || [])
    } catch {
      setLeftovers([])
    } finally {
      setBusyPath(null)
    }
    setTarget(app)
    setModalOpen(true)
  }

  async function confirmUninstall() {
    if (!target) return
    const paths = [target.path, ...leftovers.map(l => l.path)]
    const bytes = removeTotal
    const appName = target.name
    const leftCount = leftovers.length
    setModalOpen(false)
    try {
      const res = await window.electronAPI.moveToTrash(paths)
      setApps(prev => prev.filter(a => a.path !== target.path))
      const failed = res.errors?.length ?? 0
      const freed = bytes > 0 ? ` About ${formatBytes(bytes)} moved to Trash.` : ''
      const extra = leftCount > 0 ? ` plus ${leftCount} support item${leftCount === 1 ? '' : 's'}` : ''
      setDeleteSuccess({
        open: true,
        summary: failed > 0
          ? `${appName} removed, but ${failed} item${failed === 1 ? '' : 's'} could not be moved (may need admin).${freed}`
          : `${appName}${extra} moved to Trash.${freed}`,
      })
    } catch (err) {
      console.error(err)
    }
    setTarget(null)
    setLeftovers([])
  }

  const modalNames = target
    ? [`${target.name}.app`, ...leftovers.map(l => `${l.category}: ${l.path.split('/').pop()}`)]
    : []

  return (
    <div className="fade-in flex flex-col h-full">
      <PageHeader
        title="Uninstaller"
        subtitle="Remove apps completely — bundle plus the files they leave behind"
        totalSize={totalSize}
        itemCount={apps.length}
      >
        <ScanButton onClick={scan} loading={loading} label="Rescan" />
      </PageHeader>

      <InfoBanner id="uninstaller" title="Why use the Uninstaller">
        Dragging an app to the Trash leaves its <strong className="text-white/60">caches, preferences, containers,
        and support files</strong> behind — often hundreds of MB per app. This finds those leftovers by the app’s
        bundle id and removes them together. Everything goes to <strong className="text-white/60">Trash</strong>, so
        it’s reversible until you empty it. Apps in <em>/Applications</em> may ask for your password.
      </InfoBanner>

      {!loading && error && (
        <div className="flex items-start gap-2.5 px-4 py-3 mb-4 rounded-mac-sm border border-accent-orange/35 bg-accent-orange/[0.08] shrink-0">
          <AlertTriangle size={15} className="text-accent-orange shrink-0 mt-0.5" />
          <p className="text-[13px] text-amber-100/90 leading-relaxed">{error}</p>
        </div>
      )}

      {/* Search */}
      {!loading && apps.length > 0 && (
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-[320px] px-3 py-1.5 rounded-mac-sm bg-dark-800 border border-white/[0.08] focus-within:border-accent-blue/40">
            <Search size={14} className="text-white/35 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search apps…"
              className="bg-transparent outline-none text-[13px] text-white/85 placeholder:text-white/30 w-full"
            />
          </div>
          <span className="text-[12px] text-white/40">{filtered.length} of {apps.length}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {loading ? (
          <LoadingState message="Scanning installed apps…" rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<AppWindow size={24} className="text-accent-green" />}
            title={apps.length === 0 ? 'No apps found' : 'No matches'}
            subtitle={apps.length === 0 ? 'Nothing in /Applications or ~/Applications' : 'Try a different search'}
          />
        ) : (
          filtered.map(app => (
            <div
              key={app.path}
              className="flex items-center gap-3 px-4 py-3 rounded-mac-sm border bg-dark-800/80 border-white/[0.06] hover:border-white/[0.1] group transition-colors"
            >
              <div className="w-9 h-9 rounded-mac-sm bg-accent-blue/15 flex items-center justify-center shrink-0 text-accent-blue font-semibold text-[15px] uppercase">
                {app.name.slice(0, 1) || <AppWindow size={16} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-white truncate">{app.name}</span>
                  {app.location === 'user-apps' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/45 shrink-0">~/Applications</span>
                  )}
                </div>
                <div className="text-[11px] text-white/40 truncate mt-0.5 font-mono">
                  {app.bundleId || formatPath(app.path)}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[13px] font-semibold text-white/80 tabular-nums">{formatBytes(app.size)}</div>
                {app.modified && <div className="text-[11px] text-white/35">{formatDate(app.modified)}</div>}
              </div>

              <button
                type="button"
                aria-label={`Show ${app.name} in Finder`}
                title="Show in Finder"
                className="mac-focus p-1.5 rounded-mac-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white/10 text-white/40 shrink-0"
                onClick={() => window.electronAPI.showInFinder(app.path)}
              >
                <ExternalLink size={14} />
              </button>

              <button
                type="button"
                onClick={() => startUninstall(app)}
                disabled={busyPath === app.path}
                className="mac-focus flex items-center gap-1.5 px-3 py-1.5 rounded-mac-sm bg-accent-red/15 text-accent-red text-[12px] font-medium hover:bg-accent-red/25 transition-colors shrink-0 disabled:opacity-50"
              >
                {busyPath === app.path
                  ? <><Loader2 size={12} className="animate-spin" /> Scanning…</>
                  : <><Trash2 size={12} /> Uninstall</>
                }
              </button>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        open={modalOpen}
        title={target ? `Uninstall ${target.name}?` : 'Uninstall'}
        message={target
          ? `The app bundle and ${leftovers.length} leftover file${leftovers.length === 1 ? '' : 's'} will be moved to Trash.`
          : ''}
        totalSize={removeTotal}
        itemCount={1 + leftovers.length}
        confirmLabel="Move to Trash"
        aboutContains={target
          ? `${target.name}${target.bundleId ? ` (${target.bundleId})` : ''} plus ${leftovers.length} support item${leftovers.length === 1 ? '' : 's'} it left in your Library — caches, preferences, containers, and app support.`
          : undefined}
        aboutImpact="Everything moves to Trash, so you can Put Back from Finder until you empty it. Reinstalling the app will start it fresh."
        selectedNames={modalNames}
        consequences={[
          'The app bundle is moved to Trash',
          'Its leftover caches, preferences, and support files go too',
          'Reversible from Finder until you empty Trash',
        ]}
        restoreHint="Tip: open Trash → right-click → Put Back to fully restore the app and its data."
        onConfirm={confirmUninstall}
        onCancel={() => { setModalOpen(false); setTarget(null); setLeftovers([]) }}
      />

      <DeleteSuccessModal
        open={deleteSuccess.open}
        title="App removed"
        summary={deleteSuccess.summary}
        onClose={() => setDeleteSuccess({ open: false })}
      />
    </div>
  )
}
