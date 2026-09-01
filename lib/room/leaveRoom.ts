// Data-layer: leave a room (explicit). No React, no UI.
// Source of truth: spec-2a FR-18 (a player leaving frees their slot).

import { onDisconnect, ref, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";

/**
 * Remove player `uid` from room `code`. Cancels any armed onDisconnect handler first so
 * the presence handler can't recreate a partial entry after the node is gone, then
 * deletes the player's roster entry. (A network drop is handled by presence, not this —
 * this is for an intentional leave.)
 */
export async function leaveRoom(code: string, uid: string): Promise<void> {
  const playerRef = ref(db, roomPaths.player(code, uid));
  await onDisconnect(playerRef).cancel();
  await remove(playerRef);
}
