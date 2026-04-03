import React from 'react'
import { CheckCircle2 } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
}

export default function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center mac-panel px-6">
      <div className="w-12 h-12 rounded-full bg-accent-green/12 flex items-center justify-center mb-3 border border-white/[0.06]">
        {icon || <CheckCircle2 size={22} className="text-accent-green" />}
      </div>
      <h3 className="text-[15px] font-semibold text-white/85">{title}</h3>
      {subtitle && <p className="text-[13px] text-white/40 mt-1.5 max-w-sm leading-relaxed">{subtitle}</p>}
    </div>
  )
}
