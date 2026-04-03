import React, { useState, useEffect, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ScanButton from '../components/ScanButton'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import ConfirmModal from '../components/ConfirmModal'
import DeleteSuccessModal from '../components/DeleteSuccessModal'
import InfoBanner from '../components/InfoBanner'
import { formatBytes, formatDate, formatPath, getExtColor } from '../utils/format'

interface TrashFile {
  path: string
  name: string
  size: number
  modified: string
  ext: string
}

interface TrashInfo {
  size: number
  fileCount: number
  files: TrashFile[]
}

export default function TrashPage() {
  const [info, setInfo] = useState<TrashInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [emptying, setEmptying] = useState(false)
  const [modal, setModal] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState<{ open: boolean; summary?: string }>({ open: false })

  async function scan() {
    setLoading(true)
    setDeleteSuccess({ open: false })
    try {
      const data = await window.electronAPI.getTrashInfo()
      setInfo(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { scan() }, [])

  const emptyTrashContext = useMemo(() => {
    if (!modal || !info || info.fileCount === 0) return null
    return {
      aboutContains: `All items currently in macOS Trash (${info.fileCount} items, from any app or Finder). They already left their original locations.`,
      aboutImpact:
        'Emptying Trash deletes each item permanently. Put Back in Finder will no longer be available for them.',
      names: info.files.map(f => f.name),
    }
  }, [modal, info])

  async function doEmpty() {
    setEmptying(true)
    setModal(false)
    const prevCount = info?.fileCount ?? 0
    try {
      const res = await window.electronAPI.emptyTrash()
      if (res.success) {
        setInfo({ size: 0, fileCount: 0, files: [] })
        const freed = formatBytes(res.freedBytes)
        setDeleteSuccess({
          open: true,
          summary:
            prevCount > 0
              ? `Emptied ${prevCount} item${prevCount === 1 ? '' : 's'} · about ${freed} cleared`
              : `About ${freed} cleared`,
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setEmptying(false)
    }
  }

  return (
    <div className="fade-in flex flex-col h-full">
      <PageHeader
        title="Trash"
        subtitle="Items waiting to be permanently deleted"
        totalSize={info?.size}
        itemCount={info?.fileCount}
      >
        <ScanButton onClick={scan} loading={loading} />
        {info && info.size > 0 && (
          <button
            onClick={() => setModal(true)}
            disabled={emptying}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium text-sm transition-all border border-red-500/30 disabled:opacity-50"
          >
            <Trash2 size={14} className={emptying ? 'animate-bounce' : ''} />
            {emptying ? 'Emptying...' : 'Empty Trash'}
          </button>
        )}
      </PageHeader>

      <InfoBanner id="trash" title="About emptying Trash">
        Items in Trash are <strong className="text-white/60">not deleted yet</strong> — they are just waiting.
        You can restore any item by opening Trash in Finder and clicking "Put Back."
        Clicking <strong className="text-red-400/80">Empty Trash</strong> below is <strong className="text-red-400/80">permanent and cannot be undone</strong>.
        Only proceed if you have reviewed the items and are sure.
      </InfoBanner>

      {/* Size display */}
      {info && info.size > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
          <div className="bg-dark-700 rounded-xl p-4 border border-white/5">
            <div className="text-xs text-white/40 mb-1">Total Size</div>
            <div className="text-2xl font-bold text-red-400">{formatBytes(info.size)}</div>
          </div>
          <div className="bg-dark-700 rounded-xl p-4 border border-white/5">
            <div className="text-xs text-white/40 mb-1">Items</div>
            <div className="text-2xl font-bold text-white">{info.fileCount}</div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {loading ? (
          <LoadingState message="Reading Trash..." rows={5} />
        ) : !info || info.files.length === 0 ? (
          <EmptyState
            icon={<Trash2 size={24} className="text-accent-green" />}
            title="Trash is empty"
            subtitle="Nothing to clean up here"
          />
        ) : (
          info.files.map(file => (
            <div
              key={file.path}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-dark-700/50 border-white/5 group"
            >
              {/* Icon */}
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold uppercase shrink-0"
                style={{ backgroundColor: `${getExtColor(file.ext)}20`, color: getExtColor(file.ext) }}
              >
                {file.ext ? file.ext.slice(0, 3) : <Trash2 size={14} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate">{file.name}</div>
                <div className="text-xs text-white/30 truncate mt-0.5">{formatPath(file.path)}</div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-white/70">{formatBytes(file.size)}</div>
                <div className="text-xs text-white/30">{formatDate(file.modified)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        open={modal}
        title="Empty Trash"
        message="All items in Trash will be permanently and irreversibly deleted."
        totalSize={info?.size}
        itemCount={info?.fileCount}
        danger
        confirmLabel="Empty Trash"
        aboutContains={emptyTrashContext?.aboutContains}
        aboutImpact={emptyTrashContext?.aboutImpact}
        selectedNames={emptyTrashContext?.names}
        consequences={[
          'This action cannot be undone',
          'No automatic way to recover these files',
          'Make sure you have reviewed every item before proceeding',
        ]}
        restoreHint="Last chance: open Finder → Trash, right-click any item → Put Back to restore it first."
        onConfirm={doEmpty}
        onCancel={() => setModal(false)}
      />

      <DeleteSuccessModal
        open={deleteSuccess.open}
        title="Trash emptied"
        summary={deleteSuccess.summary}
        onClose={() => setDeleteSuccess({ open: false })}
      />
    </div>
  )
}
