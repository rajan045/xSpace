#!/usr/bin/env bash
# Creates / refreshes the Next.js download site under ./website
# Usage (from repo root):
#   bash scripts/create-download-website.sh
#   # or
#   npm run website:setup

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/website"

if [[ ! -f "$WEB/package.json" ]]; then
  echo "Error: $WEB/package.json not found. Is this the SpaceX Mac Cleaner repo?"
  exit 1
fi

echo "→ Installing website dependencies in $WEB ..."
cd "$WEB"
npm install

echo ""
echo "Done."
echo ""
echo "  Preview:     cd website && npm run dev"
echo "  Production:  cd website && npm run build && npm run start"
echo ""
echo "  Set your app download URL (.zip / .dmg / etc., pick one):"
echo "    • website/.env.local — DOWNLOAD_URL or NEXT_PUBLIC_DOWNLOAD_URL"
echo "    • website/public/download-url.txt — first line = HTTPS URL (see download-url.example)"
echo "  Restart npm run dev after changing .env.local."
