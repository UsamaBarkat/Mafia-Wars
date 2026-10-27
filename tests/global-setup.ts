// Production guard for the e2e suite. Runs once before any test. If a dev server is
// already running, Playwright reuses it, and that server read .env.local, so .env.local
// must be in emulator mode under a "demo-" project, or we refuse to run.

import { readFileSync } from "node:fs";

function envValue(file: string, key: string): string | undefined {
  const line = file.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim();
}

export default function globalSetup(): void {
  let file = "";
  try {
    file = readFileSync(".env.local", "utf8");
  } catch {
    // No .env.local: the server Playwright starts gets the emulator env from the config.
  }

  const useEmulator =
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR ??
    envValue(file, "NEXT_PUBLIC_USE_FIREBASE_EMULATOR");
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    envValue(file, "NEXT_PUBLIC_FIREBASE_PROJECT_ID");

  if (file && (useEmulator !== "true" || !projectId?.startsWith("demo-"))) {
    throw new Error(
      "E2E refused: .env.local must have NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true and a " +
        `"demo-" NEXT_PUBLIC_FIREBASE_PROJECT_ID (got ${useEmulator} / ${projectId}). ` +
        "These tests only ever run against the local emulator.",
    );
  }
}
