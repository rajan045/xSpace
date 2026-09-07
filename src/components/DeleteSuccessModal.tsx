import React from 'react'
import { CheckCircle2, X, Power } from 'lucide-react'

interface DeleteSuccessModalProps {
  open: boolean
  onClose: () => void
  /** Short line under the title, e.g. item count or freed space */
  summary?: string
  title?: string
}

export default function DeleteSuccessModal({
  open,
  onClose,
  summary,
  title = 'Cleanup complete',
}: DeleteSuccessModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[8px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal
        aria-labelledby="delete-success-title"
        className="relative z-10 w-full max-w-[400px] flex flex-col bg-mac-panel border border-white/[0.1] rounded-mac shadow-mac fade-in"
      >
        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-accent-green/18">
              <CheckCircle2 size={18} className="text-accent-green" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 id="delete-success-title" className="text-[15px] font-semibold text-white leading-snug">
                {title}
              </h3>
              {summary?.trim() && (
                <p className="text-[13px] text-white/55 mt-1 leading-relaxed">{summary}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="no-drag -mt-0.5 -mr-1 p-1.5 rounded-mac-sm text-white/35 hover:text-white/70 hover:bg-white/[0.08] transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="rounded-mac-sm border border-accent-blue/25 bg-accent-blue/[0.08] px-3 py-2.5 flex items-start gap-2.5">
            <Power size={14} className="text-accent-blue shrink-0 mt-0.5" />
            <div className="text-[12px] text-white/65 leading-relaxed">
              <p className="font-medium text-white/80 mb-1">Restart your Mac when you can</p>
              <p>
                Storage numbers and some apps update more reliably after a restart. It also lets macOS finish
                housekeeping in the background. Not required immediately — pick a convenient time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-white/[0.06] shrink-0 bg-dark-900/30">
          <button type="button" onClick={onClose} className="mac-btn-primary min-w-[88px]">
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
