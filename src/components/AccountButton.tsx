import React, { useEffect, useState } from 'react'
import { LogIn, Loader2, User, LogOut, ExternalLink } from 'lucide-react'

type Account = {
  email: string
  name: string | null
  subscriptionActive: boolean
  trialActive: boolean
  trialDaysLeft: number
}

export default function AccountButton() {
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function refresh() {
    try {
      const res = await window.electronAPI.authStatus()
      setAccount(res.signedIn && res.user ? res.user : null)
    } catch {
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

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
  }

  if (loading) {
    return <div className="px-3 py-2 text-[11px] text-white/25">…</div>
  }

  if (account) {
    const plan = account.subscriptionActive
      ? { label: 'Pro', color: 'text-accent-green' }
      : account.trialActive
        ? { label: `Trial · ${account.trialDaysLeft}d`, color: 'text-accent-blue' }
        : { label: 'Free', color: 'text-white/40' }
    return (
      <div className="px-2 py-1.5 rounded-mac-sm bg-white/[0.03] border border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-accent-blue/20 flex items-center justify-center shrink-0">
            <User size={12} className="text-accent-blue" />
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
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="mac-focus w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-mac-sm bg-accent-blue/90 text-white text-[12px] font-medium hover:bg-accent-blue disabled:opacity-60 transition-colors"
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
