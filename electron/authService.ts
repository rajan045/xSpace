import * as authStore from "./authStore";
import { getOrCreateMachineId } from "./machineId";

const DEFAULT_API_BASE = "http://localhost:4000";

/**
 * xspace-api base URL (no trailing slash).
 * If `XSPACE_API_URL` is unset or empty, always falls back to `http://localhost:4000`
 * so token validate and auth work without a `.env` file. Set `XSPACE_API_URL` for staging/production APIs.
 */
export function getApiBase(): string {
  // Never use `env?.replace(...).trim()` — if env is undefined, `.trim()` runs on undefined and throws.
  const raw = (process.env.XSPACE_API_URL ?? "").replace(/\/$/, "").trim();
  if (raw) return raw;
  return DEFAULT_API_BASE;
}

function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8")) as {
      exp?: number;
    };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function accessNeedsRefresh(token: string | null): boolean {
  if (!token) return true;
  const exp = parseJwtExp(token);
  if (!exp) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp - nowSec < 90;
}

async function refreshSession(): Promise<boolean> {
  const base = getApiBase();
  const refresh = authStore.getRefreshToken();
  if (!base || !refresh) return false;

  const res = await fetch(`${base}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) {
    authStore.clearAuth();
    return false;
  }
  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  authStore.setSessionTokens(data.accessToken, data.refreshToken);
  return true;
}

export async function ensureAccessToken(): Promise<string | null> {
  let access = authStore.getAccessToken();
  if (!accessNeedsRefresh(access)) {
    return access;
  }
  const ok = await refreshSession();
  return ok ? authStore.getAccessToken() : null;
}

export async function login(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = getApiBase();
  if (!base) {
    return {
      ok: false,
      error:
        "Set XSPACE_API_URL in spaceX/.env (e.g. http://localhost:4000) for packaged builds.",
    };
  }
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = (await res.json()) as {
    error?: string;
    accessToken?: string;
    refreshToken?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error || "Login failed" };
  }
  if (!data.accessToken || !data.refreshToken) {
    return { ok: false, error: "Invalid response" };
  }
  authStore.setSessionTokens(data.accessToken, data.refreshToken);
  await generateApiTokenAfterLogin();
  await syncEntitlementFromApi();
  return { ok: true };
}

export async function register(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = getApiBase();
  if (!base) {
    return {
      ok: false,
      error:
        "Set XSPACE_API_URL in spaceX/.env (e.g. http://localhost:4000) for packaged builds.",
    };
  }
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = (await res.json()) as {
    error?: string;
    accessToken?: string;
    refreshToken?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error || "Registration failed" };
  }
  if (!data.accessToken || !data.refreshToken) {
    return { ok: false, error: "Invalid response" };
  }
  authStore.setSessionTokens(data.accessToken, data.refreshToken);
  await generateApiTokenAfterLogin();
  await syncEntitlementFromApi();
  return { ok: true };
}

async function generateApiTokenAfterLogin(): Promise<void> {
  const access = await ensureAccessToken();
  const base = getApiBase();
  if (!base || !access) return;

  const res = await fetch(`${base}/api/tokens/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`,
    },
    body: JSON.stringify({ name: "xSpace Mac" }),
  });
  const data = (await res.json()) as { token?: string };
  if (res.ok && data.token) {
    authStore.setApiToken(data.token);
  }
}

export async function generateApiToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const access = await ensureAccessToken();
  const base = getApiBase();
  if (!base || !access) {
    return { ok: false, error: "Not signed in" };
  }
  const res = await fetch(`${base}/api/tokens/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`,
    },
    body: JSON.stringify({ name: "xSpace Mac" }),
  });
  const data = (await res.json()) as { error?: string; token?: string };
  if (!res.ok) {
    return { ok: false, error: data.error || "Could not generate token" };
  }
  if (!data.token) {
    return { ok: false, error: "Invalid response" };
  }
  authStore.setApiToken(data.token);
  await syncEntitlementFromApi();
  return { ok: true, token: data.token };
}

export type SyncEntitlementResult =
  | { ok: true; email: string; subscriptionActive: boolean }
  | { ok: false; error: string; clearedToken?: boolean };

/**
 * Calls POST /api/tokens/validate. Returns structured errors (403/409/401/network)
 * so the UI can show actionable messages instead of a generic failure.
 */
export async function syncEntitlementFromApi(): Promise<SyncEntitlementResult> {
  const api = authStore.getApiToken();
  if (!api) {
    authStore.clearEntitlementCache();
    return { ok: false, error: "No API token stored" };
  }

  const machineId = getOrCreateMachineId();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${getApiBase()}/api/tokens/validate`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Token": api,
      },
      body: JSON.stringify({ machineId }),
    });

    const text = await res.text();
    let data: {
      user?: { email?: string; subscriptionActive?: boolean };
      error?: string;
    } = {};
    if (text) {
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        return {
          ok: false,
          error: `Could not parse API response (${res.status}). Is the URL correct? ${getApiBase()}`,
        };
      }
    }

    if (res.status === 401) {
      authStore.setApiToken(null);
      authStore.clearEntitlementCache();
      return {
        ok: false,
        error: data.error || "Invalid or revoked token",
        clearedToken: true,
      };
    }

    if (!res.ok) {
      const hint =
        res.status === 409
          ? " This Mac may already be linked to another account."
          : res.status === 403
            ? " Device limit reached for this account."
            : "";
      return {
        ok: false,
        error: (data.error || `HTTP ${res.status}`) + hint,
      };
    }

    const email = data.user?.email;
    const subscriptionActive = Boolean(data.user?.subscriptionActive);
    if (!email) {
      return { ok: false, error: "API response did not include your email" };
    }
    authStore.setEntitlementCache(email, subscriptionActive);
    return { ok: true, email, subscriptionActive };
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "Request timed out — check that xspace-api is running on port 4000 (or set XSPACE_API_URL)."
        : e instanceof Error
          ? `Network error: ${e.message}`
          : "Network error";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

