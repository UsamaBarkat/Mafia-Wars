// Pure night-resolution logic for Slice 2b. No Firebase, no React, no UI.
// Runs on the moderator's device (the "resolver" — spec-2b D5): it reads the
// secret night actions plus the true roles (moderator-read of privateRoles, D3)
// and computes the PUBLIC outcome (who died) alongside each Detective's PRIVATE
// finding. Source of truth: spec-2b FR-7 (unanimous kill + Doctor cancel),
// FR-8 (Detective learns Mafia/not-Mafia), D6 (revised post-2c: Mafia must
// unanimously agree on one target — disagreement means no death, not a random
// tie-break; see spec-2b.md's D6 note for why this changed after Mafia chat
// made real coordination possible).

import type { NightAction, NightResult } from "../room/types";

// Role NAMES exactly as stored in privateRoles (must match lib/roles.ts).
const MAFIA = "Mafia";
const DOCTOR = "Doctor";
const DETECTIVE = "Detective";

export type NightResolution = {
  /** uid of the player eliminated tonight, or null if no one died. PUBLIC (FR-9). */
  eliminatedUid: string | null;
  /** Private per-Detective findings, keyed by the Detective's own uid (FR-8). */
  detectiveResults: Record<string, NightResult>;
};

/**
 * Resolve one night.
 *
 * @param actions night choices keyed by actor uid (rounds/{n}/nightActions).
 * @param roles   the true role NAME of every player, keyed by uid (from privateRoles).
 *
 * Authority is `roles`, not the self-reported `action.role`: only a real Mafia's
 * "kill" counts, only a real Doctor's "protect" saves, and only a real Detective's
 * "investigate" yields a finding — so a misbehaving client can't act out of role.
 */
export function resolveNight(
  actions: Record<string, NightAction>,
  roles: Record<string, string>,
): NightResolution {
  const killTargets = new Set<string>(); // distinct targetUids picked by Mafia
  const protectedUids = new Set<string>();
  const detectiveResults: Record<string, NightResult> = {};

  for (const [uid, action] of Object.entries(actions)) {
    const role = roles[uid];
    if (role === MAFIA && action.action === "kill") {
      killTargets.add(action.targetUid);
    } else if (role === DOCTOR && action.action === "protect") {
      protectedUids.add(action.targetUid);
    } else if (role === DETECTIVE && action.action === "investigate") {
      detectiveResults[uid] = {
        action: "investigate",
        targetUid: action.targetUid,
        // Team only, not the exact role (FR-8): unknown target ⇒ not Mafia.
        result: roles[action.targetUid] === MAFIA ? "mafia" : "not-mafia",
      };
    }
  }

  // The kill succeeds only if every Mafia who submitted named the SAME target (D6,
  // revised after real playtesting once Mafia chat made coordination possible). A
  // solo Mafia, or a team where only one submitted, trivially has one distinct
  // target — that still counts as agreement (FR-5: not acting isn't disagreeing).
  // Two or more distinct targets means they didn't converge, so the kill fails —
  // same as a Doctor-saved kill, not a random pick between them.
  const killTarget = killTargets.size === 1 ? [...killTargets][0] : null;
  const eliminatedUid =
    killTarget !== null && !protectedUids.has(killTarget) ? killTarget : null;

  return { eliminatedUid, detectiveResults };
}
