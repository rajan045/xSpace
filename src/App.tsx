import React from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import LargeFiles from './pages/LargeFiles'
import Caches from './pages/Caches'
import Duplicates from './pages/Duplicates'
import TrashPage from './pages/Trash'
import IOSData from './pages/IOSData'
import SmartClean from './pages/SmartClean'
import Running from './pages/Running'
import Apps from './pages/Apps'
import { AlertTriangle } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import ErrorBoundary from './components/ErrorBoundary'

function NotInElectron() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#1e1e1e]">
      <div className="text-center max-w-sm px-8">
        <div className="w-16 h-16 rounded-[12px] bg-[#1e1e1e] border border-white/[0.08] shadow-mac-sm flex items-center justify-center mx-auto mb-5 overflow-hidden p-1">
          <AppLogo size={56} className="rounded-[8px]" />
        </div>
        <h1 className="text-[17px] font-semibold text-white/90 tracking-tight mb-1">xSpace</h1>
        <div className="flex items-center justify-center gap-2 mb-3 text-accent-orange">
          <AlertTriangle size={14} />
          <span className="text-[13px] font-medium">Open in the desktop app</span>
        </div>
        <p className="text-[13px] text-white/45 leading-relaxed mb-5">
          This app needs Electron to access your disk. Run it from Terminal — a window will open automatically.
        </p>
        <div className="mac-panel p-4 text-left">
          <p className="text-[11px] text-white/35 uppercase tracking-wide mb-2 font-medium">Terminal</p>
          <code className="text-[12px] text-accent-green font-mono block">cd path/to/xSpace/spaceX</code>
          <code className="text-[12px] text-accent-green font-mono block mt-1.5">npm run dev</code>
        </div>
        <p className="text-[11px] text-white/25 mt-4">Do not use the browser tab for scanning.</p>
      </div>
    </div>
  )
}

function MainChrome() {
  const loc = useLocation()
  const sectionLabel = loc.pathname === '/running' ? 'System' : 'Storage'

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-[#1e1e1e] border-l border-mac-separator">
        <div className="drag-region h-[52px] shrink-0 flex items-end pb-2 px-5 border-b border-mac-separator bg-[#1e1e1e]">
          <span className="no-drag text-[11px] font-semibold text-white/35 uppercase tracking-wider select-none">
            {sectionLabel}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-8 py-5">
          <ErrorBoundary resetKey={loc.pathname}>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/large-files" element={<LargeFiles />} />
              <Route path="/caches" element={<Caches />} />
              <Route path="/duplicates" element={<Duplicates />} />
              <Route path="/trash" element={<TrashPage />} />
              <Route path="/ios-data" element={<IOSData />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/smart-clean" element={<SmartClean />} />
              <Route path="/running" element={<Running />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  if (!window.electronAPI) {
    return <NotInElectron />
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#1e1e1e] text-[13px]">
          <MainChrome />
        </div>
      </HashRouter>
    </ErrorBoundary>
  )
}
