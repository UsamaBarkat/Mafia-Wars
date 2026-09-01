"use client";

// Moderator post-start view (FR-15 / D6). After the game starts, the moderator sees the
// live per-player "has viewed their role" status — and NEVER any role (the moderator
// can't even read privateRoles per the task-7 rules). 2a ends when everyone has viewed.

import { useGame } from "@/components/GameProvider";
import { useRoomPlayers } from "@/lib/room/subscriptions";
import { BackArrow } from "@/components/ui/BackArrow";

export function ModeratorStarted() {
  const { state, actions } = useGame();
  const players = useRoomPlayers(state.roomCode);

  const playerList = Object.values(players.data ?? {}).sort(
    (a, b) => a.joinedAt - b.joinedAt,
  );
  const total = playerList.length;
  const viewedCount = playerList.filter((p) => p.viewed === true).length;
  const allViewed = total > 0 && viewedCount === total;

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
      </div>
    </main>
  );
}
