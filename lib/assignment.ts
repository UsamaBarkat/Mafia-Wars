// Turn configured role counts into a shuffled, one-role-per-slot assignment.
// No React, no UI. Source of truth: specs/spec.md (FR-7) and specs/plan.md.

import type { Role } from "./roles";
import { secureShuffle } from "./shuffle";

/**
 * Expand each role's count into that many entries, then shuffle.
 *
 * A role with count 3 contributes 3 entries, so counts are honoured exactly
 * (2 Mafia means exactly 2 "Mafia" entries). Standard and custom roles are
 * treated identically — every role with count > 0 is included. Roles at count 0
 * contribute nothing.
 *
 * Returns a NEW array of role names, one per anonymous player slot, in
 * cryptographically secure shuffled order (FR-7). Its length equals Total
 * Players (the sum of all counts). The input roles are not mutated.
 */
export function buildAssignment(roles: readonly Role[]): string[] {
  const slots: string[] = [];
  for (const role of roles) {
    for (let i = 0; i < role.count; i++) {
      slots.push(role.name);
    }
  }
  return secureShuffle(slots);
}
