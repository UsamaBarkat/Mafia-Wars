"use client";

// Online per-device reveal (FR-13). After the deal (status "in_game"), each PLAYER sees
// ONLY their own role via useMyRole (reads only privateRoles/<uid>, never the parent —
// task-7 rules). Hidden-by-default tap-to-reveal, bare role name, with hide/re-reveal —
// the Phase 1 reveal feel, but per-device (no passing the phone). Revealing stamps the
// player's "viewed" flag (D6). The moderator has no role and sees the post-start view.

import { useState } from "react";
import { useGame } from "@/components/GameProvider";
import { useAuthUid } from "@/lib/useAuthUid";
import { useMyRole } from "@/lib/room/subscriptions";
import { markViewed } from "@/lib/room/markViewed";
import { BackArrow } from "@/components/ui/BackArrow";
import { ModeratorStarted } from "@/components/online/ModeratorStarted";

export function OnlineRevealScreen() {
  const { state, actions } = useGame();
  const { uid } = useAuthUid();
  // Moderator gets no role — keep the subscription inactive for them (null uid).
  const myRole = useMyRole(state.roomCode, state.isModerator ? null : uid);
  const [shown, setShown] = useState(false);

  // Moderator sees the per-player "viewed" status (no roles), not a reveal (FR-15 / D6).
  if (state.isModerator) {
    return <ModeratorStarted />;
  }

  const role = myRole.data?.role ?? null;

  const reveal = () => {
    setShown(true);
    // Record that this player has seen their role (D6) — their own entry only.
    if (state.roomCode && uid) {
      markViewed(state.roomCode, uid).catch((e) =>
        console.error("markViewed failed:", e),
      );
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] flex-col bg-neutral-950 text-white">
      <BackArrow onBack={actions.goHome} label="Back to Home" />

      {myRole.loading ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-lg text-neutral-400">Dealing your role…</p>
        </div>
      ) : role === null ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-lg text-neutral-400">Waiting for your role…</p>
        </div>
      ) : !shown ? (
        // Hidden — whole area is the tap target (FR-13).
        <button
          type="button"
          onClick={reveal}
          className="flex flex-1 flex-col items-center justify-center px-6 text-center"
        >
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
            <p className="text-2xl font-semibold text-red-500">
              Tap to see your role
            </p>
            <p className="text-sm text-neutral-500">Only you can see this.</p>
          </div>
        </button>
      ) : (
        // Revealed — only the bare role name; Hide re-hides it.
        <>
          <div className="flex flex-1 items-center justify-center px-6 pb-28 text-center">
            <span className="max-w-full break-words text-5xl font-extrabold tracking-tight sm:text-6xl">
              {role}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShown(false)}
            className="absolute bottom-6 right-6 rounded-xl bg-red-700 px-8 py-4 text-lg font-bold uppercase tracking-wide text-white hover:bg-red-800 active:bg-red-900"
          >
            Hide
          </button>
        </>
      )}
    </main>
  );
}
