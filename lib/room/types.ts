// RTDB room data shape for Phase 2 Slice 2a. Pure types — no React, no Firebase calls.
// Source of truth: specs/spec-2a.md §1 + Security section, and specs/research-phase2.md.
// Reuses the Phase 1 Role model (lib/roles) so config matches the offline setup.

import type { Role } from "@/lib/roles";

/** Room lifecycle states (spec-2a §1). 2a uses lobby → (configuring) → dealing/in_game → ended. */
export const ROOM_STATUSES = [
  "lobby",
  "configuring",
  "dealing",
  "in_game",
  "ended",
] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

/** A 6-digit numeric room code, e.g. "482917". */
export type RoomCode = string;

/** Room-level metadata at /rooms/{code}/meta. */
export type RoomMeta = {
  status: RoomStatus;
  /** uid of the non-playing moderator (D9). A single id, shaped so transfer can be added later (D3). */
  moderatorId: string;
  /** ms epoch when the room was created. */
  createdAt: number;
  /** ms epoch, bumped on meaningful writes; drives the lazy inactivity TTL (D5). */
  lastActivity: number;
};

/** A joined player at /rooms/{code}/players/{uid}. Public-ish roster — never holds a role. */
export type PlayerEntry = {
  /** Display name; not unique within a room (D4). */
  name: string;
  joinedAt: number;
  /** Presence flag maintained via onDisconnect (FR-7 / FR-17). */
  connected: boolean;
  lastSeen: number;
  /** Whether this player has viewed their dealt role yet (FR-15 / D6). Absent until they look. */
  viewed?: boolean;
  /** [2b] Alive vs eliminated. Set true at game start; the moderator/resolver sets false on
   *  elimination (spec-2b FR-1/17). Absent before the game begins. */
  alive?: boolean;
};

/** Moderator-configured roles at /rooms/{code}/config. Roles keyed by role id (RTDB-friendly
 *  map, not an array), reusing the Phase 1 Role shape (name, count, cap, isStandard). */
export type RoomConfig = {
  roles: Record<string, Role>;
};

/** A player's secretly-dealt role at /rooms/{code}/privateRoles/{uid}. This is a SEPARATE
 *  subtree from `players` precisely so Security Rules (task 7) can scope each entry to its
 *  owner: a client reads only privateRoles/{theirUid}, never the whole node or anyone else's. */
export type PrivateRoleEntry = {
  /** The dealt role NAME, e.g. "Mafia" (matches Phase 1's bare-name reveal). */
  role: string;
  dealtAt?: number;
};

/** A chat message at /rooms/{code}/chat/{pushId} (lobby-only chat, D7). */
export type ChatMessage = {
  uid: string;
  name: string;
  text: string;
  /** Server timestamp (ms). */
  ts: number;
};

// ============================================================================
// 2b game engine — night/day rounds. Source: spec-2b.md, research-2b.md.
// The moderator's device is the resolver: players write secret inputs, the
// moderator reads them and writes public outcomes (D5). Roles stay secret
// until game end (D8) — no reveal node here; that's decided at 2b task 9.
// ============================================================================

/** Game phase at /rooms/{code}/game. Night-first (Edge Cases); "ended" on a win. */
export const GAME_PHASES = ["night", "day", "ended"] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

/** Winning team when the game ends (spec-2b FR-14/15, D9). */
export type WinnerTeam = "town" | "mafia";

/** The live game state at /rooms/{code}/game — moderator-written (D5/D10). */
export type Game = {
  phase: GamePhase;
  /** 1-based round counter; increments as night→day→night… advance. */
  round: number;
  /** Set only when phase === "ended". */
  winner?: WinnerTeam;
};

/** A Mafia player's private list of fellow Mafia at /rooms/{code}/mafiaTeam/{uid}.
 *  Readable only by that uid (Mafia know each other — spec-2b FR-2). */
