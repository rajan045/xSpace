import { app } from "electron";
import { getApiBase } from "./apiBase";
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
