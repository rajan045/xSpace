import Store from "electron-store";

const ENT_TTL_MS = 60 * 60 * 1000;

type AuthSchema = {
  refreshToken: string | null;
  accessToken: string | null;
  apiToken: string | null;
  entitlementEmail: string | null;
  entitlementSubscriptionActive: boolean;
  entitlementCachedAt: number | null;
};

const store = new Store<AuthSchema>({
  name: "xspace-auth",
  defaults: {
    refreshToken: null,
    accessToken: null,
    apiToken: null,
    entitlementEmail: null,
    entitlementSubscriptionActive: false,
    entitlementCachedAt: null,
  },
});

export function getRefreshToken(): string | null {
  return store.get("refreshToken");
}

export function getAccessToken(): string | null {
  return store.get("accessToken");
}

export function getApiToken(): string | null {
  return store.get("apiToken");
}

export function setSessionTokens(access: string, refresh: string): void {
  store.set("accessToken", access);
  store.set("refreshToken", refresh);
}

export function setApiToken(token: string | null): void {
  store.set("apiToken", token?.trim() || null);
}

export function clearAuth(): void {
  store.set("refreshToken", null);
  store.set("accessToken", null);
  store.set("apiToken", null);
  store.set("entitlementEmail", null);
  store.set("entitlementSubscriptionActive", false);
  store.set("entitlementCachedAt", null);
}

export function setEntitlementCache(
  email: string,
  subscriptionActive: boolean,
): void {
  store.set("entitlementEmail", email);
  store.set("entitlementSubscriptionActive", subscriptionActive);
  store.set("entitlementCachedAt", Date.now());
}

export function getCachedSubscriptionEntitlement(): {
  active: boolean;
  email: string;
} | null {
  const at = store.get("entitlementCachedAt");
  if (!at || Date.now() - at > ENT_TTL_MS) {
    return null;
  }
  const active = store.get("entitlementSubscriptionActive");
  const email = store.get("entitlementEmail");
  if (!active || !email) {
    return null;
  }
  return { active: true, email };
}

/** Last successful validate (within TTL) — for UI even when not subscribed. */
export function getAccountDisplayInfo(): {
  email: string | null;
  subscriptionActive: boolean;
} {
  const at = store.get("entitlementCachedAt");
  if (!at || Date.now() - at > ENT_TTL_MS) {
    return { email: null, subscriptionActive: false };
  }
  return {
    email: store.get("entitlementEmail"),
    subscriptionActive: store.get("entitlementSubscriptionActive"),
  };
}

export function clearEntitlementCache(): void {
  store.set("entitlementEmail", null);
  store.set("entitlementSubscriptionActive", false);
  store.set("entitlementCachedAt", null);
}
