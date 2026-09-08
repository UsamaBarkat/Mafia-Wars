// Data-layer: an alive player casts (or changes) their public day vote. No UI.
// Source of truth: spec-2b FR-10 (public, live, changeable), D2 (public), D7 (Skip).
//
// Writes the WHOLE node — a resubmission overwrites the prior vote (the rules have no
// `!data.exists()` lock), matching how a player may change their vote until the day ends.
// `targetUid` is either a living player's uid or SKIP_VOTE ("skip").

import { ref, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "../room/paths";

export async function castVote(
  code: string,
  round: number,
  uid: string,
  targetUid: string,
): Promise<void> {
  await set(ref(db, roomPaths.vote(code, round, uid)), {
    targetUid,
    votedAt: Date.now(),
  });
}
