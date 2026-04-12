import React, { useCallback, useEffect, useState } from "react";
import {
  User,
  RefreshCw,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";

type AuthState = {
  hasApiToken: boolean;
  hasSession: boolean;
  email: string | null;
  subscriptionActive: boolean;
  machineId: string;
};

type DeviceRow = {
  id: string;
  machineIdHash: string;
  lastSeenAt: string;
  createdAt: string;
};

export default function Account() {
  const [state, setState] = useState<AuthState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tokenOnce, setTokenOnce] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [maxDevices, setMaxDevices] = useState<number | null>(null);
  const [activeDevices, setActiveDevices] = useState<number | null>(null);
  const [devicesErr, setDevicesErr] = useState<string | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceBusyId, setDeviceBusyId] = useState<string | null>(null);
  const [removeAllBusy, setRemoveAllBusy] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<
    | {
        id: string;
        tokenMasked: string;
        name: string;
        isActive: boolean;
        lastUsedAt: string | null;
        createdAt: string;
      }
    | null
    | undefined
  >(undefined);
  const [tokenMetaErr, setTokenMetaErr] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<
    Array<{
      eventType?: string;
      createdAt?: string;
      metadata?: Record<string, unknown>;
    }>
  >([]);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [historyEmail, setHistoryEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!window.electronAPI) return;
    const s = (await window.electronAPI.authGetState()) as AuthState;
    setState(s);
  }, []);

  const loadSessionExtras = useCallback(async (hasSession: boolean) => {
    if (!window.electronAPI) return;
    if (hasSession) {
      setDevicesLoading(true);
      setDevicesErr(null);
      setTokenMetaErr(null);
      const [d, t] = await Promise.all([
        window.electronAPI.authFetchDevices(),
        window.electronAPI.authFetchTokenMe(),
      ]);
      setDevicesLoading(false);
      if (d.ok) {
        setDevices(d.data.devices);
        setMaxDevices(d.data.maxDevices);
        setActiveDevices(d.data.activeDevices);
      } else {
        setDevicesErr(d.error);
      }
      if (t.ok) {
        setTokenInfo(t.token);
      } else {
        setTokenMetaErr(t.error);
      }
    } else {
      setDevices([]);
      setMaxDevices(null);
      setActiveDevices(null);
      setTokenInfo(undefined);
    }

    setHistoryErr(null);
    const h = await window.electronAPI.subscriptionHistoryMe(20);
    if (h.ok) {
      setHistoryEvents(h.data.events);
      setHistoryEmail(h.data.email);
    } else if (h.error !== "No license key") {
      setHistoryErr(h.error);
    } else {
      setHistoryEvents([]);
      setHistoryEmail(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!state) return;
    void loadSessionExtras(state.hasSession);
  }, [state, loadSessionExtras]);

  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onLicenseChanged(() => {
      void (async () => {
        await load();
        if (!window.electronAPI) return;
        const s = await window.electronAPI.authGetState();
        void loadSessionExtras(s.hasSession);
      })();
    });
  }, [load, loadSessionExtras]);

  const sync = async () => {
    if (!window.electronAPI) return;
    setBusy(true);
    setErr(null);
    try {
      const next = (await window.electronAPI.authSyncEntitlement()) as AuthState;
      setState(next);
      await loadSessionExtras(next.hasSession);
    } catch {
      setErr("Sync failed");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!window.electronAPI) return;
    setBusy(true);
    await window.electronAPI.authLogout();
    setTokenOnce(null);
    await load();
    setBusy(false);
  };

  const generate = async () => {
    if (!window.electronAPI) return;
    setBusy(true);
    setErr(null);
    const res = (await window.electronAPI.authGenerateToken()) as
      | { ok: true; token: string }
      | { ok: false; error: string };
    setBusy(false);
    if (res.ok) {
      setTokenOnce(res.token);
      if (state?.hasSession) void loadSessionExtras(true);
    } else {
      setErr(res.error || "Could not generate");
    }
  };

  const removeOne = async (id: string) => {
    if (!window.electronAPI) return;
    if (
      !confirm(
        "Remove this device? The app on that machine will need to sign in again.",
      )
    ) {
      return;
    }
    setDeviceBusyId(id);
    setDevicesErr(null);
    const res = await window.electronAPI.authDeleteDevice(id);
    setDeviceBusyId(null);
    if (!res.ok) {
      setDevicesErr(res.error);
      return;
    }
    void loadSessionExtras(true);
  };

  const removeAllDevices = async () => {
    if (!window.electronAPI) return;
    if (
      !confirm(
        "Remove all devices? Every machine will need a new token or sign-in.",
      )
    ) {
      return;
    }
    setRemoveAllBusy(true);
    setDevicesErr(null);
    const res = await window.electronAPI.authDeleteAllDevices();
    setRemoveAllBusy(false);
    if (!res.ok) {
      setDevicesErr(res.error);
      return;
    }
    void loadSessionExtras(true);
  };

  const revokeTokens = async () => {
    if (!window.electronAPI) return;
    if (
      !confirm(
        "Revoke your API token and disconnect all devices? Generate a new token afterward.",
      )
    ) {
      return;
    }
    setRevokeBusy(true);
    setTokenMetaErr(null);
    const res = await window.electronAPI.authRevokeTokens();
    setRevokeBusy(false);
    if (!res.ok) {
      setTokenMetaErr(res.error);
      return;
    }
    setTokenOnce(null);
    await load();
    void loadSessionExtras(true);
  };

  const applyPaste = async () => {
    if (!window.electronAPI) return;
    setBusy(true);
    setErr(null);
    const res = (await window.electronAPI.authSetApiToken(paste)) as
      | { ok: true }
      | { ok: false; error: string };
    setBusy(false);
    if (res.ok) {
      await sync();
      setPaste("");
      await load();
    } else {
      setErr(
        res.error ||
          "Could not validate token. Ensure xspace-api is running (e.g. port 4000). Requests run in the app backend, not in this window’s Network tab.",
      );
    }
  };

  if (!state) {
    return (
      <div className="text-[13px] text-white/35">Loading…</div>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Account"
        subtitle="Connect to xspace-api with the same email as on the website."
      />

      <div className="mt-6 space-y-6">
        <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2c] p-5">
          <div className="flex items-center gap-2 text-white/70">
            <User size={16} strokeWidth={2} />
            <span className="text-[12px] font-semibold uppercase tracking-wide">
              Status
            </span>
          </div>
          <p className="mt-3 text-[13px] text-white/55">
            {state.email ? (
              <>
                Signed in as{" "}
                <span className="text-white/85">{state.email}</span>
                {state.subscriptionActive ? (
                  <span className="text-accent-green"> · subscription active</span>
                ) : (
                  <span className="text-white/40"> · no active subscription</span>
                )}
              </>
            ) : (
              "Not connected — paste an app token from the website or sign in from the paywall."
            )}
          </p>
          <p className="mt-2 font-mono text-[10px] text-white/30 break-all">
            Machine ID: {state.machineId}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sync}
              disabled={busy || !state.hasApiToken}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-[12px] font-medium text-white/90 hover:bg-white/[0.1] disabled:opacity-40"
            >
              <RefreshCw size={14} />
              Sync entitlement
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={busy || (!state.hasSession && !state.hasApiToken)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] px-3 py-2 text-[12px] font-medium text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
            >
              <LogOut size={14} />
              Disconnect
            </button>
          </div>
        </div>

        {state.hasSession ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2c] p-5">
            <div className="flex items-center gap-2 text-white/70">
              <MonitorSmartphone size={16} strokeWidth={2} />
              <span className="text-[12px] font-semibold uppercase tracking-wide">
                Connected devices
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-white/45">
              Machines linked to your account. Remove entries to free slots if you hit
              device limits.
            </p>
            {devicesLoading ? (
              <p className="mt-3 text-[12px] text-white/35">Loading devices…</p>
            ) : devicesErr ? (
              <p className="mt-3 text-[12px] text-accent-orange">{devicesErr}</p>
            ) : (
              <>
                <p className="mt-2 text-[11px] text-white/40">
                  {activeDevices ?? 0} active
                  {maxDevices != null ? ` · max ${maxDevices}` : ""}
                </p>
                {devices.length === 0 ? (
                  <p className="mt-2 text-[12px] text-white/35">
                    No devices registered yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {devices.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-[#1e1e1e]/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-mono text-[11px] text-white/80">
                            {d.machineIdHash}
                          </p>
                          <p className="text-[10px] text-white/30">
                            Last seen:{" "}
                            {d.lastSeenAt
                              ? new Date(d.lastSeenAt).toLocaleString()
                              : "—"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={deviceBusyId === d.id}
                          onClick={() => void removeOne(d.id)}
                          className="shrink-0 rounded-md border border-white/[0.12] px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          {deviceBusyId === d.id ? "Removing…" : "Remove"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  disabled={removeAllBusy || devices.length === 0}
                  onClick={() => void removeAllDevices()}
                  className="mt-3 w-full rounded-lg border border-accent-orange/40 py-2 text-[12px] font-medium text-accent-orange hover:bg-accent-orange/10 disabled:opacity-40"
                >
                  {removeAllBusy ? "Removing…" : "Remove all devices"}
                </button>
              </>
            )}
          </div>
        ) : null}

        <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2c] p-5">
          <div className="flex items-center gap-2 text-white/70">
            <KeyRound size={16} strokeWidth={2} />
            <span className="text-[12px] font-semibold uppercase tracking-wide">
              App token
            </span>
          </div>
          {state.hasSession ? (
            tokenMetaErr ? (
              <p className="mt-2 text-[12px] text-accent-orange">{tokenMetaErr}</p>
            ) : tokenInfo === undefined ? (
              <p className="mt-2 text-[12px] text-white/35">Loading…</p>
            ) : tokenInfo ? (
              <p className="mt-2 font-mono text-[11px] text-white/75">
                Active: {tokenInfo.tokenMasked}
                {tokenInfo.name ? ` · ${tokenInfo.name}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-white/45">No active token</p>
            )
          ) : null}
          <p className="mt-2 text-[12px] leading-relaxed text-white/45">
            Generate a new token (invalidates the previous one). Use this in other
            Macs or after revoking on the website.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={busy || !state.hasSession}
            className="mt-3 rounded-lg bg-accent-blue px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-blue/90 disabled:opacity-40"
          >
            {busy ? "…" : "Generate new token"}
          </button>
          {tokenOnce ? (
            <div className="mt-3">
              <p className="text-[11px] text-accent-green">Copy now — shown once.</p>
              <textarea
                readOnly
                value={tokenOnce}
                rows={3}
                className="mt-1 w-full resize-none rounded-lg border border-white/[0.08] bg-[#1e1e1e] px-2 py-1.5 font-mono text-[10px] text-white/85"
              />
            </div>
          ) : null}
          {state.hasSession ? (
            <button
              type="button"
              disabled={revokeBusy}
              onClick={() => void revokeTokens()}
              className="mt-3 w-full rounded-lg border border-red-500/35 py-2 text-[12px] font-medium text-red-400/90 hover:bg-red-500/10 disabled:opacity-40"
            >
              {revokeBusy ? "Revoking…" : "Revoke API token & disconnect devices"}
            </button>
          ) : null}
        </div>

        {historyEmail || historyErr || historyEvents.length > 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2c] p-5">
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left text-white/70"
            >
              <span className="text-[12px] font-semibold uppercase tracking-wide">
                License activity
              </span>
              {historyOpen ? (
                <ChevronDown size={16} className="text-white/45" />
              ) : (
                <ChevronRight size={16} className="text-white/45" />
              )}
            </button>
            {historyErr ? (
              <p className="mt-2 text-[12px] text-accent-orange">{historyErr}</p>
            ) : null}
            {historyOpen ? (
              <div className="mt-3 space-y-2">
                {historyEmail ? (
                  <p className="text-[11px] text-white/40">{historyEmail}</p>
                ) : null}
                {historyEvents.length === 0 ? (
                  <p className="text-[12px] text-white/35">No events yet.</p>
                ) : (
                  <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {historyEvents.map((ev, i) => (
                      <li
                        key={`${ev.createdAt ?? i}-${i}`}
                        className="rounded-md border border-white/[0.06] bg-[#1e1e1e]/80 px-2 py-1.5 text-[11px] text-white/60"
                      >
                        <span className="text-white/85">
                          {ev.eventType ?? "event"}
                        </span>
                        {ev.createdAt ? (
                          <span className="ml-2 text-white/35">
                            {new Date(ev.createdAt).toLocaleString()}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-white/35">
                Recent subscription events for your license key.
              </p>
            )}
          </div>
        ) : null}

        <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2c] p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-white/50">
            Paste token from website
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/35">
            The app must reach the same API as the site. For local dev, run xspace-api on
            port 4000 or set <span className="font-mono text-white/45">XSPACE_API_URL</span>{" "}
            in <span className="font-mono text-white/45">spaceX/.env</span> (dev defaults to
            http://localhost:4000 if unset).
          </p>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Paste token from Account page on the website"
            rows={3}
            className="no-drag mt-2 w-full resize-none rounded-lg border border-white/[0.08] bg-[#1e1e1e] px-2 py-1.5 font-mono text-[11px] text-white/85"
          />
          <button
            type="button"
            onClick={applyPaste}
            disabled={busy || !paste.trim()}
            className="mt-2 rounded-lg border border-white/[0.12] px-4 py-2 text-[12px] font-medium text-white/85 hover:bg-white/[0.06] disabled:opacity-40"
          >
            Save token
          </button>
        </div>

        {err ? (
          <p className="text-[12px] text-accent-orange">{err}</p>
        ) : null}
      </div>
    </div>
  );
}
