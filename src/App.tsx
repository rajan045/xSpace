import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import LargeFiles from './pages/LargeFiles'
import Caches from './pages/Caches'
import Duplicates from './pages/Duplicates'
import TrashPage from './pages/Trash'
import IOSData from './pages/IOSData'
import SmartClean from './pages/SmartClean'
import { Zap, AlertTriangle } from 'lucide-react'

function NotInElectron() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#1e1e1e]">
      <div className="text-center max-w-sm px-8">
        <div className="w-14 h-14 rounded-[12px] bg-dark-800 border border-white/[0.08] shadow-mac-sm flex items-center justify-center mx-auto mb-5">
          <Zap size={26} className="text-accent-blue" />
        </div>
        <h1 className="text-[17px] font-semibold text-white/90 tracking-tight mb-1">SpaceX Mac Cleaner</h1>
        <div className="flex items-center justify-center gap-2 mb-3 text-accent-orange">
          <AlertTriangle size={14} />
          <span className="text-[13px] font-medium">Open in the desktop app</span>
        </div>
        <p className="text-[13px] text-white/45 leading-relaxed mb-5">
          This app needs Electron to access your disk. Run it from Terminal — a window will open automatically.
        </p>
        <div className="mac-panel p-4 text-left">
          <p className="text-[11px] text-white/35 uppercase tracking-wide mb-2 font-medium">Terminal</p>
          <code className="text-[12px] text-accent-green font-mono block">cd ~/Desktop/rajan/spaceX</code>
          <code className="text-[12px] text-accent-green font-mono block mt-1.5">npm run dev</code>
        </div>
        <p className="text-[11px] text-white/25 mt-4">Do not use the browser tab for scanning.</p>
      </div>
    </div>
  )
}

export default function App() {
  if (!window.electronAPI) {
    return <NotInElectron />
  }

  return (
    <HashRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-[#1e1e1e] text-[13px]">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-[#1e1e1e] border-l border-mac-separator">
          {/* Title bar — matches hiddenInset traffic lights */}
          <div className="drag-region h-[52px] shrink-0 flex items-end pb-2 px-5 border-b border-mac-separator bg-[#1e1e1e]">
            <span className="no-drag text-[11px] font-semibold text-white/35 uppercase tracking-wider select-none">
              Storage
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-8 py-5">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/large-files" element={<LargeFiles />} />
              <Route path="/caches" element={<Caches />} />
              <Route path="/duplicates" element={<Duplicates />} />
              <Route path="/trash" element={<TrashPage />} />
              <Route path="/ios-data" element={<IOSData />} />
              <Route path="/smart-clean" element={<SmartClean />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  )
}