export type MafiaTeamEntry = {
  /** uids of this player's fellow Mafia (excluding themselves). */
  mates: string[];
};

/** Which night power an action exercises (standard four roles only — D1). */
export const NIGHT_ACTION_KINDS = ["kill", "protect", "investigate"] as const;
export type NightActionKind = (typeof NIGHT_ACTION_KINDS)[number];

/** A role-holder's SECRET night choice at /rooms/{code}/rounds/{n}/nightActions/{uid}.
 *  Readable only by that uid and the moderator (spec-2b FR-4) — the privateRoles pattern. */
export type NightAction = {
  /** The actor's role name, e.g. "Mafia" / "Doctor" / "Detective". */
  role: string;
  action: NightActionKind;
  /** The chosen living player's uid. */
  targetUid: string;
  submittedAt: number;
};

/** A private per-actor night result at /rooms/{code}/rounds/{n}/nightResults/{uid}.
 *  Readable only by that uid (spec-2b FR-8) — e.g. the Detective's finding. */
export type NightResult = {
  action: NightActionKind;
  targetUid: string;
  /** For the Detective: whether the target is Mafia (team only, not the exact role). */
  result: "mafia" | "not-mafia";
};

/** The PUBLIC night outcome at /rooms/{code}/rounds/{n}/nightOutcome — moderator-written.
 *  Names WHO died, never a role (spec-2b FR-9, D8). */
export type NightOutcome = {
  /** uid of the eliminated player, or null if no one died (Doctor cancel / no kill). */
  eliminatedUid: string | null;
  resolvedAt: number;
};

/** Sentinel target for a "vote to eliminate no one" (D7). */
export const SKIP_VOTE = "skip";

/** A PUBLIC day vote at /rooms/{code}/rounds/{n}/votes/{uid} — visible to all, changeable
 *  until the day ends (spec-2b FR-10, D2). */
export type Vote = {
  /** A living player's uid, or SKIP_VOTE ("skip"). */
  targetUid: string;
  votedAt: number;
};

/** The PUBLIC day outcome at /rooms/{code}/rounds/{n}/dayOutcome — moderator-written.
 *  Names WHO was eliminated, or null on a tie / Skip win (spec-2b FR-12, D7/D8). */
export type DayOutcome = {
  eliminatedUid: string | null;
  resolvedAt: number;
};

/** One round's data at /rooms/{code}/rounds/{n}. Sub-nodes appear as the round plays out. */
export type RoundData = {
  nightActions?: Record<string, NightAction>;
  nightResults?: Record<string, NightResult>;
  nightOutcome?: NightOutcome;
  votes?: Record<string, Vote>;
  dayOutcome?: DayOutcome;
};

/** PUBLIC reveal of every dealt player's role at /rooms/{code}/publicRoles — uid -> role
 *  NAME. Moderator-written, and ONLY once `game.phase === 'ended'` (spec-2b FR-15, D8) —
 *  this is the ONLY point any role becomes visible to anyone but its own owner (and the
 *  moderator's resolver reads). Built from the same `privateRoles` the resolver already
 *  reads to check the win, so it covers every dealt player, eliminated or not. */
export type PublicRoles = Record<string, string>;

/** The full room as stored under /rooms/{code}. Sub-nodes are optional because they
 *  appear as the game progresses (config when configured, privateRoles after the deal, etc.). */
export type Room = {
  meta: RoomMeta;
  config?: RoomConfig;
  players?: Record<string, PlayerEntry>;
  privateRoles?: Record<string, PrivateRoleEntry>;
  chat?: Record<string, ChatMessage>;
  // --- 2b game engine ---
  game?: Game;
  /** Per-uid private fellow-Mafia lists. */
  mafiaTeam?: Record<string, MafiaTeamEntry>;
  /** Rounds keyed by round number (as a string, e.g. "1"). */
  rounds?: Record<string, RoundData>;
  /** Set only once the game has ended (FR-15). */
  publicRoles?: PublicRoles;
};
