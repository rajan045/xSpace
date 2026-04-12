import React, { useState } from 'react'
import { Lock, ExternalLink } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import { PRICING_URL } from '@/constants/pricingUrl'

export function Paywall({ onLicensed }: { onLicensed: () => void }) {
  const [key, setKey] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pasteToken, setPasteToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshLicense = async () => {
    if (!window.electronAPI) return
    const s = await window.electronAPI.licenseStatus()
    if (s.state === 'licensed') {
      onLicensed()
    }
  }

  const activate = async () => {
    if (!window.electronAPI) return
    setBusy(true)
    setError(null)
    const res = await window.electronAPI.setLicenseKey(key)
    setBusy(false)
    if (res.ok) {
      onLicensed()
    } else {
      setError(res.error || 'Could not activate')
    }
  }

  const signIn = async () => {
    if (!window.electronAPI) return
    setBusy(true)
    setError(null)
    const res = (await window.electronAPI.authLogin(email.trim(), password)) as
      | { ok: true }
      | { ok: false; error: string }
    setBusy(false)
    if (!res.ok) {
      setError(res.error || 'Sign in failed')
      return
    }
    await refreshLicense()
    const s = await window.electronAPI.licenseStatus()
    if (s.state !== 'licensed') {
      setError(
        'Signed in, but no active subscription on this account. Buy a license or paste your license key below.',
      )
    }
  }

  const applyToken = async () => {
    if (!window.electronAPI) return
    setBusy(true)
    setError(null)
    const res = (await window.electronAPI.authSetApiToken(pasteToken)) as
      | { ok: true }
      | { ok: false; error: string }
    setBusy(false)
    if (!res.ok) {
      setError(res.error || 'Invalid token')
      return
    }
    await refreshLicense()
    const s = await window.electronAPI.licenseStatus()
    if (s.state !== 'licensed') {
      setError(
        'Token saved. Subscription not active — purchase on the website or use a license key.',
      )
    }
  }

  const openBuy = () => {
    window.electronAPI?.openExternal(PRICING_URL)
  }

  return (
    <div className="no-drag flex h-screen w-screen flex-col items-center justify-center overflow-y-auto bg-[#1e1e1e] px-8 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#2a2a2c] p-8 shadow-mac-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#1e1e1e] p-1.5">
            <AppLogo size={56} className="rounded-[10px]" />
          </div>
          <div className="flex items-center gap-2 text-accent-orange/90">
            <Lock size={16} strokeWidth={2} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">License required</span>
          </div>
        </div>
        <h1 className="text-center text-[18px] font-semibold tracking-tight text-white/90">
          Trial ended
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-white/45">
          Sign in with your website account (if you have an active subscription), paste an app token from
          the website Account page, enter your license key, or buy a license.
        </p>
        <p className="mt-3 text-center text-[12px] leading-relaxed text-white/55">
          Subscription starts <span className="font-medium text-white/85">April 20</span>. Until then,
          enjoy the free trial.
        </p>

        <div className="mt-8 border-t border-white/[0.06] pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">Sign in</p>
          <div className="mt-3 space-y-2">
            <input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-[#1e1e1e] px-3 py-2 text-[13px] text-white/85 placeholder:text-white/25"
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-[#1e1e1e] px-3 py-2 text-[13px] text-white/85 placeholder:text-white/25"
            />
            <button
              type="button"
              onClick={signIn}
              disabled={busy || !email.trim() || !password}
              className="w-full rounded-lg bg-accent-blue py-2.5 text-[13px] font-medium text-white hover:bg-accent-blue/90 disabled:opacity-40"
            >
              {busy ? '…' : 'Sign in'}
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-white/[0.06] pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">App token from website</p>
          <textarea
            value={pasteToken}
            onChange={(e) => setPasteToken(e.target.value)}
            placeholder="Paste token from website → Account → Generate"
            rows={3}
            className="mt-2 w-full resize-none rounded-lg border border-white/[0.08] bg-[#1e1e1e] px-3 py-2 font-mono text-[11px] text-white/85"
          />
          <button
            type="button"
            onClick={applyToken}
            disabled={busy || !pasteToken.trim()}
            className="mt-2 w-full rounded-lg border border-white/[0.12] py-2.5 text-[13px] font-medium text-white/85 hover:bg-white/[0.06] disabled:opacity-40"
          >
            Connect with token
          </button>
        </div>

        <div className="mt-8 border-t border-white/[0.06] pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">License key</p>
          <textarea
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your license key"
            rows={4}
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-[#1e1e1e] px-3 py-2.5 font-mono text-[12px] text-white/85 placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
          />
        </div>

        {error ? (
          <p className="mt-4 text-[12px] leading-relaxed text-accent-orange">{error}</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={activate}
            disabled={busy || !key.trim()}
            className="rounded-lg bg-accent-blue px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-accent-blue/90 disabled:opacity-40"
          >
            {busy ? 'Checking…' : 'Activate with license key'}
          </button>
          <button
            type="button"
            onClick={openBuy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-transparent px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.06]"
          >
            Buy license
            <ExternalLink size={14} className="opacity-60" />
          </button>
        </div>
      </div>
    </div>
  )
}
