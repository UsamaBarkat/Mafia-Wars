// Pure night-resolution logic for Slice 2b. No Firebase, no React, no UI.
// Runs on the moderator's device (the "resolver" — spec-2b D5): it reads the
// secret night actions plus the true roles (moderator-read of privateRoles, D3)
// and computes the PUBLIC outcome (who died) alongside each Detective's PRIVATE
// finding. Source of truth: spec-2b FR-7 (majority kill + Doctor cancel),
// FR-8 (Detective learns Mafia/not-Mafia), D6 (crypto-secure tie-break).

import { secureShuffle } from "../shuffle";
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
  const killVotes: Record<string, number> = {}; // targetUid -> Mafia picks
  const protectedUids = new Set<string>();
  const detectiveResults: Record<string, NightResult> = {};

  for (const [uid, action] of Object.entries(actions)) {
    const role = roles[uid];
    if (role === MAFIA && action.action === "kill") {
      killVotes[action.targetUid] = (killVotes[action.targetUid] ?? 0) + 1;
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

  const killTarget = pickKillTarget(killVotes);
  // A Doctor protecting the kill target cancels the death (FR-7).
  const eliminatedUid =
    killTarget !== null && !protectedUids.has(killTarget) ? killTarget : null;

  return { eliminatedUid, detectiveResults };
}

/**
 * The player with the most Mafia picks. A tie between targets is broken with a
 * cryptographically secure shuffle (D6) — never Math.random. Returns null when
 * no Mafia targeted anyone.
 */
function pickKillTarget(killVotes: Record<string, number>): string | null {
  const targets = Object.keys(killVotes);
  if (targets.length === 0) return null;
  const max = Math.max(...targets.map((t) => killVotes[t]));
  const leaders = targets.filter((t) => killVotes[t] === max);
  // One clear leader wins outright; otherwise pick uniformly at random.
  return leaders.length === 1 ? leaders[0] : secureShuffle(leaders)[0];
}
