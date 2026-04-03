import React, { useState, useEffect, useMemo } from 'react'
import { Trash2, FileSearch } from 'lucide-react'
import FileCard, { type RiskLevel } from '../components/FileCard'
import PageHeader from '../components/PageHeader'
import ScanButton from '../components/ScanButton'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import ConfirmModal from '../components/ConfirmModal'
import DeleteSuccessModal from '../components/DeleteSuccessModal'
import InfoBanner from '../components/InfoBanner'
import { formatBytes } from '../utils/format'

interface LargeFile {
  path: string
  name: string
  size: number
  modified: string
  ext: string
}

const SIZE_OPTIONS = [50, 100, 250, 500, 1000]

// Determine risk + impact based on file extension and path
function getFileContext(file: LargeFile): { riskLevel: RiskLevel; impact: string } {
  const ext = file.ext.toLowerCase()
  const path = file.path.toLowerCase()

  if (['mp4', 'mov', 'avi', 'mkv', 'm4v'].includes(ext))
    return { riskLevel: 'review', impact: 'Video file — make sure you have a backup before deleting.' }
  if (['dmg', 'pkg'].includes(ext))
    return { riskLevel: 'recoverable', impact: 'Installer file — the app is already installed. Re-downloadable if needed.' }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext))
    return { riskLevel: 'recoverable', impact: 'Archive file — safe to delete if you have already extracted it.' }
  if (['ipa', 'apk'].includes(ext))
    return { riskLevel: 'recoverable', impact: 'App build file — re-downloadable from the App Store or CI.' }
  if (path.includes('library/caches') || path.includes('derived data'))
    return { riskLevel: 'auto-rebuild', impact: 'Cache file — the app will rebuild this automatically.' }
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext))
    return { riskLevel: 'review', impact: 'Document file — review carefully before deleting.' }
  if (['jpg', 'jpeg', 'png', 'heic', 'raw'].includes(ext))
    return { riskLevel: 'review', impact: 'Image file — check if this is backed up to iCloud or elsewhere.' }

  return { riskLevel: 'review', impact: 'Review this file before deleting — no automatic way to recover it.' }
}

