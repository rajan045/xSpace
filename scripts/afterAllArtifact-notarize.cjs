/**
 * electron-builder afterAllArtifactBuild hook.
 * The afterSign hook notarizes + staples the .app; this notarizes + staples the
 * final DMG container too, so the downloaded DMG itself carries a ticket
 * (cleanest Gatekeeper experience for quarantined downloads).
 *
 * Loads spaceX/.env.signing (same vars as the other signing scripts).
 */
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const signingEnv = path.join(__dirname, "..", ".env.signing");
if (fs.existsSync(signingEnv)) {
  require("dotenv").config({ path: signingEnv });
}

module.exports = async function afterAllArtifactBuild(buildResult) {
  const appleId = process.env.APPLE_ID?.trim();
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim();
  const teamId = process.env.APPLE_TEAM_ID?.trim();

  const dmgs = (buildResult.artifactPaths || []).filter((p) => p.endsWith(".dmg"));
  if (dmgs.length === 0) return [];

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn(
      "[afterAllArtifactBuild] Skipping DMG notarization — set APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID in .env.signing.",
    );
    return [];
  }

  for (const dmg of dmgs) {
    console.log(`[afterAllArtifactBuild] Notarizing DMG ${dmg} …`);
    execFileSync(
      "xcrun",
      ["notarytool", "submit", dmg, "--apple-id", appleId, "--password", appleIdPassword, "--team-id", teamId, "--wait"],
      { stdio: "inherit" },
    );
    console.log(`[afterAllArtifactBuild] Stapling ${dmg} …`);
    execFileSync("xcrun", ["stapler", "staple", dmg], { stdio: "inherit" });
    console.log(`[afterAllArtifactBuild] Done: ${dmg}`);
  }

  return [];
};
