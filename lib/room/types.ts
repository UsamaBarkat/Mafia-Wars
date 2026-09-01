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

/** The full room as stored under /rooms/{code}. Sub-nodes are optional because they
 *  appear as the game progresses (config when configured, privateRoles after the deal, etc.). */
export type Room = {
  meta: RoomMeta;
  config?: RoomConfig;
  players?: Record<string, PlayerEntry>;
  privateRoles?: Record<string, PrivateRoleEntry>;
  chat?: Record<string, ChatMessage>;
};
