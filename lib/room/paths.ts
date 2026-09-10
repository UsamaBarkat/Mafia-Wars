// RTDB path builders for rooms. Pure string helpers — no React, no Firebase calls.
// Read/write code (tasks 4–6) turns these into refs via ref(db, path); keeping them as
// strings here makes the data shape testable and Firebase-free. Single source of truth
// for where each piece of a room lives (mirrors lib/room/types.ts).

import type { RoomCode } from "./types";

/** Top-level collection of all rooms. */
export const ROOMS_ROOT = "rooms";

export const roomPaths = {
  /** /rooms/{code} — the whole room. */
  room: (code: RoomCode): string => `${ROOMS_ROOT}/${code}`,
  /** /rooms/{code}/meta — status, moderatorId, timestamps. */
  meta: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/meta`,
  /** /rooms/{code}/config — moderator-configured roles. */
  config: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/config`,
  /** /rooms/{code}/config/roles — the role map keyed by role id. */
  configRoles: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/config/roles`,
  /** /rooms/{code}/players — the public roster map keyed by uid. */
  players: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/players`,
  /** /rooms/{code}/players/{uid} — one player's roster entry (never holds a role). */
  player: (code: RoomCode, uid: string): string =>
    `${ROOMS_ROOT}/${code}/players/${uid}`,
  /** /rooms/{code}/privateRoles — the secret-role subtree. Clients must NOT read this whole
   *  node; rules (task 7) only permit reading your own child below. */
  privateRoles: (code: RoomCode): string =>
    `${ROOMS_ROOT}/${code}/privateRoles`,
  /** /rooms/{code}/privateRoles/{uid} — a single player's secret role; readable only by that uid. */
  privateRole: (code: RoomCode, uid: string): string =>
    `${ROOMS_ROOT}/${code}/privateRoles/${uid}`,
  /** /rooms/{code}/chat — lobby chat messages keyed by push id. */
  chat: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/chat`,

  // --- 2b game engine ---
  /** /rooms/{code}/game — phase / round / winner (moderator-written). */
  game: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/game`,
  /** /rooms/{code}/players/{uid}/alive — a player's alive flag (moderator-written). */
  playerAlive: (code: RoomCode, uid: string): string =>
    `${ROOMS_ROOT}/${code}/players/${uid}/alive`,
  /** /rooms/{code}/mafiaTeam — per-uid private fellow-Mafia lists. */
  mafiaTeam: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/mafiaTeam`,
  /** /rooms/{code}/mafiaTeam/{uid} — one Mafia's teammate list; readable only by that uid. */
  mafiaTeamEntry: (code: RoomCode, uid: string): string =>
    `${ROOMS_ROOT}/${code}/mafiaTeam/${uid}`,
  /** /rooms/{code}/rounds — all rounds keyed by round number. */
  rounds: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/rounds`,
  /** /rooms/{code}/rounds/{n} — one round's data. */
  round: (code: RoomCode, n: number): string =>
    `${ROOMS_ROOT}/${code}/rounds/${n}`,
  /** /rooms/{code}/rounds/{n}/nightActions — secret night choices keyed by actor uid. */
  nightActions: (code: RoomCode, n: number): string =>
    `${ROOMS_ROOT}/${code}/rounds/${n}/nightActions`,
  /** /rooms/{code}/rounds/{n}/nightActions/{uid} — one actor's secret choice (read own + moderator). */
  nightAction: (code: RoomCode, n: number, uid: string): string =>
    `${ROOMS_ROOT}/${code}/rounds/${n}/nightActions/${uid}`,
  /** /rooms/{code}/rounds/{n}/nightResults — private per-actor results (e.g. Detective). */
  nightResults: (code: RoomCode, n: number): string =>
    `${ROOMS_ROOT}/${code}/rounds/${n}/nightResults`,
  /** /rooms/{code}/rounds/{n}/nightResults/{uid} — one actor's private result; readable only by that uid. */
  nightResult: (code: RoomCode, n: number, uid: string): string =>
    `${ROOMS_ROOT}/${code}/rounds/${n}/nightResults/${uid}`,
  /** /rooms/{code}/rounds/{n}/nightOutcome — PUBLIC "who died" (moderator-written). */
  nightOutcome: (code: RoomCode, n: number): string =>
    `${ROOMS_ROOT}/${code}/rounds/${n}/nightOutcome`,
  /** /rooms/{code}/rounds/{n}/votes — PUBLIC day votes keyed by voter uid. */
  votes: (code: RoomCode, n: number): string =>
    `${ROOMS_ROOT}/${code}/rounds/${n}/votes`,
  /** /rooms/{code}/rounds/{n}/votes/{uid} — one player's public vote (write own, alive, day-phase). */
  vote: (code: RoomCode, n: number, uid: string): string =>
    `${ROOMS_ROOT}/${code}/rounds/${n}/votes/${uid}`,
  /** /rooms/{code}/rounds/{n}/dayOutcome — PUBLIC "who was eliminated" (moderator-written). */
  dayOutcome: (code: RoomCode, n: number): string =>
    `${ROOMS_ROOT}/${code}/rounds/${n}/dayOutcome`,
  /** /rooms/{code}/publicRoles — PUBLIC uid->role reveal, moderator-written ONLY once the
   *  game has ended (FR-15, D8). */
  publicRoles: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/publicRoles`,

  // --- 2c chat & replay ---
  /** /rooms/{code}/mafiaChat — night-only chat, keyed by push id. Readable/writable only
   *  by currently-alive Mafia (spec-2c FR-1..FR-5, D4: membership via privateRoles, not
   *  mafiaTeam — a solo Mafia has no mafiaTeam entry). Same message shape as `chat`. */
  mafiaChat: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/mafiaChat`,
  /** /rooms/{code}/dayChat — day-only chat, keyed by push id. Readable by every room member
   *  (living, eliminated, and the moderator); postable only by alive players (spec-2c
   *  FR-6..FR-10). Same message shape as `chat`. */
  dayChat: (code: RoomCode): string => `${ROOMS_ROOT}/${code}/dayChat`,
};

/** A valid room code is exactly 6 digits. */
export const ROOM_CODE_PATTERN = /^\d{6}$/;

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}
