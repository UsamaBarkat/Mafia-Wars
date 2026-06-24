"use client";

// All Done screen (FR-10). Shown after the last player taps Next. A simple
// confirmation plus a button back Home / fresh setup — NO role information of any
// kind (no list, no counts, nothing about who got what), to keep roles secret.

import { useGame } from "@/components/GameProvider";

export function AllDoneScreen() {
  const { actions } = useGame();

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-neutral-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-5xl font-extrabold tracking-tight text-red-600 sm:text-6xl">
            All Done
          </h1>
          <p className="text-lg text-neutral-300">
            Every role has been dealt. Time to play!
          </p>
        </div>

        <button
          type="button"
          onClick={actions.goHome}
          className="w-full max-w-xs rounded-xl bg-red-700 px-6 py-4 text-xl font-bold uppercase tracking-wide text-white hover:bg-red-800 active:bg-red-900"
        >
          Back to Home
        </button>
      </div>
    </main>
  );
}
