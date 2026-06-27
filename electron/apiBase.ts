const DEFAULT_API_BASE = "http://localhost:4000";

/** xspace-api base URL (no trailing slash). */
export function getApiBase(): string {
  const raw = (process.env.XSPACE_API_URL ?? "").replace(/\/$/, "").trim();
  if (raw) return raw;
  return DEFAULT_API_BASE;
}
