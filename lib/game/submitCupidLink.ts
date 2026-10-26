// Data-layer: Cupid links two lovers on Night 1. No UI.
// Source of truth: spec-2d FR-7/8/10, D3/D5.
//
// One atomic multi-path write: Cupid's round-1 "link" night action (the resolver reads
// this to find the pair — the moderator has no read on `lovers`, D6) plus both reciprocal
// lovers entries, each readable only by that lover. The Security Rules require all three
// together, tie the lovers entries to this exact action, and make the action write-once —
// so this can succeed only once per game, and only for this pair.

import { ref, serverTimestamp, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "../room/paths";

export async function submitCupidLink(
  code: string,
  cupidUid: string,
  firstUid: string,
  secondUid: string,
): Promise<void> {
  await update(ref(db), {
    [roomPaths.nightAction(code, 1, cupidUid)]: {
      role: "Cupid",
      action: "link",
      targetUid: firstUid,
      secondTargetUid: secondUid,
      submittedAt: serverTimestamp(),
    },
    [`${roomPaths.loversEntry(code, firstUid)}/${secondUid}`]: true,
    [`${roomPaths.loversEntry(code, secondUid)}/${firstUid}`]: true,
  });
}
