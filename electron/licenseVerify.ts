import crypto from "crypto";
import { LICENSE_PUBLIC_KEY_PEM } from "./licensePublicKey";

export type LicensePayload = {
  v: 1;
  email: string;
  issuedAt: string;
  product: "xspace";
};

function canonicalPayloadString(p: LicensePayload): string {
  return JSON.stringify({
    v: p.v,
    email: p.email,
    issuedAt: p.issuedAt,
    product: p.product,
  });
}

export function verifyLicenseKey(key: string): LicensePayload | null {
  try {
    const json = Buffer.from(key, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { payload: LicensePayload; sig: string };
    const { payload, sig } = parsed;
    if (payload.v !== 1 || payload.product !== "xspace") return null;
    const canonical = canonicalPayloadString(payload);
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(canonical);
    verify.end();
    const ok = verify.verify(LICENSE_PUBLIC_KEY_PEM, sig, "base64");
    return ok ? payload : null;
  } catch {
    return null;
  }
}
