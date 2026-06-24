"use client";

// Configure Roles screen (FR-2..FR-6). Uses the RoleStepper + BackArrow primitives
// and the game actions. Standard roles have no remove control; custom roles do.
// Add Custom Role is an inline field (per plan). START gating/button is task 10.

import { useState } from "react";
import { useGame } from "@/components/GameProvider";
import { BackArrow } from "@/components/ui/BackArrow";
import { RoleStepper } from "@/components/ui/RoleStepper";
import { CUSTOM_NAME_MAX } from "@/lib/roles";

export function ConfigureRolesScreen() {
  const { state, totalPlayers, canStart, disabledReason, actions } = useGame();
  const [name, setName] = useState("");

  // The reducer already trims, blocks empty/duplicates, and caps the name; the UI
  // just disables Add for an all-whitespace field and clears after an attempt.
  const handleAdd = () => {
    actions.addCustomRole(name);
    setName("");
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center bg-neutral-950 px-6 py-20 text-white">
      <BackArrow onBack={actions.goHome} label="Back to Home" />

      <div className="mx-auto w-full max-w-md">
        <h1 className="text-center text-3xl font-extrabold tracking-tight text-red-600">
          Configure Roles
        </h1>

        <p className="mt-2 text-center text-lg text-neutral-300">
          Total Players:{" "}
          <span className="font-bold tabular-nums text-white">{totalPlayers}</span>
        </p>

        {/* Content card holds the role rows + add field, in the dark theme. */}
        <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-xl">
          <div className="divide-y divide-neutral-800">
            {state.roles.map((role) => (
              <RoleStepper
                key={role.id}
                name={role.name}
                count={role.count}
                cap={role.cap}
                onDecrement={() => actions.decRole(role.id)}
                onIncrement={() => actions.incRole(role.id)}
                onRemove={
                  role.isStandard
                    ? undefined
                    : () => actions.removeCustomRole(role.id)
                }
              />
            ))}
          </div>

          {/* Add Custom Role — inline field (FR-6). */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
            className="mt-4 flex items-center gap-2 border-t border-neutral-800 pt-4"
          >
            <input
              type="text"
              value={name}
              maxLength={CUSTOM_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add custom role"
              aria-label="Custom role name"
              className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-base text-white outline-none placeholder:text-neutral-500 focus:border-red-600"
            />
            <button
              type="submit"
              disabled={name.trim() === ""}
              className="shrink-0 rounded-xl bg-red-700 px-5 py-3 text-base font-semibold text-white hover:bg-red-800 active:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>

        {/* START — gated by the derived canStart / disabledReason (task 10). */}
        <div className="mt-6 flex flex-col gap-1">
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
      </div>
    </main>
  );
}
