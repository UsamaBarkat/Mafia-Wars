// Data-layer: append a lobby chat message. No React, no UI.
// Source of truth: spec-2a FR-9 + task-7 rules (uid must equal auth.uid, ≤300 chars,
// append-own only). Ordering/reading is handled by useRoomChat (task-8 style).

import { push, ref, serverTimestamp } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";
import { CUSTOM_NAME_MAX } from "@/lib/roles";

/** Max characters per chat message (mirrors the Security Rules cap). */
export const CHAT_MAX_LENGTH = 300;

/**
 * Append a chat message to room `code` as user `uid` with display `name`. Trims and caps
 * the text; a blank message is a no-op. `uid` must be the signed-in user's uid (the rules
 * reject a message whose uid !== auth.uid).
 */
export async function sendChatMessage(
  code: string,
  uid: string,
  name: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (trimmed === "") return;

  await push(ref(db, roomPaths.chat(code)), {
    uid,
    name: name.slice(0, CUSTOM_NAME_MAX),
    text: trimmed.slice(0, CHAT_MAX_LENGTH),
    ts: serverTimestamp(),
  });
}
