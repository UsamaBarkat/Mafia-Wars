"use client";

// The alive/dead roster for eliminated players (spec-2b FR-17). Self-contained — used
// wherever a not-alive player needs to see who's still standing, alongside whatever
// phase-specific content (outcomes, the day tally) that screen already shows. Never shows
// roles or secret actions — only presence/elimination, which is already public (players
// leave voting/acting on death, per the Edge Cases).

import { useGame } from "@/components/GameProvider";
import { useRoomPlayers } from "@/lib/room/subscriptions";

export function SpectatorView() {
  const { state } = useGame();
  const players = useRoomPlayers(state.roomCode);

  const playerList = Object.values(players.data ?? {}).sort(
    (a, b) => a.joinedAt - b.joinedAt,
  );

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="mb-2 text-center text-sm text-neutral-400">
        You&apos;ve been eliminated — you&apos;re spectating.
      </p>

      <div className="mb-2 flex items-center justify-between border-t border-neutral-800 pt-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Players
        </span>
      </div>

      {playerList.length === 0 ? (
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
                className={`ml-3 shrink-0 text-xs ${p.alive === false ? "text-neutral-500" : "text-emerald-400"}`}
              >
                {p.alive === false ? "eliminated" : "alive"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
