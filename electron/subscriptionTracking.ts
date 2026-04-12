import { app } from "electron";
import { getApiBase } from "./authService";
import { getStoredLicenseKey } from "./licenseState";

/**
 * Fire-and-forget: POST /api/subscription/events with license key (no TRACKING_API_KEY).
 * Safe to call when no key is stored — no-op.
 */
export function postAppLaunchEventFireAndForget(): void {
  const key = getStoredLicenseKey();
  if (!key) return;
  const base = getApiBase();
  const version = app.getVersion();
  void fetch(`${base}/api/subscription/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Source": "app",
    },
    body: JSON.stringify({
      eventType: "app_launch",
      licenseKey: key,
      metadata: { version },
      source: "app",
    }),
  }).catch(() => {
    /* ignore */
  });
}

export type SubscriptionHistoryEvent = {
  _id?: string;
  eventType?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
  source?: string;
};

export type SubscriptionHistoryResult = {
  email: string;
  subscriptionType?: string;
  paymentId?: string;
  events: SubscriptionHistoryEvent[];
};

export async function fetchSubscriptionHistoryMe(
  limit = 20,
): Promise<
  { ok: true; data: SubscriptionHistoryResult } | { ok: false; error: string }
> {
  const key = getStoredLicenseKey();
  if (!key) {
    return { ok: false, error: "No license key" };
  }
  const base = getApiBase();
  const q = new URLSearchParams({ limit: String(Math.min(limit, 200)) });
  const res = await fetch(`${base}/api/subscription/history/me?${q}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = (await res.json()) as { error?: string } & Partial<SubscriptionHistoryResult>;
  if (!res.ok) {
    return { ok: false, error: data.error || "Could not load history" };
  }
  return {
    ok: true,
    data: {
      email: data.email ?? "",
      subscriptionType: data.subscriptionType,
      paymentId: data.paymentId,
      events: Array.isArray(data.events) ? data.events : [],
    },
  };
}
