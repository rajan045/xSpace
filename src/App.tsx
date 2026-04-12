import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import { Paywall } from './components/Paywall'
import { TrialBanner } from './components/TrialBanner'
import { TrialWelcomeModal } from './components/TrialWelcomeModal'
import { PRICING_URL } from './constants/pricingUrl'
import Overview from './pages/Overview'
import LargeFiles from './pages/LargeFiles'
import Caches from './pages/Caches'
import Duplicates from './pages/Duplicates'
import TrashPage from './pages/Trash'
import IOSData from './pages/IOSData'
import SmartClean from './pages/SmartClean'
import Running from './pages/Running'
import Account from './pages/Account'
import { AlertTriangle } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'

type LicenseState =
  | { state: 'licensed'; email?: string }
  | { state: 'trial'; daysLeft: number; showWelcome: boolean }
  | { state: 'expired' }

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
  const sectionLabel =
    loc.pathname === '/running' ? 'System' : loc.pathname === '/account' ? 'Account' : 'Storage'

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
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/large-files" element={<LargeFiles />} />
            <Route path="/caches" element={<Caches />} />
            <Route path="/duplicates" element={<Duplicates />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/ios-data" element={<IOSData />} />
            <Route path="/smart-clean" element={<SmartClean />} />
            <Route path="/running" element={<Running />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [license, setLicense] = useState<LicenseState | null>(null)

  useEffect(() => {
    if (!window.electronAPI) return
    let cancelled = false
    window.electronAPI.licenseStatus().then((s) => {
      if (!cancelled) setLicense(s)
    })
    const unsub = window.electronAPI.onLicenseChanged(() => {
      window.electronAPI.licenseStatus().then((s) => setLicense(s))
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  if (!window.electronAPI) {
    return <NotInElectron />
  }

  if (!license) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#1e1e1e] text-[13px] text-white/35">
        Loading…
      </div>
    )
  }

  if (license.state === 'expired') {
    return (
      <Paywall
        onLicensed={() => {
          window.electronAPI.licenseStatus().then(setLicense)
        }}
      />
    )
  }

  const isTrial = license.state === 'trial'
  const showWelcomeModal = isTrial && license.showWelcome

  return (
    <>
      <HashRouter>
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#1e1e1e] text-[13px]">
          {isTrial ? <TrialBanner daysLeft={license.daysLeft} /> : null}
          <MainChrome />
        </div>
      </HashRouter>
      {showWelcomeModal ? (
        <TrialWelcomeModal
          daysLeft={license.daysLeft}
          onDismiss={async () => {
            const next = await window.electronAPI.dismissTrialWelcome()
            setLicense(next)
          }}
          onBuy={() => window.electronAPI.openExternal(PRICING_URL)}
        />
      ) : null}
    </>
  )
}
