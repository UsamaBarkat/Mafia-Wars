"use client";

// Online per-device reveal (FR-13). After the deal (status "in_game"), each PLAYER sees
// ONLY their own role via useMyRole (reads only privateRoles/<uid>, never the parent —
// task-7 rules). Hidden-by-default tap-to-reveal, bare role name, with hide/re-reveal —
// the Phase 1 reveal feel, but per-device (no passing the phone). Revealing stamps the
// player's "viewed" flag (D6). The moderator has no role and sees the post-start view.
//
// Once the moderator begins Night 1 (spec-2b FR-1), `game` appears: the big mandatory
// reveal (FR-13) steps aside for a compact "View my role" toggle (still FR-2 — re-view at
// any time) plus the phase's screen — NightScreen during the night (task 5); day/game-over
// are later tasks.

import { useState } from "react";
import { useGame } from "@/components/GameProvider";
import { useAuthUid } from "@/lib/useAuthUid";
import {
  useDayOutcome,
  useGameState,
  useMyNightResult,
  useMyRole,
  useNightOutcome,
  useRoomPlayers,
} from "@/lib/room/subscriptions";
import { markViewed } from "@/lib/room/markViewed";
import { BackArrow } from "@/components/ui/BackArrow";
import { ModeratorStarted } from "@/components/online/ModeratorStarted";
import { NightScreen } from "@/components/screens/NightScreen";
import { DayScreen } from "@/components/screens/DayScreen";
import { GameOverScreen } from "@/components/screens/GameOverScreen";

export function OnlineRevealScreen() {
  const { state, actions } = useGame();
  const { uid } = useAuthUid();
  // Moderator gets no role — keep the subscription inactive for them (null uid).
  const myRole = useMyRole(state.roomCode, state.isModerator ? null : uid);
  const game = useGameState(state.roomCode);
  const players = useRoomPlayers(state.roomCode);
  const round = game.data?.round ?? null;
  const nightOutcome = useNightOutcome(state.roomCode, round);
  const myNightResult = useMyNightResult(state.roomCode, round, uid);
  // Night N+1 opens right after Day N resolves — show Day N's outcome (previous round)
  // during the new night so players learn who the day eliminated (FR-12 visibility),
  // mirroring how the night outcome carries into the following day.
  const previousRound = round !== null && round > 1 ? round - 1 : null;
  const dayOutcome = useDayOutcome(state.roomCode, previousRound);
  const [shown, setShown] = useState(false);

  // Moderator sees the per-player "viewed" status (no roles), not a reveal (FR-15 / D6).
  if (state.isModerator) {
    return <ModeratorStarted />;
  }

  // Game over — the same reveal-everything screen for every player (FR-15). Bypasses the
  // role-toggle wrapper entirely since roles are now public anyway.
  if (game.data?.phase === "ended") {
    return <GameOverScreen />;
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

  // Once Night 1 has begun, the game screen takes over — a compact role toggle up top
  // (FR-2: re-view at any time) plus the phase-specific screen below it.
  if (game.data) {
    return (
      <main className="relative flex min-h-[100dvh] flex-col bg-neutral-950 px-6 py-16 text-white">
        <BackArrow onBack={actions.goHome} label="Back to Home" />

        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <p className="text-center text-xs uppercase tracking-widest text-emerald-500">
            {game.data.phase === "night" ? "Night" : "Day"} {game.data.round}
          </p>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center">
            {shown ? (
              <>
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Your role
                </p>
                <p className="mt-1 text-2xl font-bold">{role ?? "…"}</p>
                <button
                  type="button"
                  onClick={() => setShown(false)}
                  className="mt-2 text-xs font-semibold uppercase tracking-wide text-red-500 hover:text-red-400"
                >
                  Hide
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShown(true)}
                className="text-xs font-semibold uppercase tracking-wide text-red-500 hover:text-red-400"
              >
                View my role
              </button>
            )}
          </div>

          {game.data.phase === "night" ? (
            <div className="flex flex-col gap-3">
              {dayOutcome.data && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">
                    Day {previousRound} outcome
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {dayOutcome.data.eliminatedUid
                      ? `${players.data?.[dayOutcome.data.eliminatedUid]?.name ?? "Someone"} was eliminated`
                      : "No one was eliminated"}
                  </p>
                </div>
              )}
              <NightScreen />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {nightOutcome.data && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">
                    Night {round} outcome
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {nightOutcome.data.eliminatedUid
                      ? `${players.data?.[nightOutcome.data.eliminatedUid]?.name ?? "Someone"} was eliminated`
                      : "No one died"}
                  </p>
                </div>
              )}

              {myNightResult.data && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">
                    Your investigation
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {players.data?.[myNightResult.data.targetUid]?.name ?? "They"} —{" "}
                    {myNightResult.data.result === "mafia" ? "Mafia" : "not Mafia"}
                  </p>
                </div>
              )}

              <DayScreen />
            </div>
          )}
        </div>
      </main>
    );
  }

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
