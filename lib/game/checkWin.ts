// Pure win-condition check for Slice 2b. No Firebase, no React, no UI.
// Source of truth: spec-2b FR-14, D9 — Town wins when living Mafia = 0; Mafia
// win at parity (living Mafia >= living Town). Everyone who isn't Mafia counts as
// Town, including custom roles (D1).

import type { WinnerTeam } from "../room/types";

// Role NAME exactly as stored in privateRoles (must match lib/roles.ts).
const MAFIA = "Mafia";

/**
 * Decide the winner from the roles of the players who are still alive.
 *
 * @param aliveRoles role NAMES of every currently-living player.
 * @returns "town" | "mafia" | null (null ⇒ the game continues).
 */
export function checkWin(aliveRoles: readonly string[]): WinnerTeam | null {
  const mafia = aliveRoles.filter((r) => r === MAFIA).length;
  const town = aliveRoles.length - mafia;

  if (mafia === 0) return "town"; // all Mafia eliminated (FR-14)
  if (mafia >= town) return "mafia"; // parity reached (D9)
  return null; // game continues
}
