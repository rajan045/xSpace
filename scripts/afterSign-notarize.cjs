/**
 * electron-builder afterSign hook. Notarizes and staples the .app when Apple env vars are set.
 * Requires a "Developer ID Application" cert so codesign runs before notarytool.
 *
 * Loads `spaceX/.env.signing` if present (see `.env.signing.example`). Exporting the same
 * vars in the shell also works.
 */
const path = require("path");
const fs = require("fs");

const signingEnv = path.join(__dirname, "..", ".env.signing");
if (fs.existsSync(signingEnv)) {
  require("dotenv").config({ path: signingEnv });
}

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appleId = process.env.APPLE_ID?.trim();
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim();
  const teamId = process.env.APPLE_TEAM_ID?.trim();

  if (!appleId || !appleIdPassword || !teamId) {
    const signed = process.env.MAC_BUILD_SIGNED === "1";
    console.log(
      "[afterSign] Skipping notarization. Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID (e.g. in .env.signing from .env.signing.example)."
    );
    if (signed) {
      console.warn(
        "[afterSign] Signed but not notarized: macOS will show “Apple could not verify…” (Gatekeeper). Create .env.signing and rebuild, or use System Settings → Privacy & Security → Open Anyway once."
      );
    }
    return;
  }

  const { notarize } = require("@electron/notarize");
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;

  console.log(`[afterSign] Notarizing ${appPath} …`);
  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
  console.log("[afterSign] Notarization finished.");
};
