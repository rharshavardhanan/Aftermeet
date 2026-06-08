#!/usr/bin/env node
// Packages the Chrome extension into a Web-Store-ready zip.
// Usage: npm run ext:build  →  dist/meeting-to-tasks-ext-<version>.zip
//
// Zips the *contents* of extension/ (not the parent folder), excludes dev-only
// files, and reads the version from manifest.json so the artifact is traceable.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, "manifest.json"), "utf8"));
const version = manifest.version ?? "0.0.0";

const outDir = join(here, "dist");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `meeting-to-tasks-ext-${version}.zip`);
rmSync(outFile, { force: true });

const exclude = [
  "dist/*",
  "build.mjs",
  "README.md",
  "*.DS_Store",
  "*.map",
];

try {
  execFileSync(
    "zip",
    ["-r", "-X", outFile, ".", "-x", ...exclude],
    { cwd: here, stdio: "inherit" },
  );
} catch (err) {
  console.error("\nPackaging failed. Ensure the `zip` CLI is installed.");
  console.error(err.message);
  process.exit(1);
}

console.log(`\n✓ Built ${outFile.replace(process.cwd() + "/", "")}`);
console.log("  Upload this at chrome.google.com/webstore/devconsole");
