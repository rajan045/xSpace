import React, { useCallback, useEffect, useState } from 'react'
import { LogIn, Loader2, User, LogOut, ExternalLink, Sparkles, Check, AlertCircle } from 'lucide-react'

type Account = {
  email: string
  name: string | null
  subscriptionActive: boolean
  trialActive: boolean
  trialDaysLeft: number
}

type Plan = {
  label: string
  color: string
  /** Trial running low or already gone — the only states worth nagging about. */
  urgent: boolean
}

function planFor(account: Account): Plan {
  if (account.subscriptionActive) {
    return { label: 'Pro', color: 'text-accent-green', urgent: false }
  }
  if (account.trialActive) {
    const d = account.trialDaysLeft
    return {
      label: d === 1 ? 'Trial · last day' : `Trial · ${d}d left`,
      color: d <= 2 ? 'text-accent-orange' : 'text-accent-blue',
      urgent: d <= 2,
    }
  }
  return { label: 'Trial ended', color: 'text-accent-orange', urgent: true }
}

export default function AccountButton() {
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [buying, setBuying] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [justUpgraded, setJustUpgraded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await window.electronAPI.authStatus()
      setAccount(res.signedIn && res.user ? res.user : null)
    } catch {
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function signIn() {
    setBusy(true)
    setErr(null)
    try {
      const res = await window.electronAPI.authStartLogin()
      if (res.signedIn && res.user) {
        setAccount(res.user)
      } else {
        setErr(res.error || 'Sign-in cancelled')
      }
    } catch (e: any) {
      setErr(e?.message || 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await window.electronAPI.authLogout()
    setAccount(null)
    setJustUpgraded(false)
  }

  async function upgrade() {
    setBuying(true)
    setErr(null)
    try {
      const res = await window.electronAPI.startCheckout()
      if (res.ok) {
        if (res.status.signedIn && res.status.user) setAccount(res.status.user)
        // The webhook may still be in flight; say so rather than showing a stale plan.
        setJustUpgraded(true)
        void refresh()
      } else if (!res.cancelled) {
        setErr(res.error)
      }
    } catch (e: any) {
      setErr(e?.message || 'Checkout failed')
    } finally {
      setBuying(false)
    }
  }

  if (loading) {
    return (
      <div className="px-2 py-1.5 rounded-mac-sm bg-white/[0.03] border border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-2 w-20 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-1.5 w-12 rounded bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!account) {
    return (
      <div>
        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="mac-focus w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-mac-sm bg-white/[0.06] border border-white/[0.14] text-white/90 text-[12px] font-medium hover:bg-white/[0.12] disabled:opacity-60 transition-colors"
        >
          {busy
            ? <><Loader2 size={13} className="animate-spin" /> Waiting…</>
            : <><LogIn size={13} /> Sign in</>}
        </button>
        {busy && (
          <p className="mt-1.5 text-[10px] text-white/40 flex items-center gap-1 px-0.5">
            <ExternalLink size={9} /> Finish in your browser
          </p>
        )}
        {err && <p className="mt-1.5 text-[10px] text-accent-orange px-0.5">{err}</p>}
      </div>
    )
  }

  const plan = planFor(account)
  const showUpgrade = !account.subscriptionActive

  return (
    <div className="space-y-1.5">
      <div
        className={`px-2 py-1.5 rounded-mac-sm border transition-colors ${
          plan.urgent
            ? 'bg-accent-orange/[0.07] border-accent-orange/20'
            : 'bg-white/[0.03] border-white/[0.06]'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              account.subscriptionActive ? 'bg-accent-green/20' : 'bg-accent-blue/20'
            }`}
          >
            {account.subscriptionActive
              ? <Check size={12} className="text-accent-green" />
              : <User size={12} className="text-accent-blue" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-white/80 font-medium truncate" title={account.email}>
              {account.name || account.email}
            </div>
            <div className={`text-[10px] font-medium ${plan.color}`}>{plan.label}</div>
          </div>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            className="mac-focus p-1 rounded-mac-sm text-white/30 hover:text-white/70 hover:bg-white/[0.06]"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>

      {justUpgraded && !account.subscriptionActive && (
        <p className="text-[10px] text-white/45 flex items-start gap-1 px-0.5 leading-relaxed">
          <Loader2 size={9} className="animate-spin mt-[3px] shrink-0" />
          Payment received — activating. This can take a few seconds.
        </p>
      )}

      {showUpgrade && !justUpgraded && (
        <button
          type="button"
          onClick={upgrade}
          disabled={buying}
          className="mac-focus w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-mac-sm bg-accent-blue text-mac-window text-[12px] font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
        >
          {buying
            ? <><Loader2 size={13} className="animate-spin" /> Waiting for payment…</>
            : <><Sparkles size={13} /> Upgrade to Pro</>}
        </button>
      )}

      {buying && (
        <p className="text-[10px] text-white/40 flex items-center gap-1 px-0.5">
          <ExternalLink size={9} /> Complete payment in your browser
        </p>
      )}

      {err && (
        <p className="text-[10px] text-accent-orange flex items-start gap-1 px-0.5 leading-relaxed">
          <AlertCircle size={9} className="mt-[3px] shrink-0" />
          {err}
        </p>
      )}
    </div>
  )
}
