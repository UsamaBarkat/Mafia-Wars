"use client";

// Configure Roles screen (FR-2..FR-6). Uses the RoleStepper + BackArrow primitives
// and the game actions. Standard roles have no remove control; custom roles do.
// Roles are grouped under "Standard Roles" / "Custom Roles" headers, each row showing
// its cap. The "+ Add Custom Role" row expands into the inline name field (FR-6).

import { useState } from "react";
import { useGame } from "@/components/GameProvider";
import { BackArrow } from "@/components/ui/BackArrow";
import { RoleStepper } from "@/components/ui/RoleStepper";
import { CUSTOM_NAME_MAX, type Role } from "@/lib/roles";

export function ConfigureRolesScreen() {
  const { state, totalPlayers, canStart, disabledReason, actions } = useGame();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  // The reducer already trims, blocks empty/duplicates, and caps the name; the UI
  // just disables Add for an all-whitespace field and clears after an attempt.
  const handleAdd = () => {
    actions.addCustomRole(name);
    setName("");
    setAdding(false);
  };

  const cancelAdd = () => {
    setName("");
    setAdding(false);
  };

  const standardRoles = state.roles.filter((role) => role.isStandard);
  const customRoles = state.roles.filter((role) => !role.isStandard);

  const renderRow = (role: Role) => (
    <RoleStepper
      key={role.id}
      name={role.name}
      count={role.count}
      cap={role.cap}
      subtitle={`Max: ${role.cap}`}
      onDecrement={() => actions.decRole(role.id)}
      onIncrement={() => actions.incRole(role.id)}
      onRemove={
        role.isStandard ? undefined : () => actions.removeCustomRole(role.id)
      }
    />
  );

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

        {/* Content card holds the grouped role rows + add entry, in the dark theme. */}
        <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-xl">
          <h2 className="text-left text-base font-bold text-white">Standard Roles</h2>
          <div className="mt-1 divide-y divide-neutral-800">
            {standardRoles.map(renderRow)}
          </div>

          {customRoles.length > 0 && (
            <>
              <h2 className="mt-4 border-t border-neutral-800 pt-4 text-left text-base font-bold text-white">
                Custom Roles
              </h2>
              <div className="mt-1 divide-y divide-neutral-800">
                {customRoles.map(renderRow)}
              </div>
            </>
          )}

          {/* Add Custom Role (FR-6): a full-width row that opens the inline field. */}
          <div className="mt-4 border-t border-neutral-800 pt-4">
            {!adding ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full rounded-xl border border-dashed border-neutral-700 px-4 py-3 text-base font-semibold text-red-500 hover:bg-neutral-800 active:bg-neutral-700"
              >
                + Add Custom Role
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAdd();
                }}
                className="flex flex-col gap-2"
              >
                <input
                  type="text"
                  value={name}
                  maxLength={CUSTOM_NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Custom role name"
                  aria-label="Custom role name"
                  autoFocus
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-base text-white outline-none placeholder:text-neutral-500 focus:border-red-600"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelAdd}
                    className="flex-1 rounded-xl border border-neutral-700 px-5 py-3 text-base font-semibold text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={name.trim() === ""}
                    className="flex-1 rounded-xl bg-red-700 px-5 py-3 text-base font-semibold text-white hover:bg-red-800 active:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}
          </div>
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
