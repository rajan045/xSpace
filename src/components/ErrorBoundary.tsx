import React from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'

interface Props {
  children: React.ReactNode
  /** When this value changes, a caught error is cleared (e.g. route pathname). */
  resetKey?: string
}

interface State {
  error: Error | null
  info: React.ErrorInfo | null
}

/**
 * Catches render/runtime errors anywhere below it so a single broken page
 * (or unexpected data shape) shows a recovery screen instead of blanking the
 * whole window. Resets automatically when `resetKey` changes (navigation).
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface in DevTools console for debugging.
    console.error('UI crash caught by ErrorBoundary:', error, info.componentStack)
    this.setState({ info })
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null })
    }
  }

  private reset = () => this.setState({ error: null, info: null })

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e] p-8">
        <div className="text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-[12px] bg-[#1e1e1e] border border-white/[0.08] shadow-mac-sm flex items-center justify-center mx-auto mb-5 overflow-hidden p-1">
            <AppLogo size={56} className="rounded-[8px]" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2 text-accent-orange">
            <AlertTriangle size={15} />
            <span className="text-[14px] font-semibold">Something went wrong</span>
          </div>
          <p className="text-[13px] text-white/45 leading-relaxed mb-5">
            This screen hit an unexpected error. Your files are untouched — try again or
            reload the app.
          </p>

          <div className="mac-panel p-3 text-left mb-5 max-h-[180px] overflow-auto">
            <p className="text-[11px] text-white/35 uppercase tracking-wide mb-1.5 font-medium">
              Error
            </p>
            <code className="text-[12px] text-accent-red font-mono block break-words whitespace-pre-wrap">
              {error.message || String(error)}
            </code>
            {info?.componentStack && (
              <code className="text-[11px] text-white/30 font-mono block break-words whitespace-pre-wrap mt-2">
                {info.componentStack.trim().split('\n').slice(0, 6).join('\n')}
              </code>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="mac-btn-default flex items-center gap-1.5 text-[13px]"
            >
              <RotateCcw size={14} /> Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mac-btn-primary flex items-center gap-1.5 text-[13px]"
            >
              <RefreshCw size={14} /> Reload app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
