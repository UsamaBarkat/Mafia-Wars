// Data-layer: deal roles to the connected players when the moderator starts. No UI.
// Source of truth: spec-2a FR-12 + Security section, task-3 model, task-7 rules.
//
// TRUST ASSUMPTION (Spark plan — no Cloud Functions): the deal is computed on the
// MODERATOR's client. That device therefore transiently holds the full mapping — this
// is "secret enough for friends" (the moderator is a trusted non-player). The security
// guarantee we DO enforce is that no PLAYER can read another player's role: each role is
// written to privateRoles/<uid>, readable only by that uid per the task-7 rules. If we
// ever move to Blaze, this same function becomes a Cloud Function so no client sees the
// full mapping (see research-phase2 §3).

import { ref, serverTimestamp, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";
import { buildAssignment } from "@/lib/assignment";
import type { Role } from "@/lib/roles";

/**
 * Deal `roles` to `playerUids` and move the room to "in_game", all in one atomic update.
 *
 * Uses the Phase 1 `buildAssignment` (expand counts one-per-slot → cryptographically
 * secure shuffle, never Math.random), so counts are honoured exactly and each player gets
 * exactly one role. The moderator is not in `playerUids`, so gets no role (D9). Caller
 * passes the currently-connected players (the START gate guarantees their count equals the
 * total role count).
 */
export async function dealRoles(
  code: string,
  playerUids: string[],
  roles: Role[],
): Promise<void> {
  const assignment = buildAssignment(roles); // length === sum of role counts

  const updates: Record<string, unknown> = {};
  const count = Math.min(playerUids.length, assignment.length);
  for (let i = 0; i < count; i++) {
    updates[`${roomPaths.privateRoles(code)}/${playerUids[i]}`] = {
      role: assignment[i],
      dealtAt: serverTimestamp(),
    };
  }
  updates[`${roomPaths.meta(code)}/status`] = "in_game";

  // One atomic multi-path write: all private roles + the status flip together.
  await update(ref(db), updates);
}
