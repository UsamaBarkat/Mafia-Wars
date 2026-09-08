// Pure day-vote tally for Slice 2b. No Firebase, no React, no UI.
// Public votes decide who is eliminated; because votes are public any client can
// recompute this, so the day is auditable (spec-2b D2). Source of truth: FR-12,
// D7 — a tie, or "Skip" winning/tying the top spot, eliminates no one.

import { SKIP_VOTE } from "../room/types";
import type { Vote } from "../room/types";

export type DayResolution = {
  /** uid of the eliminated player, or null on a tie / Skip win (FR-12, D7). */
  eliminatedUid: string | null;
};

/**
 * Tally the day's public votes.
 *
 * @param votes votes keyed by voter uid (rounds/{n}/votes). Each targets a living
 *   player's uid or SKIP_VOTE ("skip").
 *
 * The eliminated player is the single target with the most votes. If the top is
 * tied (two or more targets share the max) or "Skip" sits at the top (alone or
 * tied), no one is eliminated.
 */
export function resolveDay(votes: Record<string, Vote>): DayResolution {
  const tally: Record<string, number> = {}; // targetUid (or "skip") -> count
  for (const vote of Object.values(votes)) {
    tally[vote.targetUid] = (tally[vote.targetUid] ?? 0) + 1;
  }

  const targets = Object.keys(tally);
  if (targets.length === 0) return { eliminatedUid: null };

  const max = Math.max(...targets.map((t) => tally[t]));
  const leaders = targets.filter((t) => tally[t] === max);

  // Eliminate only a single, non-Skip leader; a tie or a Skip at the top spares everyone.
  const eliminatedUid =
    leaders.length === 1 && leaders[0] !== SKIP_VOTE ? leaders[0] : null;
  return { eliminatedUid };
}
