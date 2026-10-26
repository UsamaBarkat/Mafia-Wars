// Shared helpers for the Slice 2d verification scripts. EMULATOR ONLY — every URL below
// is 127.0.0.1 and the project id is the "demo-" one (emulator-only by Firebase design),
// so these scripts can never touch the production project.
//
// Start the emulators first:  npx firebase-tools emulators:start --only auth,database --project demo-mafia-wars
//
// `signedInClient()` gives a real anonymous-auth identity with its own Firebase app, so
// every read/write goes through the Security Rules exactly as a browser tab would.
// `adminPut()` seeds data through the emulator's REST API as "owner", which bypasses the
// rules — used only to set up a room's starting state, never to test a rule.

import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase, type Database } from "firebase/database";

export const PROJECT_ID = "demo-mafia-wars";
export const DB_NAMESPACE = `${PROJECT_ID}-default-rtdb`;
const DB_HOST = "http://127.0.0.1:9000";

export type Client = { uid: string; db: Database };

let clientCount = 0;

/** A fresh, signed-in anonymous identity with its own Firebase app instance. */
export async function signedInClient(): Promise<Client> {
  const app = initializeApp(
    { projectId: PROJECT_ID, apiKey: "demo-key", databaseURL: `${DB_HOST}?ns=${DB_NAMESPACE}` },
    `client-${++clientCount}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
  const cred = await signInAnonymously(auth);
  return { uid: cred.user.uid, db };
}

/** Write `value` at `path`, bypassing Security Rules (seeding only). */
export async function adminPut(path: string, value: unknown): Promise<void> {
  const res = await fetch(`${DB_HOST}/${path}.json?ns=${DB_NAMESPACE}`, {
    method: "PUT",
    headers: { Authorization: "Bearer owner" },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`adminPut ${path} failed: ${res.status} ${await res.text()}`);
}

/** Read `path`, bypassing Security Rules (assertions only). */
export async function adminGet(path: string): Promise<unknown> {
  const res = await fetch(`${DB_HOST}/${path}.json?ns=${DB_NAMESPACE}`, {
    headers: { Authorization: "Bearer owner" },
  });
  if (!res.ok) throw new Error(`adminGet ${path} failed: ${res.status}`);
  return res.json();
}

/** A random 6-digit room code so each scenario starts from a clean room. */
export function freshCode(): string {
  return String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
}

// --- tiny test runner ------------------------------------------------------------------

let passed = 0;
let failed = 0;

export async function check(name: string, fn: () => Promise<boolean> | boolean): Promise<void> {
  try {
    if (await fn()) {
      passed++;
      console.log(`  PASS  ${name}`);
    } else {
      failed++;
      console.log(`  FAIL  ${name}`);
    }
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name} — threw: ${(e as Error).message}`);
  }
}

/** True if the promise resolves (the rules allowed the operation). */
export async function allowed(op: Promise<unknown>): Promise<boolean> {
  try {
    await op;
    return true;
  } catch {
    return false;
  }
}

/** True if the promise rejects with PERMISSION_DENIED (the rules blocked it). */
export async function denied(op: Promise<unknown>): Promise<boolean> {
  try {
    await op;
    return false;
  } catch (e) {
    return /permission/i.test(String((e as Error).message));
  }
}

export function summary(): void {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
