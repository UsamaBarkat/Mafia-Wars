// Single Firebase init module for the whole app. Import `auth` / `db` from here —
// never call initializeApp elsewhere (avoids duplicate-init in Next HMR/SSR).
//
// Config comes from NEXT_PUBLIC_FIREBASE_* env vars (see .env.local.example). The
// Firebase *web* config is public by design — security comes from Auth + Security
// Rules, not from hiding these values. Real secrets (service-account keys) are never
// used here and must never be committed.
//
// When NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true", we point Auth + Realtime DB at
// the local Emulator Suite instead of production (see firebase.json). Use a demo
// project id (e.g. "demo-mafia-wars") for fully-local dev with no real credentials.

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getDatabase,
  connectDatabaseEmulator,
  type Database,
} from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

// Reuse the existing app if one was already initialized (HMR / multiple imports).
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Database = getDatabase(app);

// Connect to the local Emulator Suite exactly once. A flag on globalThis survives
// Next.js hot reloads so we never call connect*Emulator twice on the same instance.
const emulatorFlag = "__mafiaWarsEmulatorsConnected__";
type GlobalWithFlag = typeof globalThis & { [emulatorFlag]?: boolean };

if (useEmulator && !(globalThis as GlobalWithFlag)[emulatorFlag]) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
  (globalThis as GlobalWithFlag)[emulatorFlag] = true;
}

export { app };
