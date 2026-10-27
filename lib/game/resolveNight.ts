// Pure night-resolution logic for Slice 2b. No Firebase, no React, no UI.
// Runs on the moderator's device (the "resolver" — spec-2b D5): it reads the
// secret night actions plus the true roles (moderator-read of privateRoles, D3)
// and computes the PUBLIC outcome (who died) alongside each Detective's PRIVATE
// finding. Source of truth: spec-2b FR-7 (unanimous kill + Doctor cancel),
// FR-8 (Detective learns Mafia/not-Mafia), D6 (revised post-2c: Mafia must
// unanimously agree on one target — disagreement means no death, not a random
// tie-break; see spec-2b.md's D6 note for why this changed after Mafia chat
// made real coordination possible).
//
// [2d] Granny turns the Mafia's kill back on them (spec-2d FR-17..FR-19): the first
// Mafia to pick her dies INSTEAD of her, unless the Doctor protected that Mafia. Every
// lover link is then followed. The result is the COMPLETE set of tonight's deaths, so the
// caller can write them all at once and only then check the win.

import { secureShuffle } from "../shuffle";
import { withLinkedDeaths, type LoverPair } from "./lovers";
import type { NightAction, NightResult } from "../room/types";

// Role NAMES exactly as stored in privateRoles (must match lib/roles.ts).
const MAFIA = "Mafia";
const DOCTOR = "Doctor";
const DETECTIVE = "Detective";
const GRANNY = "Granny";

export type NightResolution = {
  /** Everyone who died tonight, sorted by uid (never resolution order). PUBLIC (FR-9). */
  eliminatedUids: string[];
  /** Private per-Detective findings, keyed by the Detective's own uid (FR-8). */
  detectiveResults: Record<string, NightResult>;
};

/**
 * Resolve one night.
 *
 * @param actions  night choices keyed by actor uid (rounds/{n}/nightActions).
 * @param roles    the true role NAME of every player, keyed by uid (from privateRoles).
 * @param pairs    [2d] lover pairs (from round 1's Cupid links — see lovers.ts).
 * @param pickTie  [2d] picks one uid when two Mafia share the earliest final pick on Granny.
 *                 Defaults to a cryptographically secure pick (CLAUDE.md — never Math.random).
 *
 * Authority is `roles`, not the self-reported `action.role`: only a real Mafia's
 * "kill" counts, only a real Doctor's "protect" saves, and only a real Detective's
 * "investigate" yields a finding — so a misbehaving client can't act out of role.
 */
export function resolveNight(
  actions: Record<string, NightAction>,
  roles: Record<string, string>,
  pairs: readonly LoverPair[] = [],
  pickTie: (uids: string[]) => string = (uids) => secureShuffle(uids)[0],
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

  const deaths: string[] = [];
  if (killTarget !== null && roles[killTarget] === GRANNY) {
    // Granny (spec-2d FR-17..FR-19): the Mafia whose FINAL pick on her has the earliest
    // submittedAt (the "retaliation target") dies instead, and Granny survives — even if
    // the Doctor protected her. Only a Doctor protecting the retaliation target cancels
    // it; then the Mafia's kill on Granny goes through (unless she is protected too, by
    // a second Doctor — protection always cancels a Mafia kill on the protected player).
    const retaliationUid = grannyRetaliationTarget(actions, roles, killTarget, pickTie);
    if (!protectedUids.has(retaliationUid)) {
      deaths.push(retaliationUid);
    } else if (!protectedUids.has(killTarget)) {
      deaths.push(killTarget);
    }
  } else if (killTarget !== null && !protectedUids.has(killTarget)) {
    deaths.push(killTarget);
  }

  // Lovers (spec-2d FR-12): follow every link, so a partner dies in the same moment.
  const eliminatedUids = [...withLinkedDeaths(deaths, pairs)].sort();

  return { eliminatedUids, detectiveResults };
}

/**
 * The Mafia who dies when the agreed kill lands on Granny: among the real Mafia whose
 * night action is `kill` → Granny, the one with the earliest `submittedAt`. Every change
 * of pick re-saves the whole action with a new time, so each Mafia has exactly one
 * candidate time (their FINAL pick). An exact tie goes to `pickTie` (secure by default).
 * Only called when at least one Mafia picked Granny, so there is always a result.
 */
function grannyRetaliationTarget(
  actions: Record<string, NightAction>,
  roles: Record<string, string>,
  grannyUid: string,
  pickTie: (uids: string[]) => string,
): string {
  const pickers = Object.entries(actions).filter(
    ([uid, a]) => roles[uid] === MAFIA && a.action === "kill" && a.targetUid === grannyUid,
  );
  const earliest = Math.min(...pickers.map(([, a]) => a.submittedAt ?? Infinity));
  const tied = pickers.filter(([, a]) => (a.submittedAt ?? Infinity) === earliest).map(([uid]) => uid);
  return tied.length === 1 ? tied[0] : pickTie(tied);
}