export function logoutAuth(): void {
  authStore.clearAuth();
}

export async function setApiTokenFromUser(token: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, error: "Token required" };
  }
  authStore.clearEntitlementCache();
  authStore.setApiToken(trimmed);
  try {
    const result = await syncEntitlementFromApi();
    if (result.ok === true) {
      return { ok: true };
    }
    return {
      ok: false,
      error: result.error || "Token validation failed",
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Token validation failed — restart the app after running: npm run electron-dev (rebuilds dist-electron).",
    };
  }
}

export function getAuthStateForRenderer(): {
  hasApiToken: boolean;
  hasSession: boolean;
  email: string | null;
  subscriptionActive: boolean;
  machineId: string;
} {
  const machineId = getOrCreateMachineId();
  const display = authStore.getAccountDisplayInfo();
  return {
    hasApiToken: Boolean(authStore.getApiToken()),
    hasSession: Boolean(authStore.getRefreshToken()),
    email: display.email,
    subscriptionActive: display.subscriptionActive,
    machineId,
  };
}

export type DeviceRow = {
  id: string;
  machineIdHash: string;
  lastSeenAt: string;
  createdAt: string;
};

export type DevicesListResult = {
  maxDevices: number;
  activeDevices: number;
  devices: DeviceRow[];
};

export type TokenMeInfo = {
  id: string;
  tokenMasked: string;
  name: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

export async function fetchDevicesList(): Promise<
  { ok: true; data: DevicesListResult } | { ok: false; error: string }
> {
  const base = getApiBase();
  const access = await ensureAccessToken();
  if (!base || !access) {
    return { ok: false, error: "Not signed in" };
  }
  const res = await fetch(`${base}/api/devices`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const data = (await res.json()) as { error?: string } & Partial<DevicesListResult>;
  if (!res.ok) {
    return { ok: false, error: data.error || "Could not load devices" };
  }
  return { ok: true, data: data as DevicesListResult };
}

export async function deleteDeviceBinding(
  deviceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = getApiBase();
  const access = await ensureAccessToken();
  if (!base || !access) {
    return { ok: false, error: "Not signed in" };
  }
  const res = await fetch(
    `${base}/api/devices/${encodeURIComponent(deviceId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${access}` },
    },
  );
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error || "Could not remove device" };
  }
  return { ok: true };
}

export async function deleteAllDeviceBindings(): Promise<
  { ok: true; removed: number } | { ok: false; error: string }
> {
  const base = getApiBase();
  const access = await ensureAccessToken();
  if (!base || !access) {
    return { ok: false, error: "Not signed in" };
  }
  const res = await fetch(`${base}/api/devices`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${access}` },
  });
  const data = (await res.json()) as { error?: string; removed?: number };
  if (!res.ok) {
    return { ok: false, error: data.error || "Could not remove devices" };
  }
  return { ok: true, removed: data.removed ?? 0 };
}

export async function fetchTokenMe(): Promise<
  { ok: true; token: TokenMeInfo | null } | { ok: false; error: string }
> {
  const base = getApiBase();
  const access = await ensureAccessToken();
  if (!base || !access) {
    return { ok: false, error: "Not signed in" };
  }
  const res = await fetch(`${base}/api/tokens/me`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const data = (await res.json()) as {
    error?: string;
    token?: null;
    id?: string;
    tokenMasked?: string;
    name?: string;
    isActive?: boolean;
    lastUsedAt?: string | null;
    createdAt?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error || "Could not load token info" };
  }
  if (data.token === null) {
    return { ok: true, token: null };
  }
  if (data.id && data.tokenMasked !== undefined) {
    return {
      ok: true,
      token: {
        id: data.id,
        tokenMasked: data.tokenMasked,
        name: typeof data.name === "string" ? data.name : "",
        isActive: Boolean(data.isActive),
        lastUsedAt: data.lastUsedAt ?? null,
        createdAt:
          typeof data.createdAt === "string"
            ? data.createdAt
            : String(data.createdAt ?? ""),
      },
    };
  }
  return { ok: true, token: null };
}

export async function revokeAllApiTokens(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const base = getApiBase();
  const access = await ensureAccessToken();
  if (!base || !access) {
    return { ok: false, error: "Not signed in" };
  }
  const res = await fetch(`${base}/api/tokens/revoke`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${access}` },
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error || "Could not revoke tokens" };
  }
  authStore.setApiToken(null);
  authStore.clearEntitlementCache();
  return { ok: true };
}
