// Pure lover-link logic for Slice 2d. No Firebase, no React, no UI.
// Source of truth: spec-2d FR-7..FR-15 (Cupid links two lovers on Night 1; if either
// lover dies in any way, the other dies in the same moment).
//
// The resolver never reads the private `lovers` node (the moderator has no read on it —
// spec-2d D6). Pairs come from Cupid's own round-1 "link" night action instead, which the
// moderator's device already reads to resolve the night (spec-2b D3).

import type { NightAction } from "../room/types";

// Role NAME exactly as stored in privateRoles (must match lib/roles.ts).
const CUPID = "Cupid";

/** Two players linked by one Cupid. */
export type LoverPair = readonly [string, string];

/**
 * Every lover pair from round 1's night actions.
 *
 * Authority is `roles`, not the self-reported `action.role` (same rule as resolveNight):
 * only a real Cupid's "link" counts, and only if it names two different dealt players,
 * neither of them that Cupid. A Cupid who picked nobody contributes no pair (FR-9).
 */
export function loverPairs(
  round1Actions: Record<string, NightAction>,
  roles: Record<string, string>,
): LoverPair[] {
  const pairs: LoverPair[] = [];
  for (const [uid, action] of Object.entries(round1Actions)) {
    if (roles[uid] !== CUPID || action.action !== "link") continue;
    const first = action.targetUid;
    const second = action.secondTargetUid;
    if (!second || first === second || first === uid || second === uid) continue;
    if (!(first in roles) || !(second in roles)) continue;
    pairs.push([first, second]);
  }
  return pairs;
}

/**
 * The full set of deaths once every lover link is followed (FR-12). With several Cupids
 * the links form a graph, so this walks it until nothing new is added — chains and loops
 * (A–B, B–C, C–A) all end up in the set exactly once.
 */
export function withLinkedDeaths(
  initialDeaths: Iterable<string>,
  pairs: readonly LoverPair[],
): Set<string> {
  const dead = new Set(initialDeaths);
  const queue = [...dead];
  while (queue.length > 0) {
    const uid = queue.shift() as string;
    for (const [a, b] of pairs) {
      const partner = a === uid ? b : b === uid ? a : null;
      if (partner !== null && !dead.has(partner)) {
        dead.add(partner);
        queue.push(partner);
      }
    }
  }
  return dead;
}
