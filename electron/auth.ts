import http from "http";
import { shell } from "electron";
import Store from "electron-store";
import { getApiBase } from "./apiBase";

const DEFAULT_WEB_BASE = "http://localhost:3000";

/** Website base URL (where /login lives). */
export function getWebBase(): string {
  const raw = (process.env.XSPACE_WEB_URL ?? "").replace(/\/$/, "").trim();
  return raw || DEFAULT_WEB_BASE;
}

type AuthSchema = { accessToken: string | null; refreshToken: string | null };

const store = new Store<AuthSchema>({
  name: "xspace-auth",
  defaults: { accessToken: null, refreshToken: null },
});

export function getTokens(): { accessToken: string | null; refreshToken: string | null } {
  return { accessToken: store.get("accessToken"), refreshToken: store.get("refreshToken") };
}
function setTokens(access: string, refresh: string): void {
  store.set("accessToken", access);
  store.set("refreshToken", refresh);
}
export function clearTokens(): void {
  store.set("accessToken", null);
  store.set("refreshToken", null);
}

function parseJwtExp(token: string): number | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8")) as { exp?: number };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function accessNeedsRefresh(token: string | null): boolean {
  if (!token) return true;
  const exp = parseJwtExp(token);
  if (!exp) return true;
  return exp - Math.floor(Date.now() / 1000) < 90;
}

async function refreshSession(): Promise<boolean> {
  const refresh = store.get("refreshToken");
  if (!refresh) return false;
  try {
    const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function ensureAccess(): Promise<string | null> {
  const access = store.get("accessToken");
  if (access && !accessNeedsRefresh(access)) return access;
  if (await refreshSession()) return store.get("accessToken");
  return null;
}

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  subscriptionActive: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
};

export type AuthStatus = { signedIn: boolean; user?: AuthUser };

export async function getStatus(): Promise<AuthStatus> {
  const access = await ensureAccess();
  if (!access) return { signedIn: false };
  try {
    const res = await fetch(`${getApiBase()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!res.ok) {
      if (res.status === 401) clearTokens();
      return { signedIn: false };
    }
    return { signedIn: true, user: (await res.json()) as AuthUser };
  } catch {
    return { signedIn: false };
  }
}

export function logout(): AuthStatus {
  clearTokens();
  return { signedIn: false };
}

const SUCCESS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Signed in</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#0B1120;color:#fff;display:flex;height:100vh;margin:0;align-items:center;justify-content:center}
.box{text-align:center}.c{width:56px;height:56px;border-radius:16px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#ffffff;font-size:28px}</style></head>
<body><div class="box"><div class="c">✓</div><h1 style="font-size:18px">You're signed in</h1>
<p style="color:rgba(255,255,255,.55);font-size:14px">Return to the xSpace app — you can close this tab.</p></div></body></html>`;

let activeServer: http.Server | null = null;

/**
 * Opens the website login in the browser and waits for it to hand tokens back to a
 * temporary loopback server. Resolves with the signed-in status.
 */
export function startBrowserLogin(): Promise<AuthStatus> {
  if (activeServer) {
    try { activeServer.close(); } catch { /* ignore */ }
    activeServer = null;
  }

  return new Promise<AuthStatus>((resolve, reject) => {
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { server.close(); } catch { /* ignore */ }
      activeServer = null;
      fn();
    };

    const server = http.createServer((req, res) => {
      let url: URL;
      try {
        url = new URL(req.url ?? "", "http://127.0.0.1");
      } catch {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const accessToken = url.searchParams.get("accessToken");
      const refreshToken = url.searchParams.get("refreshToken");
      if (!accessToken || !refreshToken) {
        res.writeHead(400);
        res.end("Missing tokens");
        return;
      }
      setTokens(accessToken, refreshToken);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(SUCCESS_HTML);
      finish(() => {
        getStatus()
          .then(resolve)
          .catch(() => resolve({ signedIn: true }));
      });
    });

    const timer = setTimeout(() => {
      finish(() => reject(new Error("Sign-in timed out. Please try again.")));
    }, 5 * 60 * 1000);

    server.on("error", (e) => finish(() => reject(e)));

    server.listen(0, "127.0.0.1", () => {
      activeServer = server;
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      if (!port) {
        finish(() => reject(new Error("Could not start local sign-in server")));
        return;
      }
      void shell.openExternal(`${getWebBase()}/login?app_port=${port}`);
    });
  });
}
