// Data-layer: append a chat message to any of the three chat channels (lobby, Mafia,
// Day). No React, no UI. Source of truth: spec-2a FR-9 (lobby) + spec-2c FR-3/8 (Mafia/Day)
// — same shape and rules everywhere (uid must equal auth.uid, ≤300 chars, append-only).
// Ordering/reading is handled by useRoomChat. Channel-agnostic on purpose (task 3, 2c): the
// caller picks the channel by which `roomPaths` builder it passes in.

import { push, ref, serverTimestamp } from "firebase/database";
import { db } from "@/lib/firebase";
import { CUSTOM_NAME_MAX } from "@/lib/roles";

/** Max characters per chat message (mirrors the Security Rules cap). */
export const CHAT_MAX_LENGTH = 300;

/**
 * Append a chat message at `path` (e.g. `roomPaths.chat(code)`, `roomPaths.mafiaChat(code)`,
 * or `roomPaths.dayChat(code)`) as user `uid` with display `name`. Trims and caps the text;
 * a blank message is a no-op. `uid` must be the signed-in user's uid (the rules reject a
 * message whose uid !== auth.uid).
 */
export async function sendChatMessage(
  path: string,
  uid: string,
  name: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (trimmed === "") return;

  await push(ref(db, path), {
    uid,
    name: name.slice(0, CUSTOM_NAME_MAX),
    text: trimmed.slice(0, CHAT_MAX_LENGTH),
    ts: serverTimestamp(),
  });
}
