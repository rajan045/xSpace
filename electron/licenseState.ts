import Store from "electron-store";

type LicenseSchema = {
  trialStartedAt: string | null;
  licenseKey: string | null;
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

/** Stored license key for optional analytics (e.g. app launch event). */
export function getStoredLicenseKey(): string | null {
  const key = store.get("licenseKey");
  return key?.trim() || null;
}
