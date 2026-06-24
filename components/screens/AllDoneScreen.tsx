"use client";

// All Done screen (FR-10). Shown after the last player taps Next. A simple
// confirmation plus a button back Home / fresh setup — NO role information of any
// kind (no list, no counts, nothing about who got what), to keep roles secret.

import { useGame } from "@/components/GameProvider";

export function AllDoneScreen() {
  const { actions } = useGame();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-neutral-950 px-6 py-12 text-white">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-red-600 sm:text-6xl">
          All Done
        </h1>
        <p className="mt-4 text-lg text-neutral-300">
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
    </main>
  );
}
