// Data-layer: the moderator ends the day and resolves it. No UI.
// Source of truth: spec-2b FR-11 (moderator ends), FR-12 (tally + tie/Skip), FR-13
// (advances to the next night), FR-14/15 (win check). Votes are PUBLIC (D2), so unlike
// the night this tally is auditable by any room member — the moderator isn't trusted with
// secret inputs here. The roles used for the win check ARE still trust-dependent (D5),
// read the same moderator-only way the night resolver does.
//
// Reads round N's votes plus the true roles + current roster (for the win check), runs
// the pure resolveDay (task 3), then checks the pure checkWin against the roster AFTER
// this elimination. One atomic write: the eliminated player (if any) alive:false, the
// PUBLIC dayOutcome (never a role, D8), and either advances to the NEXT night —
// phase:'night', round+1 (round only increments here; End Night, task 6, leaves it
// unchanged) — or, on a win, ends the game: game -> {phase:'ended', round, winner}.
//
// publicRoles (FR-15) is a SECOND, separate write made only after the first succeeds —
// see the matching note in resolveNightOnClient.ts: its rule requires
// `game.phase === 'ended'`, and Security Rules read `root` as it exists BEFORE the
// current write, even within one multi-path update, so that gate can't be satisfied by a
// phase write landing in the same atomic call (confirmed against the emulator).

import { get, ref, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "../room/paths";
import { resolveDay } from "./resolveDay";
import { checkWin } from "./checkWin";
import type { PlayerEntry, PrivateRoleEntry, Vote } from "../room/types";

export async function resolveDayOnClient(code: string, round: number): Promise<void> {
  const [votesSnap, rolesSnap, playersSnap] = await Promise.all([
    get(ref(db, roomPaths.votes(code, round))),
    get(ref(db, roomPaths.privateRoles(code))),
    get(ref(db, roomPaths.players(code))),
  ]);
  const votes = (votesSnap.val() ?? {}) as Record<string, Vote>;
  const privateRoles = (rolesSnap.val() ?? {}) as Record<string, PrivateRoleEntry>;
  const players = (playersSnap.val() ?? {}) as Record<string, PlayerEntry>;

  const roles: Record<string, string> = {};
  for (const [uid, entry] of Object.entries(privateRoles)) {
    roles[uid] = entry.role;
  }

  const { eliminatedUid } = resolveDay(votes);

  const updates: Record<string, unknown> = {};
  if (eliminatedUid) {
    updates[roomPaths.playerAlive(code, eliminatedUid)] = false;
  }
  updates[roomPaths.dayOutcome(code, round)] = {
    eliminatedUid: eliminatedUid ?? null,
    resolvedAt: Date.now(),
  };

  // The roster AFTER today's elimination — who checkWin evaluates.
  const aliveUids = Object.entries(players)
    .filter(([uid, p]) => p.alive === true && uid !== eliminatedUid)
    .map(([uid]) => uid);
  const winner = checkWin(aliveUids.map((uid) => roles[uid]));

  if (winner) {
    updates[`${roomPaths.game(code)}/phase`] = "ended";
    updates[`${roomPaths.game(code)}/winner`] = winner;
  } else {
    updates[`${roomPaths.game(code)}/phase`] = "night";
    updates[`${roomPaths.game(code)}/round`] = round + 1;
  }

  await update(ref(db), updates);

  // Second write, only once phase is genuinely "ended" in the database (see header note).
  if (winner) {
    await update(ref(db), { [roomPaths.publicRoles(code)]: roles });
  }
}
