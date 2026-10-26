// Data-layer: a role-holder submits (or changes) their secret night choice. No UI.
// Source of truth: spec-2b FR-3 (Mafia kill / Doctor protect / Detective investigate),
// FR-4 (secret — task-2 rules deny reads to anyone but that uid and the moderator).
//
// Writes the WHOLE node (not a partial update): the rules permit re-writing
// nightActions/{uid} any time before the moderator ends the night (no `!data.exists()`
// lock), so a player can change their target — this always replaces any earlier choice
// for the round with one complete, valid NightAction.
//
// [2d] submittedAt is the SERVER's clock, not the device's (spec-2d D10): Granny's
// "first Mafia to pick her" rule compares times from different phones, and phone clocks
// drift by seconds. Cupid's one-time link goes through submitCupidLink instead.

import { ref, serverTimestamp, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "../room/paths";
import type { NightActionKind } from "../room/types";

export async function submitNightAction(
  code: string,
  round: number,
  uid: string,
  role: string,
  action: NightActionKind,
  targetUid: string,
): Promise<void> {
  await set(ref(db, roomPaths.nightAction(code, round, uid)), {
    role,
    action,
    targetUid,
    submittedAt: serverTimestamp(),
  });
}
