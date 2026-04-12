import fs from "fs";
import path from "path";
import os from "os";
import type { SafeItem } from "./smartScan";
import { getDirSizeAsync } from "./utils";

const HOME = os.homedir();
const MAX_DEPTH = 18;
const MAX_RESULTS = 300;
const MIN_BYTES = 10 * 1024 * 1024; // 10 MB

function shouldSkipTree(dirPath: string): boolean {
  const norm = path.normalize(dirPath);
  const lib = path.join(HOME, "Library");
  const trash = path.join(HOME, ".Trash");
  const npmGlobal = path.join(HOME, ".npm");
  if (norm === lib || norm.startsWith(lib + path.sep)) return true;
  if (norm === trash || norm.startsWith(trash + path.sep)) return true;
  if (norm === npmGlobal || norm.startsWith(npmGlobal + path.sep)) return true;
  return false;
}

function labelForPath(nodeModulesPath: string): string {
  const parent = path.dirname(nodeModulesPath);
  const projectName = path.basename(parent);
  return `${projectName} — node_modules`;
}

function safeIdFromPath(p: string): string {
  return `nm-${Buffer.from(p).toString("base64url").slice(0, 48)}`;
}

/**
 * Walk $HOME (depth-limited), record each node_modules path but never descend into it.
 * Skips ~/Library, ~/.Trash, ~/.npm trees.
 */
function collectNodeModulesPaths(): string[] {
  const found: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > MAX_DEPTH || found.length >= MAX_RESULTS) return;
    if (shouldSkipTree(dir)) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = path.join(dir, e.name);
      if (e.name === "node_modules") {
        found.push(full);
        continue;
      }
      walk(full, depth + 1);
    }
  }

  walk(HOME, 0);
  return found;
}

export async function scanNodeModules(): Promise<SafeItem[]> {
  const paths = collectNodeModulesPaths();
  const results: SafeItem[] = [];

  for (const fullPath of paths) {
    try {
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }

    const size = await getDirSizeAsync(fullPath, 25000);
    if (size < MIN_BYTES) continue;

    results.push({
      id: safeIdFromPath(fullPath),
      label: labelForPath(fullPath),
      reason:
        "JavaScript dependencies — run npm install, yarn, or pnpm in the project folder to restore",
      path: fullPath,
      size,
      category: "nodemodules",
    });
  }

  return results.sort((a, b) => b.size - a.size);
}
