"use client";

// Game-over screen (spec-2b FR-14/15, D8/D9). Shown to EVERYONE — players and the
// moderator alike — once `game.phase === 'ended'`: the winning team and the full role
// reveal (`publicRoles`, moderator-written only at this point — the ONLY point any role
// becomes visible to anyone but its own owner).
//
// Play Again (spec-2c FR-11/11a, D8/D10): moderator-only, confirm-gated, reuses the
// existing ConfirmDialog. Confirming calls resetForPlayAgain (task 4), which flips
// meta.status back to "lobby" — every connected device (including this one) then
// live-routes back to the Waiting Room via the same subscriptions WaitingRoomScreen
// already uses, so no local navigation is needed on success. Players/spectators never
// see this control at all; they just land back in the lobby once the moderator confirms.

import { useState } from "react";
import { useGame } from "@/components/GameProvider";
import { useGameState, usePublicRoles, useRoomPlayers } from "@/lib/room/subscriptions";
import { resetForPlayAgain } from "@/lib/room/resetForPlayAgain";
import { BackArrow } from "@/components/ui/BackArrow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function GameOverScreen() {
  const { state, actions } = useGame();
  const code = state.roomCode;

  const game = useGameState(code);
  const players = useRoomPlayers(code);
  const publicRoles = usePublicRoles(code);
  const [confirmingPlayAgain, setConfirmingPlayAgain] = useState(false);
  const [resetting, setResetting] = useState(false);

  const winner = game.data?.winner ?? null;

  const roster = Object.entries(publicRoles.data ?? {})
    .map(([uid, role]) => ({ uid, role, name: players.data?.[uid]?.name ?? "Unknown" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handlePlayAgain = async () => {
    if (!code || resetting) return;
    setConfirmingPlayAgain(false);
    setResetting(true);
    try {
      const playerUids = Object.keys(players.data ?? {});
      await resetForPlayAgain(code, playerUids);
      // Success: meta.status flips to "lobby" and every connected device (this one
      // included) live-routes back to the Waiting Room automatically — no local
      // navigation or state reset needed here (matches handleBeginNight1's pattern).
    } catch (e) {
      console.error("resetForPlayAgain failed:", e);
      setResetting(false);
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center bg-neutral-950 px-6 py-16 text-white">
      <BackArrow onBack={actions.goHome} label="Back to Home" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xs uppercase tracking-widest text-emerald-500">Game Over</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            {winner === "town"
              ? "Town wins!"
              : winner === "mafia"
                ? "Mafia wins!"
                : "Loading…"}
          </h1>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-300">
            Roles revealed
          </p>
          {roster.length === 0 ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {roster.map((r) => (
                <li
                  key={r.uid}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5"
                >
                  <span className="truncate text-white">{r.name}</span>
                  <span className="ml-3 shrink-0 font-semibold text-emerald-400">
                    {r.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={actions.goHome}
          className="rounded-xl bg-emerald-600 px-6 py-4 text-xl font-bold uppercase tracking-wide text-white hover:bg-emerald-700 active:bg-emerald-800"
        >
          Back to Home
        </button>

        {/* Moderator-only, no connection-count gate (D10) — players/spectators see no
            such control and just land back in the lobby once the reset takes effect. */}
        {state.isModerator && (
          <button
            type="button"
            onClick={() => setConfirmingPlayAgain(true)}
            disabled={resetting}
            className="rounded-xl border border-emerald-600 px-6 py-4 text-xl font-bold uppercase tracking-wide text-emerald-400 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {resetting ? "Starting new game…" : "Play Again"}
          </button>
        )}
      </div>

      {confirmingPlayAgain && (
        <ConfirmDialog
          message="Start a new game in this room? This clears all chat and round data from this game — the room, players, and role configuration stay."
          confirmLabel="Play Again"
          cancelLabel="Cancel"
          onConfirm={handlePlayAgain}
          onCancel={() => setConfirmingPlayAgain(false)}
        />
      )}
    </main>
  );
}
