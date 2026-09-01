// Data-layer: move a room from lobby into the deal. No React, no UI.
// Source of truth: spec-2a FR-11/FR-12, task-3 RoomStatus. This ONLY flips the status
// (moderator-only per task-7 rules); the actual secure role deal is task 13.

import { ref, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";

/** Transition the room to "dealing" (leaves the lobby; blocks further joins). */
export async function startGame(code: string): Promise<void> {
  await update(ref(db, roomPaths.meta(code)), { status: "dealing" });
}
