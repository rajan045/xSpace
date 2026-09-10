import http from "http";
import { shell } from "electron";
import { getApiBase } from "./apiBase";
import { ensureAccess, getStatus, type AuthStatus } from "./auth";

/**
 * In-app purchase flow.
 *
 * The order is created by the API against this machine's signed-in session, so the
 * buyer is fixed server-side before Razorpay ever opens — the payer cannot pay under
 * a different identity. Razorpay's checkout is a browser widget, so we serve a
 * single-purpose page from a loopback server (same pattern as sign-in) and open it
 * in the default browser. Nothing goes through the website.
 */

export type CheckoutResult =
  | { ok: true; paymentId: string; status: AuthStatus }
  | { ok: false; error: string; cancelled?: boolean };

type OrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  prefillEmail?: string;
  error?: string;
};

let activeServer: http.Server | null = null;

function escapeJs(v: string): string {
  return JSON.stringify(String(v ?? ""));
}

function checkoutPage(order: OrderResponse): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>xSpace — Checkout</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root { color-scheme: dark; }
  body{font-family:-apple-system,system-ui,sans-serif;background:#0B1120;color:#fff;
       display:flex;height:100vh;margin:0;align-items:center;justify-content:center}
  .box{text-align:center;max-width:340px;padding:0 24px}
  .spinner{width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.12);
           border-top-color:#ffffff;margin:0 auto 18px;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  h1{font-size:17px;font-weight:600;margin:0 0 6px}
  p{color:rgba(255,255,255,.55);font-size:13px;line-height:1.5;margin:0}
  .err{color:rgba(255,255,255,.85)}
  button{margin-top:18px;padding:9px 18px;border-radius:9px;border:0;background:#ffffff;
         color:#0B1120;font-size:13px;font-weight:500;cursor:pointer}
</style></head>
<body><div class="box" id="root">
  <div class="spinner"></div>
  <h1>Opening secure checkout…</h1>
  <p>Complete your payment in the Razorpay window.</p>
</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  var root = document.getElementById('root');
  function show(title, msg, cls) {
    root.innerHTML = '<h1>' + title + '</h1><p class="' + (cls || '') + '">' + msg + '</p>';
  }
  function report(path, query) {
    return fetch(path + (query || ''), { method: 'POST' }).catch(function () {});
  }
  var opts = {
    key: ${escapeJs(order.keyId)},
    order_id: ${escapeJs(order.orderId)},
    amount: ${Number(order.amount)},
    currency: ${escapeJs(order.currency)},
    name: 'xSpace',
    description: 'xSpace license',
    prefill: { email: ${escapeJs(order.prefillEmail || "")} },
    readonly: { email: true },
    theme: { color: '#0B1120' },
    modal: {
      ondismiss: function () {
        show('Checkout cancelled', 'You can close this tab and try again from the app.');
        report('/cancelled');
      }
    },
    handler: function (res) {
      show('Payment received', 'Activating your license — return to the xSpace app. You can close this tab.');
      report('/done', '?paymentId=' + encodeURIComponent(res.razorpay_payment_id));
    }
  };
  try {
    new window.Razorpay(opts).open();
  } catch (e) {
    show('Could not open checkout', String(e && e.message ? e.message : e), 'err');
    report('/cancelled');
  }
</script></body></html>`;
}

/** Poll /api/auth/me until the subscription shows active — the webhook lands asynchronously. */
async function waitForEntitlement(timeoutMs = 45000): Promise<AuthStatus> {
  const deadline = Date.now() + timeoutMs;
  let last = await getStatus();
  while (Date.now() < deadline) {
    if (last.signedIn && last.user?.subscriptionActive) return last;
    await new Promise((r) => setTimeout(r, 2000));
    last = await getStatus();
  }
  return last;
}

export async function startCheckout(
  currency: "INR" | "USD" = "INR",
): Promise<CheckoutResult> {
  const access = await ensureAccess();
  if (!access) {
    return { ok: false, error: "Sign in first, then try again." };
  }

  let order: OrderResponse;
  try {
    const res = await fetch(`${getApiBase()}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access}`,
      },
      body: JSON.stringify({ currency }),
    });
    order = (await res.json()) as OrderResponse;
    if (!res.ok) {
      return { ok: false, error: order.error || `Could not start checkout (${res.status})` };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? `Could not reach the server: ${e.message}` : "Network error",
    };
  }

  if (activeServer) {
    try { activeServer.close(); } catch { /* ignore */ }
    activeServer = null;
  }

  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    const finish = (result: CheckoutResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { server.close(); } catch { /* ignore */ }
      activeServer = null;
      resolve(result);
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

      if (url.pathname === "/" || url.pathname === "/checkout") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(checkoutPage(order));
        return;
      }

      if (url.pathname === "/done") {
        const paymentId = url.searchParams.get("paymentId") || "";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        finish(
          paymentId
            ? { ok: true, paymentId, status: { signedIn: false } }
            : { ok: false, error: "Payment finished without an id — check your email." },
        );
        return;
      }

      if (url.pathname === "/cancelled") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        finish({ ok: false, error: "Checkout cancelled", cancelled: true });
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    const timer = setTimeout(
      () => finish({ ok: false, error: "Checkout timed out. If you paid, restart the app." }),
      15 * 60 * 1000,
    );

    server.on("error", (e) => finish({ ok: false, error: e.message }));

    server.listen(0, "127.0.0.1", () => {
      activeServer = server;
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      if (!port) {
        finish({ ok: false, error: "Could not start the local checkout server" });
        return;
      }
      void shell.openExternal(`http://127.0.0.1:${port}/checkout`);
    });
  }).then(async (result) => {
    // Payment captured — wait for the webhook to grant, then hand back fresh status.
    if (result.ok) {
      const status = await waitForEntitlement();
      return { ...result, status };
    }
    return result;
  });
}
