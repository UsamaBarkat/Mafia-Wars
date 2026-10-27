// Data-layer: the moderator ends the night and resolves it on their own device (the
// "resolver" — spec-2b D5). No UI. Source of truth: FR-6/7/8/9, FR-14/15 (win check).
//
// Reads round N's nightActions, the true roles (moderator-read of privateRoles, D3), and
// the current roster (for who's alive), runs the pure resolveNight (task 3), then checks
// the pure checkWin against the roster AFTER every death. One atomic write: flips each
// eliminated player to alive:false, writes each Detective's PRIVATE nightResults, writes
// the PUBLIC nightOutcome (who died, or no one — never a role, D8), and either advances
// game.phase to "day" (round untouched — night/day of the same round share the number)
// or, on a win, ends the game: game -> {phase:'ended', round, winner}.
//
// [2d] Tonight can kill several players at once (spec-2d FR-21): the Mafia kill — or, if
// it landed on Granny, the first Mafia who picked her instead (FR-17..FR-19) — plus every
// linked lover. Lover pairs come from round 1's Cupid "link" actions (the moderator has NO read
// on the private `lovers` node — spec-2d D6). Every death lands in the SAME atomic update
// as the outcome and the phase/winner change, so no device ever sees one lover dead and
// the other alive, and the win check only ever sees the complete result.
//
// publicRoles (FR-15) is a SECOND, separate write made only after the first succeeds.
// The `publicRoles` rule requires `game.phase === 'ended'`, and Security Rules read
// `root` as it exists BEFORE the current write — even within one multi-path update, a
// rule can't see another path's new value from that same operation — so a rule gated on
// "phase is ended" cannot be satisfied by a phase write landing in that same atomic call.
// Sequencing them is the only way to satisfy the rule as written (confirmed against the
// emulator); the trust model here is already the moderator's device (D5), so a tiny
// window between "ended" and "roles visible" is a cosmetic loading state, not a security gap.
//
// Every network call below is wrapped in withTimeout (see ../withTimeout.ts) so a
// stalled read/write fails clearly instead of hanging forever.

import { get, ref, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "../room/paths";
import { resolveNight } from "./resolveNight";
import { loverPairs } from "./lovers";
import { checkWin } from "./checkWin";
import { withTimeout } from "../withTimeout";
import type { NightAction, PlayerEntry, PrivateRoleEntry } from "../room/types";

export async function resolveNightOnClient(code: string, round: number): Promise<void> {
  const [actionsSnap, round1Snap, rolesSnap, playersSnap] = await withTimeout(
    Promise.all([
      get(ref(db, roomPaths.nightActions(code, round))),
      get(ref(db, roomPaths.nightActions(code, 1))),
      get(ref(db, roomPaths.privateRoles(code))),
      get(ref(db, roomPaths.players(code))),
    ]),
    "resolveNightOnClient: reading nightActions/privateRoles/players",
  );
  const actions = (actionsSnap.val() ?? {}) as Record<string, NightAction>;
  const round1Actions = (round1Snap.val() ?? {}) as Record<string, NightAction>;
  const privateRoles = (rolesSnap.val() ?? {}) as Record<string, PrivateRoleEntry>;
  const players = (playersSnap.val() ?? {}) as Record<string, PlayerEntry>;

  const roles: Record<string, string> = {};
  for (const [uid, entry] of Object.entries(privateRoles)) {
    roles[uid] = entry.role;
  }

  const { eliminatedUids, detectiveResults } = resolveNight(
    actions,
    roles,
    loverPairs(round1Actions, roles),
  );
  // Only living players can die; a linked partner who is somehow already dead stays as-is.
  const deaths = eliminatedUids.filter((uid) => players[uid]?.alive === true);

  const updates: Record<string, unknown> = {};
  for (const uid of deaths) {
    updates[roomPaths.playerAlive(code, uid)] = false;
  }
  for (const [detectiveUid, result] of Object.entries(detectiveResults)) {
    updates[roomPaths.nightResult(code, round, detectiveUid)] = result;
  }
  updates[roomPaths.nightOutcome(code, round)] = {
    resolvedAt: Date.now(),
    ...(deaths.length > 0 && {
      eliminatedUids: Object.fromEntries(deaths.map((uid) => [uid, true])),
    }),
    // Single-death fallback for clients that predate eliminatedUids (spec-2d D11). Never
    // written for 2+ deaths, so it can't hint which death was the Mafia's target.
    ...(deaths.length === 1 && { eliminatedUid: deaths[0] }),
  };

  // The roster AFTER every one of tonight's deaths — who checkWin evaluates.
  const aliveUids = Object.entries(players)
    .filter(([uid, p]) => p.alive === true && !deaths.includes(uid))
    .map(([uid]) => uid);
  const winner = checkWin(aliveUids.map((uid) => roles[uid]));

  if (winner) {
    updates[`${roomPaths.game(code)}/phase`] = "ended";
    updates[`${roomPaths.game(code)}/winner`] = winner;
  } else {
    updates[`${roomPaths.game(code)}/phase`] = "day";
  }

  await withTimeout(update(ref(db), updates), "resolveNightOnClient: writing outcome");

  // Second write, only once phase is genuinely "ended" in the database (see header note).
  if (winner) {
    await withTimeout(
      update(ref(db), { [roomPaths.publicRoles(code)]: roles }),
      "resolveNightOnClient: writing publicRoles",
    );
  }
}
