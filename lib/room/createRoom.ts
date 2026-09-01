// Data-layer: create a new room in Realtime Database. No React, no UI.
// Source of truth: spec-2a FR-4, research-phase2 §1, and the task-3 data model.

import { ref, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";
import { generateRoomCode } from "./generateCode";
import type { RoomCode, RoomMeta } from "./types";

/** How many fresh codes to try before giving up (collisions are negligible at hobby scale). */
const MAX_ATTEMPTS = 5;

/**
 * Create a room with a unique 6-digit code and return the code. The creator's `uid`
 * becomes the room's (non-playing) moderator.
 *
 * Atomic create-if-not-exists: we run a transaction on the room's `meta` node that only
 * writes when the node is still empty. If two creators pick the same code at once, the
 * loser's transaction sees a non-null value, aborts, and we retry with a fresh code — so
 * two simultaneous creators can never share a code (FR-4).
 */
export async function createRoom(uid: string): Promise<RoomCode> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const now = Date.now();
    const meta: RoomMeta = {
      status: "lobby",
      moderatorId: uid,
      createdAt: now,
      lastActivity: now,
    };

    const metaRef = ref(db, roomPaths.meta(code));
    const result = await runTransaction(metaRef, (current) => {
      // current is null when the code is free; returning undefined aborts (code taken).
      if (current !== null) return;
      return meta;
    });

    if (result.committed) return code;
    // Not committed → the code was already claimed; loop and try a new one.
  }

  throw new Error("Could not generate a unique room code. Please try again.");
}
