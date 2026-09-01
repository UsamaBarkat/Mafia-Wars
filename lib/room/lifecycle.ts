// Room liveness / expiry (D3 moderator-abandon, D5 stale-room TTL) — no Cloud Functions.
//
// A room stays "alive" only while its moderator's tab is open: the moderator heartbeats
// meta.lastActivity every ROOM_HEARTBEAT_MS (moderator-only write, per the task-7 rules).
// If the moderator leaves the tab / abandons, lastActivity stops advancing and the room is
// considered dead after ROOM_ABANDON_MS. This one signal covers both a moderator who
// vanishes mid-game AND long-stale rooms (their lastActivity is far in the past). Explicit
// moderator "leave" marks the room ended immediately. There is no auto-transfer (D3).

import { ref, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";
import type { RoomMeta } from "./types";

/** How often the moderator refreshes lastActivity while present. */
export const ROOM_HEARTBEAT_MS = 30_000;
/** No moderator heartbeat for this long ⇒ the room is treated as abandoned/expired. */
export const ROOM_ABANDON_MS = 120_000;

export type RoomDeadReason = "gone" | "ended" | "abandoned" | null;

/** Why a room is dead (null = alive). `meta` null ⇒ "gone" (removed/never existed). */
export function roomDeadReason(
  meta: RoomMeta | null,
  now: number = Date.now(),
): RoomDeadReason {
  if (meta === null) return "gone";
  if (meta.status === "ended") return "ended";
  if (
    typeof meta.lastActivity === "number" &&
    now - meta.lastActivity > ROOM_ABANDON_MS
  ) {
    return "abandoned";
  }
  return null;
}

export function isRoomDead(meta: RoomMeta | null, now: number = Date.now()): boolean {
  return roomDeadReason(meta, now) !== null;
}

/** A friendly message for a dead-room reason (for error/exit surfaces). */
export function deadRoomMessage(reason: RoomDeadReason): string {
  switch (reason) {
    case "ended":
      return "The moderator ended the game.";
    case "abandoned":
      return "The moderator left the game.";
    case "gone":
      return "This game no longer exists.";
    default:
      return "";
  }
}

/** Moderator heartbeat: keeps the room alive while their tab is open. Moderator-only. */
export async function touchRoom(code: string): Promise<void> {
  await update(ref(db, roomPaths.meta(code)), { lastActivity: Date.now() });
}

/** Moderator explicitly ends the room — everyone is sent Home. Moderator-only. */
export async function endRoom(code: string): Promise<void> {
  await update(ref(db, roomPaths.meta(code)), { status: "ended" });
}
