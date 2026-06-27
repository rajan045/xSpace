/**
 * Fail fast before electron-builder if notarization env is missing.
 * Same `.env.signing` path and vars as scripts/afterSign-notarize.cjs.
 */
const path = require("path");
const fs = require("fs");

const signingEnv = path.join(__dirname, "..", ".env.signing");
if (fs.existsSync(signingEnv)) {
  require("dotenv").config({ path: signingEnv });
}

const required = [
  ["APPLE_ID", process.env.APPLE_ID?.trim()],
  ["APPLE_APP_SPECIFIC_PASSWORD", process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim()],
  ["APPLE_TEAM_ID", process.env.APPLE_TEAM_ID?.trim()],
];

const missing = required.filter(([, v]) => !v).map(([k]) => k);

if (missing.length > 0) {
  console.error(
    "[check-release-env] Missing notarization env: " + missing.join(", ")
  );
  console.error(
    "[check-release-env] Set them in spaceX/.env.signing (see .env.signing.example) or export in your shell."
  );
  process.exit(1);
}

console.log(
  "[check-release-env] APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID present."
);
