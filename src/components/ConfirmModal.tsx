import React from 'react'
import { AlertTriangle, X, CheckCircle2, ArrowRight, HelpCircle } from 'lucide-react'
import { formatBytes } from '../utils/format'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  totalSize?: number
  itemCount?: number
  danger?: boolean
  confirmLabel?: string
  consequences?: string[]
  restoreHint?: string
  onConfirm: () => void
  onCancel: () => void
  /**
   * Explicit “are you sure” copy. Defaults depend on danger (permanent vs Trash).
   */
  confirmationQuestion?: string
  /** Educational: what the selection is / contains */
  aboutContains?: string
  /** Educational: what happens if you remove it (risk / recovery) */
  aboutImpact?: string
  /** Basenames or short labels to list (max ~8 shown in UI) */
  selectedNames?: string[]
}

function defaultConfirmationQuestion(danger: boolean): string {
  return danger
    ? 'Are you sure you want to permanently delete? Files will not go to Trash and cannot be recovered by this app.'
    : 'Are you sure you want to move these items to Trash? You can put them back from Finder until you empty Trash.'
}

export default function ConfirmModal({
  open,
  title,
  message,
  totalSize,
  itemCount,
  danger = false,
  confirmLabel = 'Confirm',
  consequences,
  restoreHint,
  onConfirm,
  onCancel,
  confirmationQuestion,
  aboutContains,
  aboutImpact,
  selectedNames,
}: ConfirmModalProps) {
  if (!open) return null

  const sureText = confirmationQuestion ?? defaultConfirmationQuestion(danger)
  const showAbout = Boolean(aboutContains?.trim() || aboutImpact?.trim())
  const preview = selectedNames?.filter(Boolean).slice(0, 8) ?? []
  const previewExtra = selectedNames && selectedNames.length > 8 ? selectedNames.length - 8 : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[8px]"
        onClick={onCancel}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-[440px] max-h-[min(90vh,640px)] flex flex-col bg-[#323234] border border-white/[0.1] rounded-mac shadow-mac fade-in"
      >
        <div className="p-5 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-start gap-3 mb-4">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                danger ? 'bg-accent-red/18' : 'bg-accent-orange/18'
              }`}
            >
              <AlertTriangle size={18} className={danger ? 'text-accent-red' : 'text-accent-orange'} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-[15px] font-semibold text-white leading-snug">{title}</h3>
              <p className="text-[13px] text-white/50 mt-1 leading-relaxed">{message}</p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="no-drag -mt-0.5 -mr-1 p-1.5 rounded-mac-sm text-white/35 hover:text-white/70 hover:bg-white/[0.08] transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {(totalSize !== undefined || itemCount !== undefined) && (
            <div className="flex gap-2 mb-4">
              {itemCount !== undefined && (
                <div className="flex-1 bg-dark-900/80 rounded-mac-sm px-3 py-2 text-center border border-white/[0.06]">
                  <div className="text-[15px] font-semibold text-white tabular-nums">{itemCount}</div>
                  <div className="text-[11px] text-white/40 font-medium">items</div>
                </div>
              )}
              {totalSize !== undefined && (
                <div className="flex-1 bg-dark-900/80 rounded-mac-sm px-3 py-2 text-center border border-white/[0.06]">
                  <div className="text-[15px] font-semibold text-accent-green tabular-nums">{formatBytes(totalSize)}</div>
                  <div className="text-[11px] text-white/40 font-medium">to free</div>
                </div>
              )}
            </div>
          )}

          {preview.length > 0 && (
            <div className="mb-4 rounded-mac-sm border border-white/[0.08] bg-dark-900/50 px-3 py-2 max-h-28 overflow-y-auto">
              <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wide mb-1.5">Selected</p>
              <ul className="space-y-0.5">
                {preview.map((name, i) => (
                  <li key={i} className="text-[12px] text-white/70 truncate font-mono" title={name}>
                    {name}
                  </li>
                ))}
              </ul>
              {previewExtra > 0 && (
                <p className="text-[11px] text-white/40 mt-1.5">+{previewExtra} more…</p>
              )}
            </div>
          )}

          <div
            className={`rounded-mac-sm border px-3 py-3 mb-4 ${
              danger
                ? 'border-accent-red/35 bg-accent-red/[0.08]'
                : 'border-amber-500/30 bg-amber-500/[0.07]'
            }`}
          >
            <p className="text-[11px] font-semibold text-white/45 uppercase tracking-wide mb-1.5">Please confirm</p>
            <p className={`text-[13px] font-medium leading-snug ${danger ? 'text-red-200/95' : 'text-amber-100/90'}`}>
              {sureText}
            </p>
          </div>

          {showAbout && (
            <div className="rounded-mac-sm border border-white/[0.08] bg-dark-900/40 px-3 py-2.5 mb-4">
              <div className="flex items-center gap-1.5 mb-2 text-white/55">
                <HelpCircle size={14} className="text-accent-blue shrink-0" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">About this selection</span>
              </div>
              {aboutContains?.trim() && (
                <>
                  <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wide mb-1">What it is</p>
                  <p className="text-[12px] text-white/65 leading-relaxed mb-2.5">{aboutContains}</p>
                </>
              )}
              {aboutImpact?.trim() && (
                <>
                  <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wide mb-1">If you remove it</p>
                  <p className="text-[12px] text-white/55 leading-relaxed">{aboutImpact}</p>
                </>
              )}
            </div>
          )}

          {consequences && consequences.length > 0 && (
            <div className="bg-dark-900/50 border border-white/[0.06] rounded-mac-sm px-3 py-2.5 mb-4">
              <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-2">
                What will happen next
              </div>
              <ul className="space-y-1.5">
                {consequences.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-white/70 leading-snug">
                    <CheckCircle2 size={14} className="text-accent-green mt-0.5 shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {restoreHint && (
            <div className="flex items-start gap-2 px-3 py-2 bg-accent-blue/10 border border-accent-blue/20 rounded-mac-sm mb-4">
              <ArrowRight size={12} className="text-accent-blue shrink-0 mt-0.5" />
              <span className="text-[12px] text-accent-blue/90 leading-snug">{restoreHint}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-3 border-t border-white/[0.06] shrink-0 bg-dark-900/30">
          <button type="button" onClick={onCancel} className="mac-btn-default min-w-[76px]">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-w-[96px] rounded-mac-sm px-3.5 py-1.5 text-[13px] font-medium transition-all ${
              danger
                ? 'bg-accent-red/90 text-white hover:brightness-110 border border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]'
                : 'mac-btn-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
