"use client";

// Home screen (FR-1): title, subtitle, editable in-memory host name (default "Host"),
// START, and ROLES. Reads/writes state via the game context.

import { useGame } from "@/components/GameProvider";

export function HomeScreen() {
  const { state, canStart, disabledReason, actions } = useGame();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-neutral-950 px-6 py-12 text-white">
      {/* Title block */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-red-600 sm:text-6xl">
          Mafia Wars
        </h1>
        <p className="mt-3 text-lg uppercase tracking-[0.2em] text-neutral-400">
          Social Deduction Game
        </p>
      </div>

      {/* Actions */}
      <div className="flex w-full max-w-xs flex-col items-stretch gap-4">
        <label className="flex flex-col gap-1 text-sm text-neutral-400">
          Host name
          <input
            type="text"
            value={state.hostName}
            onChange={(e) => actions.setHostName(e.target.value)}
            aria-label="Host name"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-center text-lg text-white outline-none focus:border-red-600"
          />
        </label>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={actions.start}
            disabled={!canStart}
            className="rounded-xl bg-red-700 px-6 py-4 text-xl font-bold uppercase tracking-wide text-white hover:bg-red-800 active:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-700"
          >
            Start
          </button>
          {!canStart && disabledReason && (
            <p className="text-center text-sm text-red-400">{disabledReason}</p>
          )}
        </div>

        <button
          type="button"
          onClick={actions.goConfigure}
          className="rounded-xl border border-neutral-700 px-6 py-4 text-xl font-semibold uppercase tracking-wide text-neutral-200 hover:bg-neutral-900 active:bg-neutral-800"
        >
          Roles
        </button>
      </div>
    </main>
  );
}
