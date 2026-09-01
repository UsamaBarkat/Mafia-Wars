"use client";

// Waiting Room (FR-6, FR-7, FR-8, FR-17). Live via the task-8 subscriptions: shareable
// code + copy, live roster (names + connected), configured roles + total, a moderator
// banner vs player view, and a display-only readiness line. Presence (setupPresence) is
// wired for joined players here (the moderator is not a player). START gating + role
// configuration + chat are later tasks.

import { useEffect, useState } from "react";
import { useGame } from "@/components/GameProvider";
import { useAuthUid } from "@/lib/useAuthUid";
import { BackArrow } from "@/components/ui/BackArrow";
import {
  useRoomMeta,
  useRoomPlayers,
  useRoomRoles,
} from "@/lib/room/subscriptions";
import { leaveRoom } from "@/lib/room/leaveRoom";
import { setupPresence } from "@/lib/room/presence";
import { startGame } from "@/lib/room/startGame";
import { dealRoles } from "@/lib/room/dealRoles";
import {
  touchRoom,
  endRoom,
  roomDeadReason,
  deadRoomMessage,
  ROOM_HEARTBEAT_MS,
} from "@/lib/room/lifecycle";
import { evaluateOnlineStart } from "@/lib/validation";
import { Chat } from "@/components/online/Chat";
import { RoleConfig } from "@/components/online/RoleConfig";
import { OnlineRevealScreen } from "@/components/screens/OnlineRevealScreen";

