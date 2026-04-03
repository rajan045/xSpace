import React, { useState } from 'react'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

interface InfoBannerProps {
  id: string
  title: string
  children: React.ReactNode
}

export default function InfoBanner({ id, title, children }: InfoBannerProps) {
  const storageKey = `info-banner-dismissed-${id}`
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1' } catch { return false }
  })
  const [collapsed, setCollapsed] = useState(false)

  function dismiss() {
    try { localStorage.setItem(storageKey, '1') } catch {}
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="bg-accent-blue/[0.08] border border-accent-blue/20 rounded-mac mb-4 overflow-hidden shrink-0 fade-in shadow-mac-sm">
      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <Info size={14} className="text-accent-blue shrink-0" />
        <span className="text-[13px] font-medium text-white/80 flex-1">{title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); dismiss() }}
            className="text-[11px] text-white/45 hover:text-white/75 px-2 py-0.5 rounded-mac-sm bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-colors"
          >
            Got it
          </button>
          {collapsed
            ? <ChevronDown size={13} className="text-white/30" />
            : <ChevronUp size={13} className="text-white/30" />
          }
        </div>
      </div>

      {!collapsed && (
        <div className="px-3.5 pb-3 text-[13px] text-white/50 leading-relaxed border-t border-white/[0.06]">
          <div className="pt-2.5">{children}</div>
        </div>
      )}
    </div>
  )
}
