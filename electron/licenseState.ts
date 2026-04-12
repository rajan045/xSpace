import Store from "electron-store";
import { getApiBase } from "./authService";
import { getCachedSubscriptionEntitlement } from "./authStore";
import { verifyLicenseKey } from "./licenseVerify";

const DEFAULT_TRIAL_DAYS = 7;
/** Set from xspace-api GET /api/config/pricing when XSPACE_API_URL is set. */
let effectiveTrialDays = DEFAULT_TRIAL_DAYS;

/** Call on startup so trial length matches the backend (falls back to 7). */
export async function syncPublicConfigFromApi(): Promise<void> {
  const base = getApiBase();
  if (!base) return;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${base}/api/config/pricing`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { trialDays?: number };
    if (
      typeof data.trialDays === "number" &&
      data.trialDays >= 1 &&
      data.trialDays <= 365
    ) {
      effectiveTrialDays = Math.floor(data.trialDays);
    }
  } catch {
    /* offline */
  } finally {
    clearTimeout(t);
  }
}

type LicenseSchema = {
  trialStartedAt: string | null;
  licenseKey: string | null;
  /** After user dismisses the first-run trial welcome modal */
  trialWelcomeDismissed: boolean;
};

const store = new Store<LicenseSchema>({
  name: "xspace-license",
  defaults: {
    trialStartedAt: null,
    licenseKey: null,
    trialWelcomeDismissed: false,
  },
});

export type LicenseStatus =
  | { state: "licensed"; email?: string }
  | { state: "trial"; daysLeft: number; showWelcome: boolean }
  | { state: "expired" };

function ensureTrialStarted(): void {
  if (!store.get("trialStartedAt")) {
    store.set("trialStartedAt", new Date().toISOString());
  }
}

export function getLicenseStatus(): LicenseStatus {
  ensureTrialStarted();
  const key = store.get("licenseKey");
  if (key) {
    const payload = verifyLicenseKey(key);
    if (payload) {
      return { state: "licensed", email: payload.email };
    }
  }

  const serverSub = getCachedSubscriptionEntitlement();
  if (serverSub?.active) {
    return { state: "licensed", email: serverSub.email };
  }

  const start = store.get("trialStartedAt");
  const trialLen = effectiveTrialDays;

  if (!start) {
    const showWelcome = !store.get("trialWelcomeDismissed");
    return { state: "trial", daysLeft: trialLen, showWelcome };
  }

  const elapsedMs = Date.now() - new Date(start).getTime();
  const elapsedDays = elapsedMs / (86_400_000);
  if (elapsedDays >= trialLen) {
    return { state: "expired" };
  }

  const daysLeft = Math.max(1, Math.ceil(trialLen - elapsedDays));
  const showWelcome = !store.get("trialWelcomeDismissed");
  return { state: "trial", daysLeft, showWelcome };
}

export function dismissTrialWelcome(): LicenseStatus {
  store.set("trialWelcomeDismissed", true);
  return getLicenseStatus();
}

export function setLicenseKey(key: string): { ok: boolean; error?: string } {
  const trimmed = key.trim().replace(/\s+/g, "");
  const payload = verifyLicenseKey(trimmed);
  if (!payload) {
    return { ok: false, error: "Invalid license key" };
  }
  store.set("licenseKey", trimmed);
  return { ok: true };
}

/** Stored lifetime license key (for subscription analytics / history APIs). */
export function getStoredLicenseKey(): string | null {
  const key = store.get("licenseKey");
  return key?.trim() || null;
}
