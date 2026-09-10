// Data-layer: reset a finished game back to the lobby so the same room can be replayed.
// No React, no UI. Source of truth: spec-2c FR-12..FR-16.
//
// One atomic multi-path update, mirroring dealRoles.ts's pattern: flips meta.status back
// to "lobby" and clears everything that belonged to the FINISHED game — game, mafiaTeam,
// every round's data, publicRoles, privateRoles, and all three chat channels — while
// leaving config/roles, every player's own roster fields (name/connected/joinedAt/
// lastSeen), and the moderator identity completely untouched. Per player, only `alive`
// and `viewed` are cleared (FR-12) — leaving `viewed` set would falsely satisfy the
// "everyone has seen their role" gate before anyone has looked at their NEW role.
//
// Clearing publicRoles is a SECRECY requirement (FR-15): it has no phase gate on read, so
// a stale reveal from the previous game would leak the new game's roles the moment
// they're dealt. Clearing rounds and mafiaTeam is a CORRECTNESS requirement (FR-16): a
// stale nightActions/{uid} could be silently recounted in the new game's round 1; a stale
// mafiaTeam/{uid} could show a player teammates from a team they're no longer on.
//
// Deleting a node (setting it to null in a multi-path update) only requires .write
// permission at that path — it does not re-trigger that node's own nested .validate
// rules the way writing a real value would (the same behavior already relied on when
// nightOutcome's eliminatedUid is omitted for "no one died", task 6). So one atomic call
// is enough — there's no need to sequence this into multiple writes.
//
// Wrapped in withTimeout (see ../withTimeout.ts), same fix as resolveNightOnClient.ts/
// resolveDayOnClient.ts: without it, a stalled connection would leave the moderator's
// "Play Again" confirm hanging forever with no error instead of failing clearly.

import { ref, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";
import { withTimeout } from "../withTimeout";

/**
 * Reset room `code` back to the lobby, clearing the finished game's data for every uid in
 * `playerUids`. Repeatable — safe to call again after a later game finishes (FR-13).
 */
export async function resetForPlayAgain(code: string, playerUids: string[]): Promise<void> {
  const updates: Record<string, unknown> = {
    [`${roomPaths.meta(code)}/status`]: "lobby",
    [roomPaths.game(code)]: null,
    [roomPaths.mafiaTeam(code)]: null,
    [roomPaths.rounds(code)]: null,
    [roomPaths.publicRoles(code)]: null,
    [roomPaths.privateRoles(code)]: null,
    [roomPaths.chat(code)]: null,
    [roomPaths.mafiaChat(code)]: null,
    [roomPaths.dayChat(code)]: null,
  };

  for (const uid of playerUids) {
    updates[roomPaths.playerAlive(code, uid)] = null;
    updates[`${roomPaths.player(code, uid)}/viewed`] = null;
  }

  await withTimeout(update(ref(db), updates), "resetForPlayAgain");
}
