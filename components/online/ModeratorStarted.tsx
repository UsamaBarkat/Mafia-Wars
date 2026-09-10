"use client";

// Moderator post-start view (FR-15 / D6). After the game starts, the moderator sees the
// live per-player "has viewed their role" status — and NEVER any role directly (the
// moderator's device CAN read privateRoles as of task 2/2b, to resolve the game, but the
// UI never displays them — FR-16). 2a ends when everyone has viewed; from there the
// moderator can Begin Night 1 (spec-2b FR-1).

import { useEffect, useState } from "react";
import { useGame } from "@/components/GameProvider";
import { useAuthUid } from "@/lib/useAuthUid";
import {
  useGameState,
  useNightActions,
  usePrivateRoles,
  useRoomPlayers,
  useRoomVotes,
} from "@/lib/room/subscriptions";
import { beginNight1 } from "@/lib/game/beginNight1";
import { resolveNightOnClient } from "@/lib/game/resolveNightOnClient";
import { resolveDayOnClient } from "@/lib/game/resolveDayOnClient";
import { roomPaths } from "@/lib/room/paths";
import { BackArrow } from "@/components/ui/BackArrow";
import { Chat } from "@/components/online/Chat";
import { GameOverScreen } from "@/components/screens/GameOverScreen";

// Role NAMES with a night power (must match lib/roles.ts's defaults / NightScreen.tsx) —
// Civilians and custom roles never submit a nightAction (D1), so they don't belong in the
// night "X of Y acted" denominator.
const NIGHT_ACTION_ROLES = new Set(["Mafia", "Doctor", "Detective"]);

