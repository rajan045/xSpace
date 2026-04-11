/**
 * Ad-hoc (unsigned) builds + hardenedRuntime + entitlements often produce a broken
 * signature ("code has no resources but signature indicates they must be present").
 *
 * Local / unsigned DMGs: default — no hardened runtime, no entitlements (app still runs;
 * use System Settings → Privacy for Full Disk Access if needed).
 *
 * Release (Developer ID + notarize): build with
 *   MAC_BUILD_SIGNED=1 npm run build:electron
 * and your Apple signing environment (CSC_* / Keychain cert).
 */
const signed = process.env.MAC_BUILD_SIGNED === "1";

module.exports = {
  appId: "com.xspace.app",
  productName: "xSpace",
  icon: "build/icon.png",
  /** Avoid requiring GH_TOKEN when CI env vars are present locally. */
  publish: null,
  afterSign: "scripts/afterSign-notarize.cjs",
  directories: {
    output: "release",
  },
  files: ["dist/**/*", "dist-electron/**/*", "node_modules/**/*"],
  mac: {
    target: ["dmg"],
    category: "public.app-category.utilities",
    /**
     * When APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD are set, electron-builder's built-in
     * notarize path runs and can throw if `mac.notarize` is omitted (generateNotarizeOptions).
     * Notarization is handled by scripts/afterSign-notarize.cjs instead.
     */
    notarize: false,
    hardenedRuntime: signed,
    gatekeeperAssess: false,
    ...(signed
      ? {
          entitlements: "build/entitlements.mac.plist",
          entitlementsInherit: "build/entitlements.mac.plist",
        }
      : {}),
  },
};
