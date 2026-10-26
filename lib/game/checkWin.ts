// Pure win-condition check for Slice 2b. No Firebase, no React, no UI.
// Source of truth: spec-2b FR-14, D9 — Town wins when living Mafia = 0; Mafia
// win at parity (living Mafia >= living Town). Everyone who isn't Mafia counts as
// Town, including custom roles (D1).
//
// [2d] A Jester voted out by day wins outright, overriding everything (spec-2d FR-3/4).
// A living Jester counts as a non-Mafia player for parity (FR-5) — the existing
// "everyone who isn't Mafia" count already does exactly that.

import type { WinnerTeam } from "../room/types";

// Role NAME exactly as stored in privateRoles (must match lib/roles.ts).
const MAFIA = "Mafia";

/**
 * Decide the winner from the roles of the players who are still alive. Call it only
 * after EVERY death of the phase (lovers, Granny's Mafia) has been applied.
 *
 * @param aliveRoles     role NAMES of every currently-living player.
 * @param jesterVotedOut [2d] true if today's vote eliminated a Jester.
 * @returns "jester" | "town" | "mafia" | null (null ⇒ the game continues).
 */
export function checkWin(
  aliveRoles: readonly string[],
  jesterVotedOut = false,
): WinnerTeam | null {
  if (jesterVotedOut) return "jester"; // overrides every other result (spec-2d FR-4)

  const mafia = aliveRoles.filter((r) => r === MAFIA).length;
  const town = aliveRoles.length - mafia; // includes a living Jester (spec-2d FR-5)

  if (mafia === 0) return "town"; // all Mafia eliminated (FR-14)
  if (mafia >= town) return "mafia"; // parity reached (D9)
  return null; // game continues
}
