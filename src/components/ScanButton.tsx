import React from 'react'
import { RefreshCw } from 'lucide-react'

interface ScanButtonProps {
  onClick: () => void
  loading: boolean
  label?: string
}

export default function ScanButton({ onClick, loading, label = 'Scan' }: ScanButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mac-btn-primary flex items-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
    >
      <RefreshCw size={13} className={loading ? 'animate-spin' : ''} strokeWidth={2} />
      {loading ? 'Scanning…' : label}
    </button>
  )
}
