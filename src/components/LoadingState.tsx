import React from 'react'

interface LoadingStateProps {
  message?: string
  rows?: number
}

export default function LoadingState({ message = 'Scanning…', rows = 6 }: LoadingStateProps) {
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-white/40 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse inline-block" />
        {message}
      </p>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] rounded-mac-sm shimmer border border-white/[0.04]"
          style={{ opacity: 1 - i * 0.1 }}
        />
      ))}
    </div>
  )
}
