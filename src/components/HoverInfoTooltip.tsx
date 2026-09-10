import React, { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

const HIDE_MS = 200
const TOOLTIP_W = 288

export interface HoverInfoTooltipProps {
  /** Screen-reader label, e.g. category or folder name */
  ariaLabel: string
  whatInside: string
  ifYouDelete: string
  /** Slightly smaller icon in tight rows */
  iconSize?: number
  className?: string
}

export default function HoverInfoTooltip({
  ariaLabel,
  whatInside,
  ifYouDelete,
  iconSize = 14,
  className = '',
}: HoverInfoTooltipProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHide()
    hideTimer.current = setTimeout(() => setOpen(false), HIDE_MS)
  }, [clearHide])

  const updatePosition = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let left = r.right - TOOLTIP_W
    if (left < 12) left = 12
    if (left + TOOLTIP_W > window.innerWidth - 12) {
      left = window.innerWidth - TOOLTIP_W - 12
    }
    let top = r.bottom + 8
    const estH = 220
    if (top + estH > window.innerHeight - 12) {
      top = Math.max(12, r.top - estH - 8)
    }
    setPos({ top, left })
  }, [])

  const show = useCallback(() => {
    clearHide()
    updatePosition()
    setOpen(true)
  }, [clearHide, updatePosition])

  useEffect(() => {
    if (!open) return
    const onScroll = () => updatePosition()
    const onResize = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, updatePosition])

  useEffect(() => () => clearHide(), [clearHide])

  const tipContent = (
    <div
      ref={tipRef}
      role="tooltip"
      className="fixed z-[200] w-72 max-h-[min(320px,70vh)] overflow-y-auto rounded-mac border border-white/[0.12] bg-mac-raised p-3 shadow-mac text-left pointer-events-auto"
      style={{ top: pos.top, left: pos.left }}
      onMouseEnter={clearHide}
      onMouseLeave={scheduleHide}
    >
      <p className="text-[11px] font-semibold text-white/45 uppercase tracking-wide mb-1.5">What’s inside</p>
      <p className="text-[12px] text-white/75 leading-relaxed mb-3">{whatInside}</p>
      <p className="text-[11px] font-semibold text-white/45 uppercase tracking-wide mb-1.5">If you delete or change it</p>
      <p className="text-[12px] text-white/65 leading-relaxed">{ifYouDelete}</p>
    </div>
  )

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`no-drag shrink-0 p-1 rounded-mac-sm text-white/30 hover:text-accent-blue hover:bg-white/[0.08] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50 ${className}`}
        aria-label={`About ${ariaLabel}`}
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          if (open) setOpen(false)
          else show()
        }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
        }}
      >
        <Info size={iconSize} strokeWidth={2} />
      </button>
      {typeof document !== 'undefined' && open && createPortal(tipContent, document.body)}
    </>
  )
}