export function ModeratorStarted() {
  const { state, actions } = useGame();
  const { uid } = useAuthUid();
  const code = state.roomCode;
  const players = useRoomPlayers(code);
  const game = useGameState(code);
  const nightActions = useNightActions(code, game.data?.round ?? null);
  const votes = useRoomVotes(code, game.data?.round ?? null);
  const privateRoles = usePrivateRoles(code);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endingDay, setEndingDay] = useState(false);

  // This component stays mounted for the whole game (it's returned unconditionally by
  // OnlineRevealScreen for the moderator, which itself renders continuously while the
  // room is in_game) — night and day recur every round, but `ending`/`endingDay` were
  // only ever reset to false in their catch branch, on the assumption success routes
  // away permanently (true for `starting`/Begin Night 1, reachable once per game; false
  // here). After a successful End Night/End Day, the stale flag would sit at true,
  // invisible until that phase's branch rendered again next round — then the button
  // opened already showing "Resolving…", disabled, with nothing actually in flight.
  // Reset each flag whenever we're no longer in the phase it belongs to (mirrors the
  // WaitingRoomScreen "Starting…" fix for Play Again).
  const phase = game.data?.phase ?? null;
  useEffect(() => {
    if (phase !== "night") setEnding(false);
  }, [phase]);
  useEffect(() => {
    if (phase !== "day") setEndingDay(false);
  }, [phase]);

  const playerList = Object.values(players.data ?? {}).sort(
    (a, b) => a.joinedAt - b.joinedAt,
  );
  const total = playerList.length;
  const viewedCount = playerList.filter((p) => p.viewed === true).length;
  const allViewed = total > 0 && viewedCount === total;

  const handleBeginNight1 = async () => {
    if (!code || !allViewed || starting) return;
    setStarting(true);
    try {
      const playerUids = Object.keys(players.data ?? {});
      await beginNight1(code, playerUids);
    } catch (e) {
      console.error("beginNight1 failed:", e);
      setStarting(false);
    }
  };

  const handleEndNight = async () => {
    if (!code || !game.data || ending) return;
    setEnding(true);
    try {
      await resolveNightOnClient(code, game.data.round);
    } catch (e) {
      console.error("resolveNightOnClient failed:", e);
      setEnding(false);
    }
  };

  const handleEndDay = async () => {
    if (!code || !game.data || endingDay) return;
    setEndingDay(true);
    try {
      await resolveDayOnClient(code, game.data.round);
    } catch (e) {
      console.error("resolveDayOnClient failed:", e);
      setEndingDay(false);
    }
  };

  // Once Night 1 has begun, hand off to the phase-specific console.
  if (game.data) {
    if (game.data.phase === "night") {
      // Denominator = alive players who actually HAVE a night action to submit — not
      // every living player. Civilians/custom roles never submit one (D1), so counting
      // them here would make the counter unable to ever reach its own total (the bug).
      const actionableAliveCount = Object.entries(players.data ?? {}).filter(
        ([uid, p]) => p.alive === true && NIGHT_ACTION_ROLES.has(privateRoles.data?.[uid]?.role ?? ""),
      ).length;
      const submittedCount = Object.keys(nightActions.data ?? {}).length;

      return (
        <main className="relative flex min-h-[100dvh] flex-col items-center bg-neutral-950 px-6 py-16 text-white">
          <BackArrow onBack={actions.goHome} label="Back to Home" />

          <div className="mx-auto flex w-full max-w-md flex-col gap-6">
            <h1 className="text-center text-3xl font-extrabold tracking-tight text-emerald-500">
              Night {game.data.round}
            </h1>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center">
              <p className="text-sm text-neutral-300">
                <span className="font-bold tabular-nums text-emerald-400">
                  {submittedCount}
                </span>{" "}
                of <span className="font-bold tabular-nums">{actionableAliveCount}</span>{" "}
                role-holders have acted
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Not everyone needs to act — ending the night resolves whatever was
                submitted.
              </p>
            </div>

            <button
              type="button"
              onClick={handleEndNight}
              disabled={ending}
              className="rounded-xl bg-emerald-600 px-6 py-4 text-xl font-bold uppercase tracking-wide text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600"
            >
              {ending ? "Resolving…" : "End Night"}
            </button>
          </div>
        </main>
      );
    }

    if (game.data.phase === "day") {
      const alivePlayerCount = playerList.filter((p) => p.alive === true).length;
      const votedCount = Object.keys(votes.data ?? {}).length;

      return (
        <main className="relative flex min-h-[100dvh] flex-col items-center bg-neutral-950 px-6 py-16 text-white">
          <BackArrow onBack={actions.goHome} label="Back to Home" />

          <div className="mx-auto flex w-full max-w-md flex-col gap-6">
            <h1 className="text-center text-3xl font-extrabold tracking-tight text-emerald-500">
              Day {game.data.round}
            </h1>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center">
              <p className="text-sm text-neutral-300">
                <span className="font-bold tabular-nums text-emerald-400">
                  {votedCount}
                </span>{" "}
                of <span className="font-bold tabular-nums">{alivePlayerCount}</span> living
                players have voted
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Votes are public and auditable — the moderator isn&apos;t trusted here.
              </p>
            </div>

            <button
              type="button"
              onClick={handleEndDay}
              disabled={endingDay}
              className="rounded-xl bg-emerald-600 px-6 py-4 text-xl font-bold uppercase tracking-wide text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600"
            >
              {endingDay ? "Resolving…" : "End Day"}
            </button>

            {/* Day chat, read-only (spec-2c FR-10 — the moderator does not act or vote,
                and chat participation is treated the same way; see task 2's documented
                accepted limit on raw database access vs. this UI path). */}
            {code && (
              <Chat
                path={roomPaths.dayChat(code)}
                uid={uid}
                name="Moderator"
                canPost={false}
                label="Day Discussion"
              />
            )}
          </div>
        </main>
      );
    }

    // Ended — same game-over screen everyone else sees (FR-15).
    return <GameOverScreen />;
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center bg-neutral-950 px-6 py-16 text-white">
      <BackArrow onBack={actions.goHome} label="Back to Home" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-500">
            Game Started
          </h1>
          <p className="text-sm text-neutral-400">
            You&apos;re the moderator — you don&apos;t have a role.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
              Seen their role
            </span>
            <span className="text-sm font-bold tabular-nums text-emerald-400">
              {viewedCount} of {total}
            </span>
          </div>

          {total === 0 ? (
            <p className="text-sm text-neutral-500">No players.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {playerList.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5"
                >
                  <span className="truncate text-white">{p.name}</span>
                  <span
                    className={`ml-3 shrink-0 text-xs ${p.viewed ? "text-emerald-400" : "text-neutral-500"}`}
                  >
                    {p.viewed ? "✓ seen" : "waiting…"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className={`text-center text-sm ${allViewed ? "text-emerald-400" : "text-neutral-400"}`}>
          {allViewed
            ? "Everyone has seen their role — you're all set!"
            : "Waiting for everyone to see their role…"}
        </p>

        {allViewed && (
          <button
            type="button"
            onClick={handleBeginNight1}
            disabled={starting}
            className="rounded-xl bg-emerald-600 px-6 py-4 text-xl font-bold uppercase tracking-wide text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600"
          >
            {starting ? "Starting…" : "Begin Night 1"}
          </button>
        )}
      </div>
    </main>
  );
}
