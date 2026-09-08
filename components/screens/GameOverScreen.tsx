"use client";

// Game-over screen (spec-2b FR-14/15, D8/D9). Shown to EVERYONE — players and the
// moderator alike — once `game.phase === 'ended'`: the winning team and the full role
// reveal (`publicRoles`, moderator-written only at this point — the ONLY point any role
// becomes visible to anyone but its own owner).

import { useGame } from "@/components/GameProvider";
import { useGameState, usePublicRoles, useRoomPlayers } from "@/lib/room/subscriptions";
import { BackArrow } from "@/components/ui/BackArrow";

export function GameOverScreen() {
  const { state, actions } = useGame();
  const code = state.roomCode;

  const game = useGameState(code);
  const players = useRoomPlayers(code);
  const publicRoles = usePublicRoles(code);

  const winner = game.data?.winner ?? null;

  const roster = Object.entries(publicRoles.data ?? {})
    .map(([uid, role]) => ({ uid, role, name: players.data?.[uid]?.name ?? "Unknown" }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
      </div>
    </main>
  );
}
