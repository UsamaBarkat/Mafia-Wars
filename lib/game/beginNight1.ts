// Data-layer: the moderator starts the game from the post-deal/reveal state. No UI.
// Source of truth: spec-2b FR-1 (all players alive, enter Night 1), FR-2 (Mafia learn
// their fellow Mafia), Edge "night first".
//
// Named `beginNight1` (not `startGame`) to avoid clashing with the unrelated
// `lib/room/startGame.ts` from 2a (that one flips the room to "dealing" before the deal;
// this one begins the night/day game engine after the deal + reveal).
//
// Reads `privateRoles` once via a moderator-only `get()` (task 2's moderator `.read` on the
// privateRoles parent) to find who is Mafia — the same "trusted resolver" pattern as
// dealRoles.ts, just reading instead of computing the assignment. Everything else (every
// player's `alive`, each Mafia's `mafiaTeam`, and `game`) is written in one atomic
// multi-path update, mirroring dealRoles.ts's all-or-nothing deal + status flip.

import { get, ref, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "../room/paths";
import type { PrivateRoleEntry } from "../room/types";

// Role NAME exactly as dealt into privateRoles (must match lib/roles.ts's "Mafia" default).
const MAFIA = "Mafia";

/**
 * Begin Night 1: mark every player alive, tell each Mafia their fellow Mafia, and open the
 * game at round 1.
 *
 * @param code        the room code.
 * @param playerUids  every dealt player's uid (the roster from `players`, excluding the
 *                    non-playing moderator).
 */
export async function beginNight1(code: string, playerUids: string[]): Promise<void> {
  const rolesSnap = await get(ref(db, roomPaths.privateRoles(code)));
  const privateRoles = (rolesSnap.val() ?? {}) as Record<string, PrivateRoleEntry>;

  const mafiaUids = playerUids.filter((uid) => privateRoles[uid]?.role === MAFIA);

  const updates: Record<string, unknown> = {};
  for (const uid of playerUids) {
    updates[roomPaths.playerAlive(code, uid)] = true;
  }
  for (const uid of mafiaUids) {
    updates[roomPaths.mafiaTeamEntry(code, uid)] = {
      mates: mafiaUids.filter((mate) => mate !== uid),
    };
  }
  updates[roomPaths.game(code)] = { phase: "night", round: 1 };

  // One atomic multi-path write: alive flags + mafiaTeam lists + game, all together.
  await update(ref(db), updates);
}
