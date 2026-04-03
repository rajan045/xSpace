import React from 'react'
import { formatBytes } from '../utils/format'

interface PageHeaderProps {
  title: string
  subtitle?: string
  totalSize?: number
  itemCount?: number
  children?: React.ReactNode
}

export default function PageHeader({ title, subtitle, totalSize, itemCount, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5 shrink-0">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold text-white tracking-tight leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-white/45 mt-1 leading-snug max-w-xl">{subtitle}</p>
        )}
        {(totalSize !== undefined || itemCount !== undefined) && (
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            {itemCount !== undefined && (
              <span className="text-[12px] text-white/45">
                <span className="text-white/75 font-medium tabular-nums">{itemCount}</span>
                {' '}items
              </span>
            )}
            {totalSize !== undefined && totalSize > 0 && (
              <span className="text-[12px] text-white/45">
                <span className="text-accent-green font-medium tabular-nums">{formatBytes(totalSize)}</span>
                {' '}recoverable
              </span>
            )}
          </div>
        )}
      </div>
      <div className="no-drag flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {children}
      </div>
    </div>
  )
}
