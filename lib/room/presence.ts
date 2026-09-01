// Data-layer: presence for a player in a room, using RTDB's onDisconnect. No React, no UI.
// Source of truth: spec-2a FR-7/FR-17, research-phase2 §1 (presence), D8 (disconnect ≠ delete).
//
// Marks the player connected while online and, via onDisconnect, flips them to
// connected:false (with lastSeen) automatically if the tab closes or the network drops —
// WITHOUT deleting their slot. The lobby grace that eventually frees a dropped slot is a
// higher-level concern (later tasks); here we only maintain the connected/lastSeen flags.

import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  update,
} from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";

/**
 * Start maintaining presence for player `uid` in room `code`. Call after joinRoom (the
 * player entry must exist). Returns a cleanup function that stops the listener.
 *
 * Uses the canonical `.info/connected` pattern: whenever the client (re)connects, we arm
 * the onDisconnect handler first, then mark ourselves online — so a disconnect at any
 * point leaves a correct connected:false flag.
 */
export function setupPresence(code: string, uid: string): () => void {
  const playerRef = ref(db, roomPaths.player(code, uid));
  const connectedRef = ref(db, ".info/connected");

  const unsubscribe = onValue(connectedRef, (snap) => {
    if (snap.val() !== true) return;

    // Arm the disconnect handler first (merges flags; never deletes the slot), then go online.
    onDisconnect(playerRef)
      .update({ connected: false, lastSeen: serverTimestamp() })
      .then(() => update(playerRef, { connected: true, lastSeen: serverTimestamp() }))
      .catch(() => {
        /* best-effort presence; ignore transient errors */
      });
  });

  return unsubscribe;
}
