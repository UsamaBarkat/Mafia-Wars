// Display-only icon + one-line description per built-in role name. No React, no UI.
// Shared by Phase 1's RevealScreen (standard four only — unchanged) and the online reveal
// (standard four plus the 2d roles, spec-2d FR-27). Custom roles can't reuse a built-in
// name (duplicate/reserved-name checks), so anything not listed gets the custom default.

export type RoleInfo = { icon: string; description: string };

/** The four standard roles (Phase 1 + online). */
export const ROLE_INFO: Record<string, RoleInfo> = {
  Mafia: {
    icon: "🔫",
    description:
      "You are part of the Mafia. Work secretly with other Mafia members to eliminate citizens.",
  },
  Detective: {
    icon: "🔍",
    description: "You can investigate one player each night to discover their true identity.",
  },
  Doctor: {
    icon: "💊",
    description: "You can protect one player each night from being eliminated.",
  },
  Civilian: {
    icon: "👤",
    description: "You are a citizen. Use your voice and vote during the day to find the Mafia.",
  },
};

/** [2d] Online-only roles (spec-2d FR-27). */
const ONLINE_ROLE_INFO: Record<string, RoleInfo> = {
  ...ROLE_INFO,
  Jester: { icon: "🃏", description: "Get voted out to win." },
  Cupid: { icon: "💘", description: "Pick two lovers on the first night." },
  Granny: { icon: "👵", description: "If the Mafia target you, one of them dies instead." },
};

export const CUSTOM_ROLE_INFO: RoleInfo = {
  icon: "🎭",
  description: "A custom role — ask your host what it does.",
};

/** Icon + description for a role dealt in an ONLINE game. */
export function onlineRoleInfo(role: string): RoleInfo {
  return ONLINE_ROLE_INFO[role] ?? CUSTOM_ROLE_INFO;
}
