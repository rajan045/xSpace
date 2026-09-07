import fs from "fs";
import path from "path";
import os from "os";
import type { SafeItem } from "./smartScan";
import { getDirSizesAsync, streamFind } from "./utils";

const HOME = os.homedir();
const MAX_DEPTH = 18;
const MAX_RESULTS = 300;
const MIN_BYTES = 10 * 1024 * 1024; // 10 MB

function labelForPath(nodeModulesPath: string): string {
  const parent = path.dirname(nodeModulesPath);
  const projectName = path.basename(parent);
  return `${projectName} — node_modules`;
}

function safeIdFromPath(p: string): string {
  return `nm-${Buffer.from(p).toString("base64url").slice(0, 48)}`;
}

/**
 * Locate every node_modules under $HOME.
 *
 * This used to be a synchronous recursive readdirSync from the Electron main
 * process — it blocked the whole app (IPC included) for the length of the walk.
 * `find` does the same walk in its own process, and -prune means it never
 * descends INTO a node_modules or the skipped trees.
 */
async function collectNodeModulesPaths(): Promise<string[]> {
  // -prune on the match itself is what keeps this cheap: a matched node_modules
  // is printed and never descended into, so nested copies cost nothing.
  // Pruning every dot-directory is what makes this usable: ~/.cursor, ~/.vscode,
  // ~/.config and friends hold thousands of bundled node_modules that are not the
  // user's projects, and they used to fill the result cap before a single real
  // project was reached (300 hits found, 0 worth showing).
  const args = [
    HOME,
    "-maxdepth", String(MAX_DEPTH),
    "(",
      "-path", `${HOME}/Library`,
      "-o", "-path", `${HOME}/.Trash`,
      "-o", "-name", ".*",
    ")", "-prune",
    "-o",
    "-type", "d", "-name", "node_modules", "-prune", "-print",
  ];
  return streamFind(args, 90000, MAX_RESULTS);
}

export async function scanNodeModules(): Promise<SafeItem[]> {
  const paths = (await collectNodeModulesPaths()).filter(p => {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });

  // One batched `du` instead of one spawn per project, sized in parallel.
  const sizes = await getDirSizesAsync(paths, 60000);

  const results: SafeItem[] = [];
  paths.forEach((fullPath, i) => {
    const size = sizes[i];
    if (size < MIN_BYTES) return;
    results.push({
      id: safeIdFromPath(fullPath),
      label: labelForPath(fullPath),
      reason:
        "JavaScript dependencies — run npm install, yarn, or pnpm in the project folder to restore",
      path: fullPath,
      size,
      category: "nodemodules",
    });
  });

  return results.sort((a, b) => b.size - a.size);
}
