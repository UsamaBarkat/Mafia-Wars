// Pure day-vote tally for Slice 2b. No Firebase, no React, no UI.
// Public votes decide who is eliminated; because votes are public any client can
// recompute this, so the day is auditable (spec-2b D2). Source of truth: FR-12,
// D7 — a tie, or "Skip" winning/tying the top spot, eliminates no one.
//
// [2d] The voted-out player's lovers die with them (spec-2d FR-12), and the result
// says whether the voted-out player was the Jester (FR-2) — checkWin turns that into
// the overriding Jester win.

import { SKIP_VOTE } from "../room/types";
import { withLinkedDeaths, type LoverPair } from "./lovers";
import type { Vote } from "../room/types";

// Role NAME exactly as stored in privateRoles (must match lib/roles.ts).
const JESTER = "Jester";

export type DayResolution = {
  /** uid of the player the VOTE eliminated, or null on a tie / Skip win (FR-12, D7). */
  eliminatedUid: string | null;
  /** [2d] Everyone who died today — the voted-out player plus linked lovers, sorted by uid. */
  eliminatedUids: string[];
  /** [2d] True only when the vote itself eliminated a Jester (spec-2d FR-2). */
  jesterVotedOut: boolean;
};

/**
 * Tally the day's public votes.
 *
 * @param votes votes keyed by voter uid (rounds/{n}/votes). Each targets a living
 *   player's uid or SKIP_VOTE ("skip").
 * @param roles [2d] true role NAME per uid — only used to spot a voted-out Jester.
 * @param pairs [2d] lover pairs (from round 1's Cupid links — see lovers.ts).
 *
 * The eliminated player is the single target with the most votes. If the top is
 * tied (two or more targets share the max) or "Skip" sits at the top (alone or
 * tied), no one is eliminated.
 */
export function resolveDay(
  votes: Record<string, Vote>,
  roles: Record<string, string> = {},
  pairs: readonly LoverPair[] = [],
): DayResolution {
  const tally: Record<string, number> = {}; // targetUid (or "skip") -> count
  for (const vote of Object.values(votes)) {
    tally[vote.targetUid] = (tally[vote.targetUid] ?? 0) + 1;
  }

  const targets = Object.keys(tally);
  if (targets.length === 0) {
    return { eliminatedUid: null, eliminatedUids: [], jesterVotedOut: false };
  }

  const max = Math.max(...targets.map((t) => tally[t]));
  const leaders = targets.filter((t) => tally[t] === max);

  // Eliminate only a single, non-Skip leader; a tie or a Skip at the top spares everyone.
  const eliminatedUid =
    leaders.length === 1 && leaders[0] !== SKIP_VOTE ? leaders[0] : null;

  const eliminatedUids = eliminatedUid
    ? [...withLinkedDeaths([eliminatedUid], pairs)].sort()
    : [];
  const jesterVotedOut = eliminatedUid !== null && roles[eliminatedUid] === JESTER;

  return { eliminatedUid, eliminatedUids, jesterVotedOut };
}
