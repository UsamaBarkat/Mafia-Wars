"use client";

// Roles-in-this-game panel (FR-8, FR-10). The moderator edits the room's roles (reusing
// the Phase 1 RoleStepper + role model), writing to config/roles in RTDB; players see the
// same roles read-only. Both update live via the parent's useRoomRoles subscription.
// Shows the total role count vs the number of joined players.

import { useEffect, useRef, useState } from "react";
import { CUSTOM_NAME_MAX, type Role } from "@/lib/roles";
import { RoleStepper } from "@/components/ui/RoleStepper";
import {
  addCustomRole,
  removeRole,
  seedDefaultRoles,
  setRoleCount,
} from "@/lib/room/config";

export function RoleConfig({
  code,
  isModerator,
  roles,
  rolesLoaded,
  playerCount,
}: {
  code: string;
  isModerator: boolean;
  roles: Role[];
  rolesLoaded: boolean;
  playerCount: number;
}) {
  const [name, setName] = useState("");
  const seededRef = useRef(false);

  // Moderator seeds the Phase 1 default roles once, the first time a fresh room has no
  // config yet (standard roles always remain in the map afterward, so this never re-fires).
  useEffect(() => {
    if (!isModerator || !rolesLoaded || roles.length > 0 || seededRef.current) return;
    seededRef.current = true;
    seedDefaultRoles(code).catch((e) => console.error("seed roles failed:", e));
  }, [isModerator, rolesLoaded, roles.length, code]);

  const totalRoles = roles.reduce((sum, r) => sum + r.count, 0);

  // Standard roles first (fixed intent), then custom roles by name.
  const sorted = [...roles].sort((a, b) => {
    if (a.isStandard !== b.isStandard) return a.isStandard ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const playerVisible = sorted.filter((r) => r.count > 0);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    const dup = roles.some(
      (r) => r.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    setName("");
    if (dup) return; // block case-insensitive duplicates (Phase 1 rule)
    addCustomRole(code, trimmed).catch((e) => console.error("add role failed:", e));
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Roles in this game
        </span>
        <span className="text-sm font-bold tabular-nums text-emerald-400">
          {totalRoles}
        </span>
      </div>

      {isModerator ? (
        <>
          <div className="divide-y divide-neutral-800">
            {sorted.map((r) => (
              <RoleStepper
                key={r.id}
                name={r.name}
                count={r.count}
                cap={r.cap}
                onDecrement={() => {
                  if (r.count > 0) setRoleCount(code, r.id, r.count - 1);
                }}
                onIncrement={() => {
                  if (r.count < r.cap) setRoleCount(code, r.id, r.count + 1);
                }}
                onRemove={r.isStandard ? undefined : () => removeRole(code, r.id)}
              />
            ))}
          </div>

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
              className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-base text-white outline-none placeholder:text-neutral-500 focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={name.trim() === ""}
              className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </>
      ) : playerVisible.length === 0 ? (
        <p className="text-sm text-neutral-500">No roles configured yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {playerVisible.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-white"
            >
              <span className="truncate">{r.name}</span>
              <span className="ml-3 shrink-0 tabular-nums text-neutral-300">
                ×{r.count}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-center text-xs text-neutral-400">
        {totalRoles} role{totalRoles === 1 ? "" : "s"} · {playerCount} player
        {playerCount === 1 ? "" : "s"} joined
      </p>
    </div>
  );
}
