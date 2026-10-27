"use client";

// Online per-device reveal (FR-13). After the deal (status "in_game"), each PLAYER sees
// ONLY their own role via useMyRole (reads only privateRoles/<uid>, never the parent —
// task-7 rules). Hidden-by-default tap-to-reveal, role name plus [2d] its icon + one-line
// description (spec-2d FR-27), with hide/re-reveal —
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
  useMyLovers,
  useMyNightResult,
  useMyRole,
  useNightOutcome,
  useRoomPlayers,
} from "@/lib/room/subscriptions";
import { markViewed } from "@/lib/room/markViewed";
import { onlineRoleInfo } from "@/lib/roleInfo";
import type { PlayerEntry } from "@/lib/room/types";
import { BackArrow } from "@/components/ui/BackArrow";
import { ModeratorStarted } from "@/components/online/ModeratorStarted";
import { NightScreen } from "@/components/screens/NightScreen";
import { DayScreen } from "@/components/screens/DayScreen";
import { GameOverScreen } from "@/components/screens/GameOverScreen";

/** "A", "A and B", "A, B and C" — the names of `uids`, sorted by name (never by the
 *  order the resolver found them in, which could hint at who the Mafia targeted). */
function namesOf(
  uids: string[],
  players: Record<string, PlayerEntry> | null,
): string {
  const names = uids.map((u) => players?.[u]?.name ?? "Someone").sort((a, b) => a.localeCompare(b));
  return names.length <= 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Everyone an outcome says died: [2d] `eliminatedUids`, falling back to the single
 *  `eliminatedUid` older resolvers wrote (spec-2d D11). */
function deadUidsOf(outcome: {
  eliminatedUid?: string | null;
  eliminatedUids?: Record<string, true>;
}): string[] {
  if (outcome.eliminatedUids) return Object.keys(outcome.eliminatedUids);
  return outcome.eliminatedUid ? [outcome.eliminatedUid] : [];
}

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
  // [2d] My own lover partner(s), if Cupid picked me — own entry only (spec-2d FR-10).
  const myLovers = useMyLovers(state.roomCode, state.isModerator ? null : uid);
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
  const info = role ? onlineRoleInfo(role) : null;
  const partnerUids = Object.keys(myLovers.data ?? {});

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
    // [2d] Several can die in one phase (spec-2d FR-24). Night: everyone, names sorted, no
    // cause. Day: the voted-out player, plus any lover who "also" died — never explained.
    const nightDead = nightOutcome.data ? deadUidsOf(nightOutcome.data) : [];
    const dayAlsoDead = dayOutcome.data
      ? deadUidsOf(dayOutcome.data).filter((u) => u !== dayOutcome.data?.eliminatedUid)
      : [];

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
                <p className="mt-1 text-2xl font-bold">
                  {info && <span aria-hidden="true">{info.icon} </span>}
                  {role ?? "…"}
                </p>
                {info && <p className="mt-1 text-sm text-neutral-400">{info.description}</p>}
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

          {/* [2d] Private lover line — only this player's own partner(s), never a role
              (spec-2d FR-10). Stays visible while spectating, too. */}
          {partnerUids.length > 0 && (
            <div className="rounded-2xl border border-pink-900 bg-pink-950/30 p-3 text-center text-sm text-pink-200">
              💘 Your partner is{" "}
              <span className="font-semibold text-white">{namesOf(partnerUids, players.data)}</span>.
              If one of you dies, so does the other.
            </div>
          )}

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
                  {dayAlsoDead.length > 0 && (
                    <p className="mt-1 text-sm text-neutral-300">
                      {namesOf(dayAlsoDead, players.data)} also{" "}
                      {dayAlsoDead.length === 1 ? "was" : "were"} eliminated
                    </p>
                  )}
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
                    {nightDead.length === 0
                      ? "No one died"
                      : `${namesOf(nightDead, players.data)} ${nightDead.length === 1 ? "was" : "were"} eliminated`}
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
        // Revealed — the role name plus its icon + one-line description card (spec-2d
        // FR-27, the Phase 1 reveal's card style); Hide re-hides it.
        <>
          <div className="flex flex-1 items-center justify-center px-6 pb-28 pt-20 text-center">
            <div className="mx-auto flex w-full max-w-md flex-col items-center">
              <span
                data-testid="revealed-role"
                className="max-w-full break-words text-5xl font-extrabold tracking-tight sm:text-6xl"
              >
                {role}
              </span>
              {info && (
                <div className="mt-8 flex w-full flex-col items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
                  <span className="text-5xl" aria-hidden="true">
                    {info.icon}
                  </span>
                  <p className="text-base leading-relaxed text-neutral-300">{info.description}</p>
                </div>
              )}
            </div>
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
