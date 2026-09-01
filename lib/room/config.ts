// Data-layer: moderator writes to a room's config/roles. No React, no UI.
// Source of truth: spec-2a FR-10 + task-7 rules (config writable only by the moderator).
// Reuses the Phase 1 role model (lib/roles): standard roles + custom, counts, caps.

import { ref, remove, set, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";
import { createCustomRole, createDefaultRoles, type Role } from "@/lib/roles";

function roleRef(code: string, roleId: string) {
  return ref(db, `${roomPaths.configRoles(code)}/${roleId}`);
}

/** Seed the four standard roles at Phase 1 defaults (1/1/1/7) as a map keyed by role id. */
export async function seedDefaultRoles(code: string): Promise<void> {
  const map: Record<string, Role> = {};
  for (const role of createDefaultRoles()) map[role.id] = role;
  await set(ref(db, roomPaths.configRoles(code)), map);
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
