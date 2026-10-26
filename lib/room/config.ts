// Data-layer: moderator writes to a room's config/roles. No React, no UI.
// Source of truth: spec-2a FR-10 + task-7 rules (config writable only by the moderator).
// Reuses the Phase 1 role model (lib/roles): standard roles + custom, counts, caps.

import { ref, remove, set, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";
import { createCustomRole, createOnlineDefaultRoles, type Role } from "@/lib/roles";

function roleRef(code: string, roleId: string) {
  return ref(db, `${roomPaths.configRoles(code)}/${roleId}`);
}

/** Seed the online built-in roles as a map keyed by role id: the four standard roles at
 *  Phase 1 defaults (1/1/1/7) plus [2d] Jester, Cupid and Granny at 0. */
export async function seedDefaultRoles(code: string): Promise<void> {
  const map: Record<string, Role> = {};
  for (const role of createOnlineDefaultRoles()) map[role.id] = role;
  await set(ref(db, roomPaths.configRoles(code)), map);
}

/** [2d] Add any built-in role row a room is missing (count 0) — rooms seeded before 2d
 *  keep their config through Play Again, so they'd otherwise never get the new roles. */
export async function addMissingBuiltInRoles(
  code: string,
  existingIds: readonly string[],
): Promise<void> {
  const missing = createOnlineDefaultRoles().filter((r) => !existingIds.includes(r.id));
  if (missing.length === 0) return;
  const updates: Record<string, Role> = {};
  for (const role of missing) updates[role.id] = { ...role, count: 0 };
  await update(ref(db, roomPaths.configRoles(code)), updates);
}

/** Set a role's count (caller clamps to [0, cap]). */
export async function setRoleCount(
  code: string,
  roleId: string,
  count: number,
): Promise<void> {
  await update(roleRef(code, roleId), { count });
}

/** Add a custom role (caller validates the name is non-empty/non-duplicate). */
export async function addCustomRole(code: string, name: string): Promise<void> {
  const role = createCustomRole(name);
  await set(roleRef(code, role.id), role);
}

/** Remove a role from config (used for custom roles). */
export async function removeRole(code: string, roleId: string): Promise<void> {
  await remove(roleRef(code, roleId));
}
