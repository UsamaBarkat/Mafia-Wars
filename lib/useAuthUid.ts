"use client";

// Anonymous identity for online play. The first component to use this hook triggers
// a silent anonymous sign-in (no login/signup UI) and gets back a stable `uid`.
// Firebase persists the session locally, so the same browser keeps the same uid
// across refreshes. Identity only — no game logic here.
//
// Sign-in is lazy (happens when the hook is first used), so Phase 1's offline screens
// never touch the network; only the online screens pull in identity.

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";

export type AuthState = {
  /** The anonymous user id, or null until sign-in resolves. */
  uid: string | null;
  /** True once auth has resolved (signed in) or failed — i.e. no longer loading. */
  ready: boolean;
  /** Set if anonymous sign-in failed (e.g. Anonymous auth disabled / emulator down). */
  error: Error | null;
};

export function useAuthUid(): AuthState {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        setReady(true);
        return;
      }
      // No user yet — sign in anonymously. signInAnonymously is idempotent for
      // anonymous users (returns the existing one if already signed in), and the
      // resulting user arrives via this same listener.
      setUid(null);
      signInAnonymously(auth).catch((e: unknown) => {
        setError(e instanceof Error ? e : new Error(String(e)));
        setReady(true);
      });
    });

    return unsubscribe;
  }, []);

  return { uid, ready, error };
}
