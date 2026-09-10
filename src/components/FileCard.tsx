import React from 'react'
import { ExternalLink, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react'
import { formatBytes, formatDate, formatPath, getExtColor, tone, toneFill } from '../utils/format'

export type RiskLevel = 'auto-rebuild' | 'recoverable' | 'review'

const RISK_META: Record<RiskLevel, { label: string; color: string; icon: React.ReactNode }> = {
  'auto-rebuild': {
    label: 'Auto-rebuild',
    color: tone(0.9),
    icon: <ShieldCheck size={9} />,
  },
  'recoverable': {
    label: 'Recoverable',
    color: tone(0.62),
    icon: <RefreshCw size={9} />,
  },
  'review': {
    label: 'Review first',
    color: tone(0.62),
    icon: <AlertCircle size={9} />,
  },
}

interface FileCardProps {
  name: string
  path: string
  size: number
  modified?: string
  ext?: string
  selected?: boolean
  /** Second arg carries the click event so lists can support shift-range select. */
  onSelect?: (selected: boolean, e?: React.MouseEvent) => void
  onShowInFinder?: () => void
  badge?: string
  badgeColor?: string
  /** Single sentence shown below the path: "Chrome rebuilds this as you browse." */
  impact?: string
  /** Risk level drives the badge color and icon */
  riskLevel?: RiskLevel
}

export default function FileCard({
  name,
  path: filePath,
  size,
  modified,
  ext,
  selected = false,
  onSelect,
  onShowInFinder,
  badge,
  badgeColor,
  impact,
  riskLevel,
}: FileCardProps) {
  const risk = riskLevel ? RISK_META[riskLevel] : null

  return (
    <div
      className={`flex items-start gap-3 px-3.5 py-2.5 rounded-mac-sm border transition-colors duration-100 cursor-pointer select-none group ${
        selected
          ? 'bg-accent-blue/14 border-accent-blue/35 shadow-[inset_0_0_0_1px_rgb(var(--fg)/0.2)]'
          : 'bg-dark-800/80 border-white/[0.06] hover:border-white/[0.1] hover:bg-dark-800'
      }`}
      onClick={e => onSelect?.(!selected, e)}
    >
      {/* Checkbox */}
      {onSelect && (
        <div
          className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors mt-0.5 ${
            selected ? 'bg-accent-blue border-accent-blue' : 'border-white/20'
          }`}
        >
          {selected && (
            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
              <path d="M1 4l2.5 2.5L9 1" stroke="rgb(var(--bg))" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}

      {/* Icon */}
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold uppercase shrink-0 mt-0.5"
        style={{ backgroundColor: toneFill(0.08), color: getExtColor(ext || '') }}
      >
        {ext ? ext.slice(0, 3) : '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] text-white font-medium truncate">{name}</span>
          {/* Risk badge */}
          {risk && (
            <span
              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
              style={{ backgroundColor: toneFill(0.09), color: risk.color }}
            >
              {risk.icon}
              {risk.label}
            </span>
          )}
          {/* Custom badge (file type) */}
          {badge && !risk && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
              style={{ backgroundColor: toneFill(0.08), color: badgeColor || tone(0.7) }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="text-[12px] text-white/40 truncate mt-0.5">{formatPath(filePath)}</div>
        {/* Impact line */}
        {impact && (
          <div
            className="text-[12px] mt-1 truncate"
            style={{ color: tone(0.5) }}
          >
            ↪ {impact}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="text-right shrink-0 ml-2">
        <div className="text-[13px] font-semibold text-white/85 tabular-nums">{formatBytes(size)}</div>
        {modified && (
          <div className="text-[11px] text-white/35 mt-0.5">{formatDate(modified)}</div>
        )}
      </div>

      {/* Finder action */}
      {onShowInFinder && (
        <button
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-all shrink-0 mt-0.5"
          onClick={e => { e.stopPropagation(); onShowInFinder() }}
          title="Show in Finder"
        >
          <ExternalLink size={14} />
        </button>
      )}
    </div>
  )
}
