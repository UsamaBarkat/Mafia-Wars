"use client";

// Mounts the anonymous-identity hook at the top of the app so a silent anonymous
// sign-in fires on initial load (creating a stable uid). Renders nothing — identity
// only, no UI, no game logic.

import { useAuthUid } from "@/lib/useAuthUid";

export function AuthInit() {
  useAuthUid();
  return null;
}
