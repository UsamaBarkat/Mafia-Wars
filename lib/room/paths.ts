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
};

/** A valid room code is exactly 6 digits. */
export const ROOM_CODE_PATTERN = /^\d{6}$/;

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}
