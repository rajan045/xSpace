import React, { useState, useEffect, useMemo } from 'react'
import { Smartphone, Trash2, HardDrive, ExternalLink } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ScanButton from '../components/ScanButton'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import ConfirmModal from '../components/ConfirmModal'
import DeleteSuccessModal from '../components/DeleteSuccessModal'
import InfoBanner from '../components/InfoBanner'
import { formatBytes, formatDate, formatPath } from '../utils/format'

interface SimulatorDevice {
  udid: string
  name: string
  runtime: string
  state: string
  size: number
  path: string
}

interface DerivedDataEntry {
  name: string
  path: string
  size: number
  modified: string
}

interface IOSDataInfo {
  simulators: SimulatorDevice[]
  derivedData: DerivedDataEntry[]
  totalSimulatorSize: number
  totalDerivedDataSize: number
  xcodeArchivesSize: number
  iosDeviceBackupsSize: number
}

type Tab = 'simulators' | 'derived' | 'summary'

export default function IOSData() {
  const [info, setInfo] = useState<IOSDataInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('summary')
  const [selectedSims, setSelectedSims] = useState<Set<string>>(new Set())
  const [selectedDerived, setSelectedDerived] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<{ open: boolean; type: 'sims' | 'derived' | null }>({ open: false, type: null })
  const [deleteSuccess, setDeleteSuccess] = useState<{ open: boolean; summary?: string; title?: string }>({
    open: false,
  })

  async function scan() {
    setLoading(true)
    setSelectedSims(new Set())
    setSelectedDerived(new Set())
    try {
      const data = await window.electronAPI.getIOSData()
      setInfo(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { scan() }, [])

  const totalSize = info
    ? info.totalSimulatorSize + info.totalDerivedDataSize + info.xcodeArchivesSize
    : 0

  function toggleSim(udid: string) {
    setSelectedSims(prev => {
      const next = new Set(prev)
      next.has(udid) ? next.delete(udid) : next.add(udid)
      return next
    })
  }

  function toggleDerived(path: string) {
    setSelectedDerived(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const selectedSimPaths = info?.simulators.filter(s => selectedSims.has(s.udid)).map(s => s.path) || []
  const selectedSimSize = info?.simulators.filter(s => selectedSims.has(s.udid)).reduce((sum, s) => sum + s.size, 0) || 0
  const selectedDerivedPaths = Array.from(selectedDerived)
  const selectedDerivedSize = info?.derivedData.filter(d => selectedDerived.has(d.path)).reduce((sum, d) => sum + d.size, 0) || 0

  async function doDelete() {
    const kind = modal.type
    if (!kind) {
      setModal({ open: false, type: null })
      return
    }
    const paths = kind === 'sims' ? selectedSimPaths : selectedDerivedPaths
    const n = kind === 'sims' ? selectedSims.size : selectedDerived.size
    const bytes = kind === 'sims' ? selectedSimSize : selectedDerivedSize
    try {
      await window.electronAPI.deletePermanently(paths)
      if (kind === 'sims') {
        setInfo(prev => prev ? {
          ...prev,
          simulators: prev.simulators.filter(s => !selectedSims.has(s.udid)),
          totalSimulatorSize: prev.totalSimulatorSize - selectedSimSize,
        } : null)
        setSelectedSims(new Set())
      } else if (kind === 'derived') {
        setInfo(prev => prev ? {
          ...prev,
          derivedData: prev.derivedData.filter(d => !selectedDerived.has(d.path)),
          totalDerivedDataSize: prev.totalDerivedDataSize - selectedDerivedSize,
        } : null)
        setSelectedDerived(new Set())
      }
      const freed = bytes > 0 ? ` About ${formatBytes(bytes)} cleared.` : ''
      if (kind === 'sims') {
        setDeleteSuccess({
          open: true,
          title: 'Simulator data removed',
          summary: `${n} simulator${n === 1 ? '' : 's'} cleaned.${freed}`,
        })
      } else if (kind === 'derived') {
        setDeleteSuccess({
          open: true,
          title: 'Derived data removed',
          summary: `${n} derived data folder${n === 1 ? '' : 's'} removed.${freed}`,
        })
      }
    } catch (err) {
      console.error(err)
    }
    setModal({ open: false, type: null })
  }

  const iosDeleteContext = useMemo(() => {
    if (!modal.open || !info) return null
    if (modal.type === 'sims') {
      const sels = info.simulators.filter(s => selectedSims.has(s.udid))
      const names = sels.map(s => s.name)
      if (sels.length === 0) return { aboutContains: '', aboutImpact: '', names: [] as string[] }
      if (sels.length === 1) {
        const s = sels[0]
        return {
          aboutContains: `${s.name} — simulator data (${s.runtime}, state: ${s.state}).`,
          aboutImpact:
            'Removes apps and data inside that simulator. Xcode can add the device again; large runtimes may need re-downloading.',
          names,
        }
      }
      return {
        aboutContains: `${sels.length} simulator data bundles (apps, settings, and files inside those simulators).`,
        aboutImpact:
          'Each selected simulator is wiped. You may need to re-download runtimes or reinstall test apps.',
        names,
      }
    }
    if (modal.type === 'derived') {
      const sels = info.derivedData.filter(d => selectedDerived.has(d.path))
      const names = sels.map(d => d.name)
      if (sels.length === 0) return { aboutContains: '', aboutImpact: '', names: [] as string[] }
      if (sels.length === 1) {
        const d = sels[0]
        return {
          aboutContains: `${d.name} — Xcode derived data (build products, indexes) at ${formatPath(d.path)}.`,
          aboutImpact: 'Next build takes longer while Xcode regenerates indexes and intermediates. No source loss.',
          names,
        }
      }
      return {
        aboutContains: `${sels.length} derived data folders (build artifacts and caches for Xcode projects).`,
        aboutImpact: 'All selected folders are removed. Open a project and build — Xcode recreates what it needs.',
        names,
      }
    }
    return null
  }, [modal.open, modal.type, info, selectedSims, selectedDerived])

  const TABS: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'simulators', label: `Simulators (${info?.simulators.length || 0})` },
    { id: 'derived', label: `Derived Data (${info?.derivedData.length || 0})` },
  ]

  return (
    <div className="fade-in flex flex-col h-full">
      <PageHeader
        title="iOS & Xcode"
        subtitle="Simulator data, derived data, and Xcode artifacts"
        totalSize={totalSize}
      >
        <ScanButton onClick={scan} loading={loading} />
      </PageHeader>

      <InfoBanner id="ios-xcode" title="What is Xcode data?">
        <strong className="text-white/60">Simulators</strong> are virtual iPhones/iPads. Deleting them removes the device data — Xcode can recreate them.
        <strong className="text-white/60"> Derived Data</strong> is a build cache — always safe to delete, Xcode rebuilds it on next build (takes a few extra minutes).
        <strong className="text-white/60"> Archives</strong> are old app releases — review before deleting if you need to re-submit to App Store.
        <strong className="text-white/60"> Device Backups</strong> contain your real iPhone/iPad data — do not delete unless you have another backup.
      </InfoBanner>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-dark-700 border border-white/5 rounded-lg p-0.5 mb-4 self-start shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <LoadingState message="Scanning Xcode and simulator data..." rows={5} />
        ) : !info ? null : (

          <>
            {/* Summary tab */}
            {tab === 'summary' && (
              <div className="space-y-3 fade-in">
                <SummaryCard
                  label="iOS Simulators"
                  size={info.totalSimulatorSize}
                  description={`${info.simulators.length} simulator devices`}
                  color="#06b6d4"
                  onClean={info.simulators.length > 0 ? () => {
                    setSelectedSims(new Set(info.simulators.map(s => s.udid)))
                    setTab('simulators')
                  } : undefined}
                />
                <SummaryCard
                  label="Xcode Derived Data"
                  size={info.totalDerivedDataSize}
                  description={`${info.derivedData.length} projects`}
                  color="#8b5cf6"
                  onClean={info.derivedData.length > 0 ? () => {
                    setSelectedDerived(new Set(info.derivedData.map(d => d.path)))
                    setTab('derived')
                  } : undefined}
                />
                <SummaryCard
                  label="Xcode Archives"
                  size={info.xcodeArchivesSize}
                  description="Old app archives (review before deleting)"
                  color="#f59e0b"
                />
                <SummaryCard
                  label="iOS Device Backups"
                  size={info.iosDeviceBackupsSize}
                  description="iPhone/iPad backups (review before deleting)"
                  color="#ef4444"
                />
                {totalSize === 0 && (
                  <EmptyState
                    icon={<Smartphone size={24} className="text-accent-green" />}
                    title="No Xcode data found"
                    subtitle="Xcode or iOS simulators are not installed"
                  />
                )}
              </div>
            )}

            {/* Simulators tab */}
            {tab === 'simulators' && (
              <div className="space-y-2 fade-in">
                {selectedSims.size > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg mb-2 shrink-0">
                    <span className="text-sm text-red-400 flex-1">
                      {selectedSims.size} selected · {formatBytes(selectedSimSize)}
                    </span>
                    <button onClick={() => setSelectedSims(new Set())} className="text-xs text-white/40">Clear</button>
                    <button
                      onClick={() => setModal({ open: true, type: 'sims' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium"
                    >
                      <Trash2 size={12} /> Delete Selected
                    </button>
                  </div>
                )}
                {info.simulators.length === 0 ? (
                  <EmptyState title="No simulators found" subtitle="Xcode simulators are not installed" />
                ) : (
                  info.simulators.map(sim => (
                    <div
                      key={sim.udid}
                      onClick={() => toggleSim(sim.udid)}
                      className={`flex items-center gap-4 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                        selectedSims.has(sim.udid)
                          ? 'bg-red-500/10 border-red-500/20'
                          : 'bg-dark-700/50 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                        selectedSims.has(sim.udid) ? 'bg-red-500 border-red-500' : 'border-white/20'
                      }`}>
                        {selectedSims.has(sim.udid) && (
                          <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
                            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-accent-cyan/15 flex items-center justify-center">
                        <Smartphone size={16} className="text-accent-cyan" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{sim.name}</div>
                        <div className="text-xs text-white/30">{sim.runtime}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        sim.state === 'Booted' ? 'bg-accent-green/15 text-accent-green' : 'bg-white/5 text-white/30'
                      }`}>
                        {sim.state}
                      </span>
                      <div className="text-sm font-semibold text-white/70 shrink-0">{formatBytes(sim.size)}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Derived data tab */}
            {tab === 'derived' && (
              <div className="space-y-2 fade-in">
                {selectedDerived.size > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg mb-2 shrink-0">
                    <span className="text-sm text-red-400 flex-1">
                      {selectedDerived.size} selected · {formatBytes(selectedDerivedSize)}
                    </span>
                    <button onClick={() => setSelectedDerived(new Set())} className="text-xs text-white/40">Clear</button>
                    <button
                      onClick={() => setModal({ open: true, type: 'derived' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium"
                    >
                      <Trash2 size={12} /> Delete Selected
                    </button>
                  </div>
                )}
                {info.derivedData.length === 0 ? (
                  <EmptyState title="No derived data found" subtitle="Xcode derived data directory is empty" />
                ) : (
                  info.derivedData.map(entry => (
                    <div
                      key={entry.path}
                      onClick={() => toggleDerived(entry.path)}
                      className={`flex items-center gap-4 px-4 py-3 rounded-lg border cursor-pointer transition-all group ${
                        selectedDerived.has(entry.path)
                          ? 'bg-red-500/10 border-red-500/20'
                          : 'bg-dark-700/50 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                        selectedDerived.has(entry.path) ? 'bg-red-500 border-red-500' : 'border-white/20'
                      }`}>
                        {selectedDerived.has(entry.path) && (
                          <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
                            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-accent-purple/15 flex items-center justify-center">
                        <HardDrive size={16} className="text-accent-purple" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{entry.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-green/12 text-accent-green shrink-0 font-medium">Auto-rebuild</span>
                        </div>
                        <div className="text-xs text-white/30 truncate">{formatPath(entry.path)}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#10b98170' }}>↪ Xcode rebuilds this on next build — no data loss</div>
                      </div>
                      <div className="text-sm font-semibold text-white/70 shrink-0">{formatBytes(entry.size)}</div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-white/10 text-white/40 shrink-0"
                        onClick={e => { e.stopPropagation(); window.electronAPI.showInFinder(entry.path) }}
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        open={modal.open}
        title={modal.type === 'sims' ? 'Delete Simulator Data' : 'Delete Derived Data'}
        message={modal.type === 'sims'
          ? 'Simulator device data will be permanently deleted.'
          : 'Xcode derived data will be permanently deleted.'}
        totalSize={modal.type === 'sims' ? selectedSimSize : selectedDerivedSize}
        itemCount={modal.type === 'sims' ? selectedSims.size : selectedDerived.size}
        danger
        confirmLabel={modal.type === 'sims' ? 'Delete Simulators' : 'Delete Derived Data'}
        aboutContains={iosDeleteContext?.aboutContains}
        aboutImpact={iosDeleteContext?.aboutImpact}
        selectedNames={iosDeleteContext?.names}
        consequences={modal.type === 'sims'
          ? ['Simulator device data is removed', 'Xcode can recreate simulators from scratch', 'May need to re-download simulator runtimes (~2–4 GB)']
          : ['Derived data is removed — no source code is affected', 'Xcode rebuilds it on next build (5–10 min longer)', 'Fully automatic — nothing to reinstall']}
        restoreHint={modal.type === 'sims'
          ? 'To restore: open Xcode → Window → Devices and Simulators → add device.'
          : 'To restore: just open your project in Xcode and build — it rebuilds automatically.'}
        onConfirm={doDelete}
        onCancel={() => setModal({ open: false, type: null })}
      />

      <DeleteSuccessModal
        open={deleteSuccess.open}
        title={deleteSuccess.title}
        summary={deleteSuccess.summary}
        onClose={() => setDeleteSuccess({ open: false })}
      />
    </div>
  )
}

function SummaryCard({
  label, size, description, color, onClean,
}: { label: string; size: number; description: string; color: string; onClean?: () => void }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 bg-dark-700/50 border border-white/5 rounded-xl">
      <div className="w-2.5 h-10 rounded-full shrink-0" style={{ backgroundColor: color, opacity: 0.6 }} />
      <div className="flex-1">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-white/30 mt-0.5">{description}</div>
      </div>
      <div className="text-right">
        <div className="text-base font-bold" style={{ color }}>{formatBytes(size)}</div>
      </div>
      {onClean && size > 0 && (
        <button
          onClick={onClean}
          className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-all border border-red-500/20"
        >
          Clean
        </button>
      )}
    </div>
  )
}
