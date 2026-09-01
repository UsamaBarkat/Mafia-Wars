"use client";

// On load, restore the room the user was in (D3 / FR-17). If sessionStorage holds a room
// code and the room still exists and this uid is still a member, re-enter the Waiting Room
// (which routes lobby → waiting room, in_game → reveal / moderator view, and re-arms
// presence for players). Otherwise clear the stale hint and stay Home. Renders nothing.

import { useEffect, useRef } from "react";
import { get, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "@/lib/room/paths";
import { loadRoomSession, clearRoomSession } from "@/lib/room/session";
import { isRoomDead } from "@/lib/room/lifecycle";
import { useAuthUid } from "@/lib/useAuthUid";
import { useGame } from "@/components/GameProvider";
import type { RoomMeta } from "@/lib/room/types";

export function ReconnectOnLoad() {
  const { state, actions } = useGame();
  const { uid, ready } = useAuthUid();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (!ready || !uid) return; // wait for anonymous auth to resolve
    if (state.screen !== "home") return; // only restore from a fresh Home load
    attempted.current = true;

    const session = loadRoomSession();
    if (!session) return;

    (async () => {
      try {
        const metaSnap = await get(ref(db, roomPaths.meta(session.code)));
        if (!metaSnap.exists()) {
          clearRoomSession(); // room gone → go Home cleanly
          return;
        }
        const meta = metaSnap.val() as RoomMeta;
        if (isRoomDead(meta)) {
          clearRoomSession(); // ended or abandoned/expired → go Home cleanly
          return;
        }

        // Moderator recognised by meta.moderatorId (no auto-transfer, D3).
        if (meta.moderatorId === uid) {
          actions.enterWaitingRoom({
            code: session.code,
            isModerator: true,
            name: session.name,
          });
          return;
        }

        // Player: must still have a roster entry to rejoin.
        const playerSnap = await get(ref(db, roomPaths.player(session.code, uid)));
        if (!playerSnap.exists()) {
          clearRoomSession(); // no longer a member → go Home cleanly
          return;
        }
        actions.enterWaitingRoom({
          code: session.code,
          isModerator: false,
          name: session.name,
        });
      } catch (e) {
        console.error("reconnect failed:", e);
        clearRoomSession();
      }
    })();
  }, [ready, uid, state.screen, actions]);

  return null;
}