export default function LargeFiles() {
  const [allFiles, setAllFiles] = useState<LargeFile[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [minSizeMB, setMinSizeMB] = useState(50)
  const [modal, setModal] = useState<{ open: boolean; permanent: boolean }>({ open: false, permanent: false })
  const [deleteSuccess, setDeleteSuccess] = useState<{ open: boolean; summary?: string }>({ open: false })

  async function scan() {
    setLoading(true)
    setSelected(new Set())
    try {
      const result = await window.electronAPI.getLargeFiles(50)
      setAllFiles(result || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { scan() }, [])

  const files = allFiles.filter(f => f.size >= minSizeMB * 1024 * 1024)

  function toggleSelect(path: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  function selectAll() { setSelected(new Set(files.map(f => f.path))) }
  function clearSelection() { setSelected(new Set()) }

  const selectedFiles = allFiles.filter(f => selected.has(f.path))
  const totalSelectedSize = selectedFiles.reduce((sum, f) => sum + f.size, 0)

  const deleteModalContext = useMemo(() => {
    if (!modal.open) return null
    const sel = allFiles.filter(f => selected.has(f.path))
    const names = sel.map(f => f.name)
    if (sel.length === 0) return { aboutContains: '', aboutImpact: '', names: [] as string[] }
    if (sel.length === 1) {
      const { impact } = getFileContext(sel[0])
      return {
        aboutContains: `${sel[0].name} — a large file in your home folder${sel[0].ext ? ` (.${sel[0].ext})` : ''}.`,
        aboutImpact: `${impact}${modal.permanent ? ' Permanent delete skips Trash — there is no Put Back from this app.' : ''}`,
        names,
      }
    }
    return {
      aboutContains: `${sel.length} large files from your home directory (each meets the minimum size you set).`,
      aboutImpact: modal.permanent
        ? 'Every selected file is erased immediately. The list may mix videos, documents, installers, and caches — confirm each name before continuing.'
        : 'All selected files move to Trash. Restore from Finder until Trash is emptied.',
      names,
    }
  }, [modal.open, modal.permanent, allFiles, selected])

  async function doDelete(permanent: boolean) {
    const paths = Array.from(selected)
    const n = paths.length
    const bytes = totalSelectedSize
    const perm = permanent
    try {
      if (perm) await window.electronAPI.deletePermanently(paths)
      else await window.electronAPI.moveToTrash(paths)
      setAllFiles(prev => prev.filter(f => !selected.has(f.path)))
      setSelected(new Set())
      const freed = bytes > 0 ? ` About ${formatBytes(bytes)} cleared from this list.` : ''
      setDeleteSuccess({
        open: true,
        summary: `${n} large file${n === 1 ? '' : 's'} ${perm ? 'permanently removed' : 'moved to Trash'}.${freed}`,
      })
    } catch (err) { console.error(err) }
    setModal({ open: false, permanent: false })
  }

  return (
    <div className="fade-in flex flex-col h-full">
      <PageHeader
        title="Large Files"
        subtitle="Files taking up significant space on your disk"
        totalSize={files.reduce((sum, f) => sum + f.size, 0)}
        itemCount={files.length}
      >
        <div className="flex items-center gap-1 bg-dark-700 border border-white/5 rounded-lg p-0.5">
          {SIZE_OPTIONS.map(size => (
            <button
              key={size}
              onClick={() => setMinSizeMB(size)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                minSizeMB === size ? 'bg-accent-blue/20 text-accent-blue' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {size >= 1000 ? `${size / 1000}GB` : `${size}MB`}+
            </button>
          ))}
        </div>
        <ScanButton onClick={scan} loading={loading} />
      </PageHeader>

      <InfoBanner id="large-files" title="How to use Large Files">
        This page lists the biggest files on your Mac. Each file shows a risk badge so you know
        whether it's safe to delete. <strong className="text-white/60">Move to Trash</strong> is
        always safer — you can undo it. <strong className="text-white/60">Delete Permanently</strong> cannot be undone.
      </InfoBanner>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-accent-blue/10 border border-accent-blue/20 rounded-lg mb-4 shrink-0">
          <span className="text-sm text-accent-blue flex-1">
            {selected.size} selected · {formatBytes(totalSelectedSize)}
          </span>
          <button onClick={clearSelection} className="text-xs text-white/40 hover:text-white/70">Clear</button>
          <button onClick={selectAll} className="text-xs text-white/40 hover:text-white/70">Select all</button>
          <button
            onClick={() => setModal({ open: true, permanent: false })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-all"
          >
            <Trash2 size={12} /> Move to Trash
          </button>
          <button
            onClick={() => setModal({ open: true, permanent: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all"
          >
            Delete Permanently
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {loading ? (
          <LoadingState message="Searching for large files..." rows={8} />
        ) : files.length === 0 ? (
          <EmptyState
            icon={<FileSearch size={24} className="text-accent-green" />}
            title="No large files found"
            subtitle={`No files larger than ${minSizeMB}MB in your home directory`}
          />
        ) : (
          files.map(file => {
            const { riskLevel, impact } = getFileContext(file)
            return (
              <FileCard
                key={file.path}
                name={file.name}
                path={file.path}
                size={file.size}
                modified={file.modified}
                ext={file.ext}
                riskLevel={riskLevel}
                impact={impact}
                selected={selected.has(file.path)}
                onSelect={() => toggleSelect(file.path)}
                onShowInFinder={() => window.electronAPI.showInFinder(file.path)}
              />
            )
          })
        )}
      </div>

      <ConfirmModal
        open={modal.open}
        title={modal.permanent ? 'Delete Permanently' : 'Move to Trash'}
        message={modal.permanent
          ? `${selected.size} file${selected.size !== 1 ? 's' : ''} will be permanently deleted.`
          : `${selected.size} file${selected.size !== 1 ? 's' : ''} will be moved to the Trash.`}
        totalSize={totalSelectedSize}
        itemCount={selected.size}
        danger={modal.permanent}
        confirmLabel={modal.permanent ? 'Delete Permanently' : 'Move to Trash'}
        aboutContains={deleteModalContext?.aboutContains}
        aboutImpact={deleteModalContext?.aboutImpact}
        selectedNames={deleteModalContext?.names}
        consequences={modal.permanent
          ? ['Files cannot be recovered after this', 'Make sure you have backups for anything important']
          : ['Files go to Trash — nothing is lost yet', 'Open Trash and click "Put Back" to undo', 'Empty Trash later when you are sure']}
        restoreHint={modal.permanent ? undefined : 'Tip: Move to Trash is always reversible. Use Delete Permanently only when sure.'}
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
