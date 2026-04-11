/**
 * electron-builder afterSign hook. Notarizes the .app when Apple env vars are set.
 * Requires a "Developer ID Application" cert so codesign runs before notarytool.
 * If env vars are missing, the build still succeeds (typical for local unsigned builds).
 */
module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appleId = process.env.APPLE_ID?.trim();
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim();
  const teamId = process.env.APPLE_TEAM_ID?.trim();

  if (!appleId || !appleIdPassword || !teamId) {
    console.log(
      "[afterSign] Skipping notarization. For public downloads: Apple Developer account, Developer ID Application certificate in Keychain, then set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID."
    );
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