export function WaitingRoomScreen() {
  const { state, actions } = useGame();
  const { uid } = useAuthUid();
  const code = state.roomCode;

  const meta = useRoomMeta(code);
  const players = useRoomPlayers(code);
  const roles = useRoomRoles(code);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Presence for joined players only — arm onDisconnect on entry, clean up on unmount.
  // The moderator is not a player and has no roster/presence entry (D9).
  useEffect(() => {
    if (state.isModerator || !code || !uid) return;
    const stop = setupPresence(code, uid);
    return () => stop();
  }, [state.isModerator, code, uid]);

  // Moderator heartbeat — keeps the room alive while the moderator's tab is open (D3/D5).
  // If the moderator leaves the tab, this stops and the room goes dead after ROOM_ABANDON_MS.
  useEffect(() => {
    if (!state.isModerator || !code) return;
    touchRoom(code).catch(() => {});
    const id = setInterval(() => touchRoom(code).catch(() => {}), ROOM_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [state.isModerator, code]);

  // Re-check room liveness periodically so an abandoned room is noticed even with no
  // further snapshots (lastActivity simply stops advancing).
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const playerList = Object.values(players.data ?? {}).sort(
    (a, b) => a.joinedAt - b.joinedAt,
  );
  const playerCount = playerList.length;

  const allRoles = Object.values(roles.data ?? {});
  const connectedCount = playerList.filter((p) => p.connected).length;

  // Live START gate: valid setup AND connected players == Total Players Needed (FR-11).
  const startEval = evaluateOnlineStart(allRoles, connectedCount);
  const inLobby = (meta.data?.status ?? "lobby") === "lobby";

  const handleStart = async () => {
    if (!code || !startEval.canStart || starting) return;
    setStarting(true);
    try {
      // Capture the currently-connected players (excludes the moderator) for the deal.
      const connectedUids = Object.entries(players.data ?? {})
        .filter(([, p]) => p.connected)
        .map(([uid]) => uid);
      await startGame(code); // status → "dealing" (both windows: "The game is starting…")
      await dealRoles(code, connectedUids, allRoles); // writes privateRoles + status → "in_game"
    } catch (e) {
      console.error("start/deal failed:", e);
      setStarting(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  };

  const handleLeave = async () => {
    // The moderator leaving ends the room for everyone (D3, no auto-transfer); a player
    // just frees their own slot.
    if (code) {
      if (state.isModerator) {
        try {
          await endRoom(code);
        } catch {
          /* best-effort end */
        }
      } else if (uid) {
        try {
          await leaveRoom(code, uid);
        } catch {
          /* best-effort leave */
        }
      }
    }
    actions.goHome();
  };

  // Dead-room handling (D3 moderator-gone / D5 expiry) — for EVERYONE still in the room.
  // Covers removed (gone), moderator-ended, and moderator-abandoned (stale lastActivity).
  const deadReason = meta.loading ? null : roomDeadReason(meta.data, nowTick);
  if (!code || deadReason) {
    return (
      <main className="relative flex min-h-[100dvh] items-center justify-center bg-neutral-950 px-6 py-16 text-white">
        <BackArrow onBack={actions.goHome} label="Back to Home" />
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-bold text-neutral-300">This game has ended.</h1>
          <p className="text-sm text-neutral-400">
            {deadRoomMessage(deadReason) || "This game no longer exists."}
          </p>
          <button
            type="button"
            onClick={actions.goHome}
            className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  // Alive and in game → hand off to the per-device reveal (players: own role only; the
  // moderator: the post-start "viewed" view). The moderator heartbeat keeps running here
  // because WaitingRoomScreen stays mounted.
  if (meta.data?.status === "in_game") {
    return <OnlineRevealScreen />;
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center bg-neutral-950 px-6 py-16 text-white">
      <BackArrow onBack={handleLeave} label="Leave room" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <h1 className="text-center text-3xl font-extrabold tracking-tight text-emerald-500">
          Waiting Room
        </h1>

        {/* Shareable game code + copy */}
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <span className="text-xs uppercase tracking-widest text-neutral-400">
            Game code
          </span>
          <span className="text-5xl font-bold tracking-[0.3em] tabular-nums">
            {code}
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="mt-1 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-emerald-400 hover:bg-emerald-950"
          >
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>

        {/* Moderator banner / player badge */}
        {state.isModerator ? (
          <div className="rounded-xl border border-emerald-700 bg-emerald-950/50 px-4 py-3 text-center text-sm text-emerald-300">
            You are the <span className="font-bold">Moderator</span> — you do not play,
            only manage the game.
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-center text-sm text-neutral-300">
            You&apos;re in as{" "}
            <span className="font-bold text-white">{state.onlineName || "Player"}</span>
            . You&apos;ll get your secret role when the game starts.
          </div>
        )}

        {/* Live players */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
              Players
            </span>
            <span className="text-sm font-bold tabular-nums text-emerald-400">
              {playerCount}
            </span>
          </div>
          {playerCount === 0 ? (
            <p className="text-sm text-neutral-500">No players have joined yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {playerList.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-white"
                >
                  <span className="truncate">{p.name}</span>
                  <span
                    className={`ml-3 shrink-0 text-xs ${p.connected ? "text-emerald-400" : "text-neutral-500"}`}
                  >
                    {p.connected ? "● connected" : "○ away"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Roles in this game — moderator edits, players see read-only (live) */}
        <RoleConfig
          code={code}
          isModerator={state.isModerator}
          roles={allRoles}
          rolesLoaded={!roles.loading}
          playerCount={playerCount}
        />

        {/* START gate — moderator only; players see a readiness line (FR-11) */}
        {!inLobby ? (
          <p className="text-center text-sm text-emerald-400">
            The game is starting…
          </p>
        ) : state.isModerator ? (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={handleStart}
              disabled={!startEval.canStart || starting}
              className="rounded-xl bg-emerald-600 px-6 py-4 text-xl font-bold uppercase tracking-wide text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600"
            >
              {starting ? "Starting…" : "Start Game"}
            </button>
            {!startEval.canStart && startEval.reason && (
              <p className="text-center text-sm text-amber-400">{startEval.reason}</p>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-neutral-400">
            {startEval.canStart
              ? "Ready — waiting for the moderator to start."
              : (startEval.reason ?? "Waiting for the moderator…")}
          </p>
        )}

        {/* Lobby chat (everyone in the room) */}
        <Chat
          code={code}
          uid={uid}
          name={state.onlineName || (state.isModerator ? "Moderator" : "Player")}
        />
      </div>
    </main>
  );
}
