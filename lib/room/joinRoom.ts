// Data-layer: join a room as a player. No React, no UI.
// Source of truth: spec-2a FR-5, FR-7, Edge "bad joins"/"atomic joins"/"capacity", and D2/D4/D9.

import { get, ref, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";
import type { PlayerEntry, RoomMeta } from "./types";
import type { Role } from "@/lib/roles";
import { CUSTOM_NAME_MAX } from "@/lib/roles";
import { roomDeadReason, deadRoomMessage } from "./lifecycle";

export type JoinFailureReason =
  | "invalid-name"
  | "not-found"
  | "not-joinable"
  | "is-moderator"
  | "expired"
  | "full";

/** Thrown by joinRoom with a machine-readable `reason` the UI (task 10) can map to a message. */
export class JoinRoomError extends Error {
  reason: JoinFailureReason;
  constructor(reason: JoinFailureReason, message: string) {
    super(message);
    this.name = "JoinRoomError";
    this.reason = reason;
  }
}

/**
 * Join the room `code` as player `uid` with display `name`.
 *
 * Validates that the room exists and is in `lobby`; rejects if the joiner is the
 * moderator (non-playing, D9), or if the room is full. "Full" = joined players reach
 * Total Players Needed (sum of configured role counts); when no roles are configured yet
 * there is no cap. Capacity is enforced inside a transaction on the `players` map so two
 * players racing for the last slot can't both get in (FR-5, "atomic joins"). Re-joining
 * with the same uid is allowed and just refreshes that entry (reconnect).
 */
export async function joinRoom(
  code: string,
  uid: string,
  name: string,
): Promise<void> {
  const cleanName = name.trim().slice(0, CUSTOM_NAME_MAX);
  if (cleanName === "") {
    throw new JoinRoomError("invalid-name", "Please enter a name.");
  }

  const metaSnap = await get(ref(db, roomPaths.meta(code)));
  if (!metaSnap.exists()) {
    throw new JoinRoomError("not-found", "No game found with that code.");
  }
  const meta = metaSnap.val() as RoomMeta;
  const deadReason = roomDeadReason(meta);
  if (deadReason) {
    throw new JoinRoomError("expired", deadRoomMessage(deadReason));
  }
  if (meta.status !== "lobby") {
    throw new JoinRoomError("not-joinable", "This game can't be joined right now.");
  }
  if (uid === meta.moderatorId) {
    throw new JoinRoomError("is-moderator", "You're the moderator of this game.");
  }

  // Capacity = total configured role count (0 / unset = no cap yet).
  const rolesSnap = await get(ref(db, roomPaths.configRoles(code)));
  const needed = rolesSnap.exists()
    ? Object.values(rolesSnap.val() as Record<string, Role>).reduce(
        (sum, role) => sum + (role?.count ?? 0),
        0,
      )
    : 0;

  const now = Date.now();
  const playersRef = ref(db, roomPaths.players(code));
  const result = await runTransaction(
    playersRef,
    (current: Record<string, PlayerEntry> | null) => {
      const players = current ?? {};
      const existing = players[uid];
      const isRejoin = existing !== undefined;

      if (!isRejoin && needed > 0 && Object.keys(players).length >= needed) {
        return; // abort — room is full
      }

      const entry: PlayerEntry = {
        name: cleanName,
        joinedAt: existing?.joinedAt ?? now,
        connected: true,
        lastSeen: now,
      };
      if (existing?.viewed !== undefined) entry.viewed = existing.viewed;

      players[uid] = entry;
      return players;
    },
  );

  if (!result.committed) {
    throw new JoinRoomError("full", "This game is full.");
  }
}
