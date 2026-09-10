/**
 * Ad-hoc (unsigned) builds + hardenedRuntime + entitlements often produce a broken
 * signature ("code has no resources but signature indicates they must be present").
 *
 * Default `npm run build:electron`: Developer ID signing (MAC_BUILD_SIGNED=1, hardened
 * runtime + entitlements). Requires a "Developer ID Application" cert in Keychain and
 * network access for codesign timestamping.
 *
 * Local ad-hoc (unsigned): `npm run build:electron:unsigned` — sets
 * CSC_IDENTITY_AUTO_DISCOVERY=false; no hardened runtime (avoids broken ad-hoc + entitlements).
 *
 * Notarization (required for public DMG / no Gatekeeper block): copy `.env.signing.example`
 * to `.env.signing` with APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID (loaded in afterSign).
 */
const signed = process.env.MAC_BUILD_SIGNED === "1";

module.exports = {
  appId: "com.xspace.app",
  productName: "xSpace",
  /** DMG filename: xspace-5.0.0-arm64.dmg (uses package.json `name`, lowercase). */
  artifactName: "${name}-${version}-${arch}.${ext}",
  icon: "build/icon.png",
  /** Avoid requiring GH_TOKEN when CI env vars are present locally. */
  publish: null,
  afterSign: "scripts/afterSign-notarize.cjs",
  afterAllArtifactBuild: "scripts/afterAllArtifact-notarize.cjs",
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
