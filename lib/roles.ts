// Pure role data + helpers. No React, no UI.
// Source of truth: specs/spec.md (FR-2, FR-3, FR-4, FR-6) and specs/plan.md.

/** One configurable role row. Counts are mutated by the game state, so always
 *  work with fresh copies from the factories below rather than shared objects. */
export type Role = {
  id: string;
  name: string;
  count: number;
  /** Max count this role may reach (FR-4). */
  cap: number;
  /** Standard roles can't be removed — only stepped to 0 (FR-6). */
  isStandard: boolean;
};

// Caps (FR-4) and custom-role rules (FR-6).
export const STANDARD_ROLE_CAP = 20; // Mafia, Detective, Doctor
export const CIVILIAN_CAP = 100;
export const CUSTOM_ROLE_CAP = 20;
export const CUSTOM_NAME_MAX = 24; // characters
export const CUSTOM_START_COUNT = 1;

/** Default counts for the four standard roles (FR-3). */
const STANDARD_DEFS: ReadonlyArray<{ id: string; name: string; count: number; cap: number }> = [
  { id: "mafia", name: "Mafia", count: 1, cap: STANDARD_ROLE_CAP },
  { id: "detective", name: "Detective", count: 1, cap: STANDARD_ROLE_CAP },
  { id: "doctor", name: "Doctor", count: 1, cap: STANDARD_ROLE_CAP },
  { id: "civilian", name: "Civilian", count: 7, cap: CIVILIAN_CAP },
];

/** Stable id for the Mafia role, used by validation (Mafia >= 1). */
export const MAFIA_ROLE_ID = "mafia";

/** [2d] Online-only built-in roles (spec-2d FR-26): start at 0 so existing setups are
 *  unchanged until the moderator opts in. Phase 1 offline never uses these. */
const ONLINE_EXTRA_DEFS: ReadonlyArray<{ id: string; name: string; count: number; cap: number }> = [
  { id: "jester", name: "Jester", count: 0, cap: STANDARD_ROLE_CAP },
  { id: "cupid", name: "Cupid", count: 0, cap: STANDARD_ROLE_CAP },
  { id: "granny", name: "Granny", count: 0, cap: STANDARD_ROLE_CAP },
];

/** Build a fresh list of the four standard roles at their default counts (FR-2, FR-3). */
export function createDefaultRoles(): Role[] {
  return STANDARD_DEFS.map((def) => ({ ...def, isStandard: true }));
}

/** [2d] The online room's built-in roles: the four standard ones plus Jester, Cupid and
 *  Granny — all non-removable (isStandard), so a custom role can never shadow them. */
export function createOnlineDefaultRoles(): Role[] {
  return [...STANDARD_DEFS, ...ONLINE_EXTRA_DEFS].map((def) => ({ ...def, isStandard: true }));
}

/** [2d] True if `name` matches any built-in role name (case-insensitive). The resolver
 *  identifies roles by NAME, so a custom "jester" would otherwise act as the real one. */
export function isBuiltInRoleName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return [...STANDARD_DEFS, ...ONLINE_EXTRA_DEFS].some((def) => def.name.toLowerCase() === lower);
}

/** Build a custom role from a (already validated) name: starts at count 1, cap 20 (FR-6). */
export function createCustomRole(name: string): Role {
  return {
    id: crypto.randomUUID(),
    name,
    count: CUSTOM_START_COUNT,
    cap: CUSTOM_ROLE_CAP,
    isStandard: false,
  };
}
