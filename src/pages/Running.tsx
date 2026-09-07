import React, { useState, useEffect, useCallback } from 'react'
import { Activity, ExternalLink, Info, Loader2, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ScanButton from '../components/ScanButton'
import LoadingState from '../components/LoadingState'
import InfoBanner from '../components/InfoBanner'
import ConfirmModal from '../components/ConfirmModal'

type ProcessRow = {
  pid: number
  ppid: number
  cpuPercent: number
  memoryMB: number
  comm: string
  canQuit: boolean
}

type AgentRow = {
  plistPath: string
  label: string
  fileName: string
  loadedPid: number | null
  canUnload: boolean
}

const LOGIN_ITEMS_URL =
  'x-apple.systempreferences:com.apple.LoginItems-Settings.extension'

export default function Running() {
  const [loading, setLoading] = useState(false)
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [protectedProcesses, setProtectedProcesses] = useState<ProcessRow[]>([])
  const [launchAgents, setLaunchAgents] = useState<AgentRow[]>([])
  const [platformNote, setPlatformNote] = useState<string | undefined>()
  const [actionError, setActionError] = useState<string | null>(null)

  const [quitModal, setQuitModal] = useState<ProcessRow | null>(null)
  const [unloadModal, setUnloadModal] = useState<AgentRow | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setActionError(null)
    try {
      const data = await window.electronAPI.getRunningOverview()
      setProcesses(data.processes || [])
      setProtectedProcesses(data.protectedProcesses || [])
      setLaunchAgents(data.launchAgents || [])
      setPlatformNote(data.platformNote)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!infoOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfoOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [infoOpen])

  async function confirmQuit() {
    if (!quitModal) return
    setActionBusy(true)
    setActionError(null)
    try {
      const res = await window.electronAPI.quitUserProcess(quitModal.pid)
      if (!res.ok) {
        setActionError(res.error || 'Could not quit process.')
        return
      }
      setQuitModal(null)
      await refresh()
    } finally {
      setActionBusy(false)
    }
  }

  async function confirmUnload() {
    if (!unloadModal) return
    setActionBusy(true)
    setActionError(null)
    try {
      const res = await window.electronAPI.unloadUserLaunchAgent(unloadModal.plistPath)
      if (!res.ok) {
        setActionError(res.error || 'Could not unload agent.')
        return
      }
      setUnloadModal(null)
      await refresh()
    } finally {
      setActionBusy(false)
    }
  }

  function openLoginItems() {
    window.electronAPI.openExternal(LOGIN_ITEMS_URL)
  }

  return (
    <div className="max-w-[900px] pb-10">
      <PageHeader
        title="Running & startup"
        subtitle="First table: apps you can quit from xSpace. Second table: system and protected processes (view only). Launch Agents: ~/Library/LaunchAgents. Quit sends SIGTERM (graceful)."
      >
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="mac-btn-default flex items-center gap-1.5 text-[13px]"
          aria-label="What is this page and what do the actions do?"
        >
          <Info size={15} strokeWidth={2} />
          Info
        </button>
        <ScanButton onClick={refresh} loading={loading} label="Refresh" />
        <button
          type="button"
          onClick={openLoginItems}
          className="mac-btn-default flex items-center gap-1.5 text-[13px]"
        >
          <ExternalLink size={13} strokeWidth={2} />
          Login items
        </button>
      </PageHeader>

      <InfoBanner id="running-safety" title="Safety">
        Protected processes are listed for visibility only — xSpace cannot stop them from here. Only
        unload Launch Agents you recognize; they live in your user folder.
      </InfoBanner>

      {platformNote ? (
        <p className="text-[13px] text-amber-200/90 mb-4">{platformNote}</p>
      ) : null}

      {actionError ? (
        <div className="mb-4 rounded-mac-sm border border-accent-red/35 bg-accent-red/10 px-3 py-2 text-[13px] text-red-200/95">
          {actionError}
        </div>
      ) : null}

      {loading &&
      processes.length === 0 &&
      protectedProcesses.length === 0 &&
      launchAgents.length === 0 ? (
        <LoadingState message="Loading processes…" />
      ) : null}

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-accent-blue opacity-90" />
          <h2 className="text-[14px] font-semibold text-white/90">Processes you can quit</h2>
          <span className="text-[11px] text-white/35">sorted by CPU</span>
        </div>

        <div className="mac-panel overflow-hidden">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.08] text-white/45">
                <th className="py-2 px-3 font-medium">Process</th>
                <th className="py-2 px-2 font-medium w-[72px]">PID</th>
                <th className="py-2 px-2 font-medium w-[64px] text-right">CPU</th>
                <th className="py-2 px-2 font-medium w-[72px] text-right">Memory</th>
                <th className="py-2 px-3 font-medium w-[100px] text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {processes.map(row => (
                <tr key={row.pid} className="border-b border-white/[0.05] last:border-0">
                  <td className="py-2 px-3 text-white/80 font-mono truncate max-w-[280px]" title={row.comm}>
                    {row.comm}
                  </td>
                  <td className="py-2 px-2 text-white/55 tabular-nums">{row.pid}</td>
                  <td className="py-2 px-2 text-right text-white/65 tabular-nums">
                    {row.cpuPercent.toFixed(1)}%
                  </td>
                  <td className="py-2 px-2 text-right text-white/55 tabular-nums">
                    {row.memoryMB < 10 ? row.memoryMB.toFixed(2) : row.memoryMB.toFixed(1)} MB
                  </td>
                  <td className="py-2 px-3 text-right">
                    {row.canQuit ? (
                      <button
                        type="button"
                        onClick={() => setQuitModal(row)}
                        className="text-[12px] font-medium text-accent-orange hover:text-accent-orange/90"
                      >
                        Quit
                      </button>
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {processes.length === 0 && !loading ? (
            <p className="px-3 py-4 text-[13px] text-white/35">No process data.</p>
          ) : null}
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-white/35 opacity-90" />
          <h2 className="text-[14px] font-semibold text-white/90">System &amp; protected processes</h2>
          <span className="text-[11px] text-white/35">view only · sorted by CPU</span>
        </div>

        <div className="mac-panel overflow-hidden opacity-95">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.08] text-white/45">
                <th className="py-2 px-3 font-medium">Process</th>
                <th className="py-2 px-2 font-medium w-[72px]">PID</th>
                <th className="py-2 px-2 font-medium w-[64px] text-right">CPU</th>
                <th className="py-2 px-2 font-medium w-[72px] text-right">Memory</th>
              </tr>
            </thead>
            <tbody>
              {protectedProcesses.map(row => (
                <tr key={row.pid} className="border-b border-white/[0.05] last:border-0">
                  <td className="py-2 px-3 text-white/65 font-mono truncate max-w-[280px]" title={row.comm}>
                    {row.comm}
                  </td>
                  <td className="py-2 px-2 text-white/45 tabular-nums">{row.pid}</td>
                  <td className="py-2 px-2 text-right text-white/50 tabular-nums">
                    {row.cpuPercent.toFixed(1)}%
                  </td>
                  <td className="py-2 px-2 text-right text-white/45 tabular-nums">
                    {row.memoryMB < 10 ? row.memoryMB.toFixed(2) : row.memoryMB.toFixed(1)} MB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {protectedProcesses.length === 0 && !loading ? (
            <p className="px-3 py-4 text-[13px] text-white/35">No protected process data.</p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[14px] font-semibold text-white/90">User Launch Agents</h2>
          <span className="text-[11px] text-white/35">~/Library/LaunchAgents</span>
        </div>

        <div className="mac-panel overflow-hidden">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.08] text-white/45">
                <th className="py-2 px-3 font-medium">Label</th>
                <th className="py-2 px-2 font-medium">File</th>
                <th className="py-2 px-2 font-medium w-[88px]">Service PID</th>
                <th className="py-2 px-3 font-medium w-[100px] text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {launchAgents.map(agent => (
                <tr key={agent.plistPath} className="border-b border-white/[0.05] last:border-0">
                  <td className="py-2 px-3 text-white/80 truncate max-w-[240px]" title={agent.label}>
                    {agent.label}
                  </td>
                  <td className="py-2 px-2 text-white/45 font-mono text-[11px] truncate max-w-[200px]">
                    {agent.fileName}
                  </td>
                  <td className="py-2 px-2 text-white/55 tabular-nums">
                    {agent.loadedPid != null ? agent.loadedPid : '—'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {agent.canUnload ? (
                      <button
                        type="button"
                        onClick={() => setUnloadModal(agent)}
                        className="text-[12px] font-medium text-accent-orange hover:text-accent-orange/90"
                      >
                        Unload
                      </button>
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {launchAgents.length === 0 && !loading ? (
            <p className="px-3 py-4 text-[13px] text-white/35">No plist files in LaunchAgents.</p>
          ) : null}
        </div>
      </section>

      {loading &&
      (processes.length > 0 || protectedProcesses.length > 0 || launchAgents.length > 0) ? (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-mac-sm bg-mac-panel border border-white/10 px-3 py-2 text-[12px] text-white/55 shadow-mac">
          <Loader2 size={14} className="animate-spin text-accent-blue" />
          Refreshing…
        </div>
      ) : null}

      {infoOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="running-info-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setInfoOpen(false)}
            aria-label="Close"
          />
          <div className="relative z-10 max-h-[min(560px,85vh)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.1] bg-mac-raised p-6 shadow-mac-lg">
            <div className="flex items-start justify-between gap-3">
              <h2 id="running-info-title" className="text-[16px] font-semibold text-white/95">
                Running &amp; startup
              </h2>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="rounded-lg p-1 text-white/45 transition hover:bg-white/[0.08] hover:text-white/80"
                aria-label="Close"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/50">
              This page shows what is running on your Mac: user apps you may quit from xSpace, a
              read-only list of system and protected processes, and your Launch Agents in
              ~/Library/LaunchAgents. Data comes from macOS and refreshes when you tap Refresh.
            </p>

            <div className="mt-5 space-y-4 text-[13px] leading-relaxed text-white/65">
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-white/45">
                  Processes you can quit
                </h3>
                <p className="mt-1.5">
                  Lists non-system apps that are safe to stop from here (sorted by CPU).{' '}
                  <strong className="text-white/85">Quit</strong> asks macOS to send{' '}
                  <strong className="text-white/85">SIGTERM</strong> to that process: a normal
                  graceful shutdown. The app may prompt to save work; if it does not, unsaved
                  changes can be lost. xSpace does not force-kill processes.
                </p>
              </div>
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-white/45">
                  System &amp; protected processes
                </h3>
                <p className="mt-1.5">
                  High-CPU or important system daemons (kernel, WindowServer, etc.) appear here for
                  reference only. There is <strong className="text-white/85">no Quit</strong> action
                  — stopping them could freeze or crash your session, so xSpace does not offer it.
                </p>
              </div>
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-white/45">
                  Unload (Launch Agents)
                </h3>
                <p className="mt-1.5">
                  <strong className="text-white/85">Unload</strong> runs{' '}
                  <code className="rounded bg-black/35 px-1 font-mono text-[11px] text-white/70">
                    launchctl bootout
                  </code>{' '}
                  for that plist in your user LaunchAgents folder. The job stops until you load it
                  again or log in; the <strong className="text-white/85">.plist file stays on disk</strong>.
                  Only unload agents you recognize — some apps need background agents to work.
                </p>
              </div>
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-white/45">
                  Login items
                </h3>
                <p className="mt-1.5">
                  Opens System Settings so you can manage apps that open at login (separate from
                  Launch Agents).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="mt-6 w-full rounded-xl bg-accent-blue py-2.5 text-[13px] font-medium text-white hover:bg-accent-blue/90"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={quitModal !== null}
        title="Quit process?"
        message={
          quitModal
            ? `Send SIGTERM to PID ${quitModal.pid} (${quitModal.comm}). Unsaved work in that app may be lost.`
            : ''
        }
        danger
        confirmLabel={actionBusy ? 'Working…' : 'Send quit signal'}
        confirmationQuestion="This asks macOS to terminate the process gracefully. Are you sure?"
        onConfirm={confirmQuit}
        onCancel={() => !actionBusy && setQuitModal(null)}
      />

      <ConfirmModal
        open={unloadModal !== null}
        title="Unload Launch Agent?"
        message={
          unloadModal
            ? `Run launchctl bootout for “${unloadModal.label}”. The plist stays on disk; the service stops until you load it again or log in.`
            : ''
        }
        danger
        confirmLabel={actionBusy ? 'Working…' : 'Unload'}
        confirmationQuestion="Only unload agents you recognize. Some apps rely on background jobs."
        selectedNames={unloadModal ? [unloadModal.fileName] : []}
        onConfirm={confirmUnload}
        onCancel={() => !actionBusy && setUnloadModal(null)}
      />
    </div>
  )
}
