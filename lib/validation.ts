// Decide whether START is allowed, and why not. No React, no UI.
// Source of truth: specs/spec.md (Edge Cases / START gating) and specs/plan.md.

import type { Role } from "./roles";
import { MAFIA_ROLE_ID } from "./roles";

export type SetupEvaluation = {
  canStart: boolean;
  /** Short reason for the first unmet rule, or null when the setup is valid. */
  reason: string | null;
};

/**
 * START is allowed only when all of these hold (FR / Edge Cases):
 *   1. Total Players >= 3
 *   2. at least 1 Mafia
 *   3. at least one non-Mafia role with count >= 1 (custom roles count as non-Mafia)
 *
 * Mafia is identified by MAFIA_ROLE_ID, never by matching the name text, so a
 * custom role someone names "Mafia" is still treated as non-Mafia.
 *
 * `reason` reports the FIRST unmet rule in the order above; it is null when the
 * setup is valid.
 */
export function evaluateSetup(roles: readonly Role[]): SetupEvaluation {
  const totalPlayers = roles.reduce((sum, role) => sum + role.count, 0);
  const mafiaCount = roles
    .filter((role) => role.id === MAFIA_ROLE_ID)
    .reduce((sum, role) => sum + role.count, 0);
  const hasNonMafia = roles.some(
    (role) => role.id !== MAFIA_ROLE_ID && role.count >= 1,
  );

  if (totalPlayers < 3) {
    return { canStart: false, reason: "Need at least 3 players" };
  }
  if (mafiaCount < 1) {
    return { canStart: false, reason: "Need at least 1 Mafia" };
  }
  if (!hasNonMafia) {
    return { canStart: false, reason: "Need at least one non-Mafia role" };
  }
  return { canStart: true, reason: null };
}
