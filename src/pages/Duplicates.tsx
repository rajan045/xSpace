import React, { useState, useEffect, useMemo } from 'react'
import { Copy, Trash2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ScanButton from '../components/ScanButton'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import ConfirmModal from '../components/ConfirmModal'
import DeleteSuccessModal from '../components/DeleteSuccessModal'
import InfoBanner from '../components/InfoBanner'
import { formatBytes, formatDate, formatPath, getExtColor } from '../utils/format'

interface DuplicateFile {
  path: string
  name: string
  size: number
  modified: string
}

interface DuplicateGroup {
  hash: string
  size: number
  totalWasted: number
  files: DuplicateFile[]
}

export default function Duplicates() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<{ open: boolean; permanent: boolean }>({ open: false, permanent: false })
  const [deleteSuccess, setDeleteSuccess] = useState<{ open: boolean; summary?: string }>({ open: false })

  async function scan() {
    setLoading(true)
    setSelectedFiles(new Set())
    try {
      const result = await window.electronAPI.getDuplicates()
      setGroups(result || [])
      // Expand first 3 groups by default
      if (result?.length) {
        setExpanded(new Set(result.slice(0, 3).map((g: DuplicateGroup) => g.hash)))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { scan() }, [])

  function toggleFile(path: string) {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  function toggleGroup(hash: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(hash) ? next.delete(hash) : next.add(hash)
      return next
    })
  }

  // Auto-select duplicates (keep first, select rest)
  function autoSelect() {
    const toSelect = new Set<string>()
    groups.forEach(g => {
      g.files.slice(1).forEach(f => toSelect.add(f.path))
    })
    setSelectedFiles(toSelect)
  }

  const totalSelectedSize = Array.from(selectedFiles).reduce((sum, path) => {
    for (const g of groups) {
      const f = g.files.find(f => f.path === path)
      if (f) return sum + f.size
    }
    return sum
  }, 0)

  const totalWasted = groups.reduce((sum, g) => sum + g.totalWasted, 0)

  const deleteModalContext = useMemo(() => {
    if (!modal.open) return null
    const sel: DuplicateFile[] = []
    for (const g of groups) {
      for (const f of g.files) {
        if (selectedFiles.has(f.path)) sel.push(f)
      }
    }
    const names = sel.map(f => f.name)
    if (sel.length === 0) return { aboutContains: '', aboutImpact: '', names: [] as string[] }
    if (sel.length === 1) {
      return {
        aboutContains: `${sel[0].name} — one path in a duplicate group (byte-identical to at least one other file you kept).`,
        aboutImpact: modal.permanent
          ? 'Only this path is removed; other identical copies stay on disk. If you delete the wrong copy, recovery is not guaranteed.'
          : 'This copy goes to Trash. Other identical files remain until you remove them too.',
        names,
      }
    }
    return {
      aboutContains: `${sel.length} duplicate paths you marked (same content as other files in the same groups).`,
      aboutImpact: modal.permanent
        ? 'Each selected path is erased. At least one “Keeping this” copy per group should remain — verify the UI before confirming.'
        : 'Selected duplicates move to Trash. Original copies stay in place; restore from Trash if needed.',
      names,
    }
  }, [modal.open, modal.permanent, groups, selectedFiles])

  async function doDelete(permanent: boolean) {
    const paths = Array.from(selectedFiles)
    const n = paths.length
    const bytes = totalSelectedSize
    const perm = permanent
    try {
      if (perm) {
        await window.electronAPI.deletePermanently(paths)
      } else {
        await window.electronAPI.moveToTrash(paths)
      }
      setGroups(prev =>
        prev
          .map(g => ({ ...g, files: g.files.filter(f => !selectedFiles.has(f.path)) }))
          .filter(g => g.files.length > 1)
      )
      setSelectedFiles(new Set())
      const freed = bytes > 0 ? ` About ${formatBytes(bytes)} duplicate space cleared.` : ''
      setDeleteSuccess({
        open: true,
        summary: `${n} duplicate path${n === 1 ? '' : 's'} ${perm ? 'permanently removed' : 'moved to Trash'}.${freed}`,
      })
    } catch (err) {
      console.error(err)
    }
    setModal({ open: false, permanent: false })
  }

  return (
    <div className="fade-in flex flex-col h-full">
      <PageHeader
        title="Duplicate Files"
        subtitle="Files with identical content taking up extra space"
        totalSize={totalWasted}
        itemCount={groups.length}
      >
        {!loading && groups.length > 0 && (
          <button
            onClick={autoSelect}
            className="text-xs text-accent-blue hover:text-accent-blue/80 transition-colors px-3 py-2 bg-accent-blue/10 rounded-lg border border-accent-blue/20"
          >
            Auto-select duplicates
          </button>
        )}
        <ScanButton onClick={scan} loading={loading} label="Find Duplicates" />
      </PageHeader>

      <InfoBanner id="duplicates" title="How duplicates are found">
        Files are compared by their exact content (MD5 hash), not just name. The <strong className="text-white/60">first copy</strong> is
        marked "Original" — the others are safe to delete. Use <strong className="text-white/60">Auto-select duplicates</strong> to
        automatically pick all copies except the first one in each group. Move to Trash for a safe undo option.
      </InfoBanner>

      {/* Selection bar */}
      {selectedFiles.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-accent-blue/10 border border-accent-blue/20 rounded-lg mb-4 shrink-0">
          <span className="text-sm text-accent-blue flex-1">
            {selectedFiles.size} files selected · {formatBytes(totalSelectedSize)} to free
          </span>
          <button onClick={() => setSelectedFiles(new Set())} className="text-xs text-white/40 hover:text-white/70">Clear</button>
          <button
            onClick={() => setModal({ open: true, permanent: false })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30"
          >
            <Trash2 size={12} /> Move to Trash
          </button>
          <button
            onClick={() => setModal({ open: true, permanent: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30"
          >
            Delete Permanently
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {loading ? (
          <LoadingState message="Scanning for duplicate files (this may take a moment)..." rows={5} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Copy size={24} className="text-accent-green" />}
            title="No duplicates found"
            subtitle="No duplicate files found in Downloads, Documents, Desktop, Pictures, or Movies"
          />
        ) : (
          groups.map(group => {
            const isExpanded = expanded.has(group.hash)
            const ext = group.files[0]?.name.split('.').pop() || ''

            return (
              <div key={group.hash} className="bg-dark-700/50 border border-white/5 rounded-lg overflow-hidden">
                {/* Group header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
                  onClick={() => toggleGroup(group.hash)}
                >
                  <div className="text-white/30">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold uppercase shrink-0"
                    style={{ backgroundColor: `${getExtColor(ext)}20`, color: getExtColor(ext) }}
                  >
                    {ext.slice(0, 3) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white">{group.files.length} identical files</span>
                    <span className="text-xs text-white/30 ml-2">{group.files[0]?.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-white/40">Each: {formatBytes(group.size)}</div>
                    <div className="text-xs text-red-400 font-medium">Wasted: {formatBytes(group.totalWasted)}</div>
                  </div>
                </div>

                {/* File list */}
                {isExpanded && (
                  <div className="border-t border-white/5">
                    {group.files.map((file, idx) => (
                      <div
                        key={file.path}
                        onClick={() => toggleFile(file.path)}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${
                          selectedFiles.has(file.path)
                            ? 'bg-accent-blue/10'
                            : 'hover:bg-white/3'
                        } ${idx < group.files.length - 1 ? 'border-b border-white/3' : ''}`}
                      >
                        <div className="w-5 shrink-0" />
                        <div
                          className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                            selectedFiles.has(file.path) ? 'bg-accent-blue border-accent-blue' : 'border-white/20'
                          }`}
                        >
                          {selectedFiles.has(file.path) && (
                            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
                              <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white/60 truncate">{formatPath(file.path)}</div>
                          <div className="text-xs text-white/30 mt-0.5">{formatDate(file.modified)}</div>
                        </div>
                        {idx === 0 ? (
                          <span className="text-[10px] text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded shrink-0">
                            Keeping this
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded shrink-0">
                            Duplicate
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={`Show ${file.name} in Finder`}
                          title="Show in Finder"
                          className="mac-focus p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 shrink-0"
                          onClick={e => { e.stopPropagation(); window.electronAPI.showInFinder(file.path) }}
                        >
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <ConfirmModal
        open={modal.open}
        title={modal.permanent ? 'Delete Duplicates Permanently' : 'Move Duplicates to Trash'}
        message={`${selectedFiles.size} duplicate file${selectedFiles.size !== 1 ? 's' : ''} will be ${modal.permanent ? 'permanently deleted' : 'moved to Trash'}.`}
        totalSize={totalSelectedSize}
        itemCount={selectedFiles.size}
        danger={modal.permanent}
        confirmLabel={modal.permanent ? 'Delete Permanently' : 'Move to Trash'}
        aboutContains={deleteModalContext?.aboutContains}
        aboutImpact={deleteModalContext?.aboutImpact}
        selectedNames={deleteModalContext?.names}
        consequences={modal.permanent
          ? ['At least one copy of each file is kept (the "Keeping this" copy)', 'Deleted copies cannot be recovered', 'No app data or settings are affected']
          : ['At least one copy of each file is kept', 'Duplicates go to Trash — restore them if needed', 'Open Trash → "Put Back" to undo']}
        restoreHint={modal.permanent ? undefined : 'Tip: The original copy is never touched — only the duplicates are removed.'}
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
