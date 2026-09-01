// Data-layer: a player records that they've viewed their dealt role. No React, no UI.
// Source of truth: spec-2a FR-15 / D6 (moderator sees who has viewed). Writes only the
// player's OWN entry (players/<uid>/viewed), allowed by the task-7 rules (auth.uid === $uid).

import { ref, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";

export async function markViewed(code: string, uid: string): Promise<void> {
  await update(ref(db, roomPaths.player(code, uid)), { viewed: true });
}
