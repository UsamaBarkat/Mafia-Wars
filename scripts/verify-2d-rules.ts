// Slice 2d Security Rules verification (tasks-2d task 2), plus 2b/2c regression checks.
// EMULATOR ONLY. Run:  npx tsx scripts/verify-2d-rules.ts
//
// Every check uses a real signed-in anonymous identity, so reads/writes go through the
// rules exactly as a browser tab would. Room state is seeded via adminPut (rules bypassed).

import { get, ref, remove, serverTimestamp, set, update } from "firebase/database";
import {
  adminGet,
  adminPut,
  allowed,
  check,
  denied,
  freshCode,
  signedInClient,
  summary,
  type Client,
} from "./emulator";

type Seat = { who: Client; role: string; alive?: boolean };

async function seedRoom(
  code: string,
  mod: Client,
  seats: Seat[],
  game: { phase: string; round: number } | null,
): Promise<void> {
  const players: Record<string, unknown> = {};
  const privateRoles: Record<string, unknown> = {};
  seats.forEach((s, i) => {
    players[s.who.uid] = {
      name: `P${i}-${s.role}`,
      joinedAt: i,
      connected: true,
      lastSeen: 0,
      alive: s.alive ?? true,
    };
    privateRoles[s.who.uid] = { role: s.role };
  });
  await adminPut(`rooms/${code}`, {
    meta: { moderatorId: mod.uid, status: "in_game", createdAt: 0, lastActivity: 0 },
    players,
    privateRoles,
    ...(game ? { game } : {}),
  });
}

/** Cupid's atomic Night-1 write: the link action plus both reciprocal lovers entries. */
function linkUpdate(code: string, cupidUid: string, a: string, b: string, round = 1) {
  return {
    [`rooms/${code}/rounds/${round}/nightActions/${cupidUid}`]: {
      role: "Cupid",
      action: "link",
      targetUid: a,
      secondTargetUid: b,
      submittedAt: serverTimestamp(),
    },
    [`rooms/${code}/lovers/${a}/${b}`]: true,
    [`rooms/${code}/lovers/${b}/${a}`]: true,
  };
}

async function main() {
  const [mod, cupid, a, b, c, mafia, mafia2, dead] = await Promise.all(
    Array.from({ length: 8 }, () => signedInClient()),
  );
  const seats: Seat[] = [
    { who: cupid, role: "Cupid" },
    { who: a, role: "Civilian" },
    { who: b, role: "Granny" },
    { who: c, role: "Jester" },
    { who: mafia, role: "Mafia" },
    { who: mafia2, role: "Mafia" },
    { who: dead, role: "Civilian", alive: false },
  ];

  console.log("\n== Cupid link + lovers (happy path, then lock) ==");
  const R1 = freshCode();
  await seedRoom(R1, mod, seats, { phase: "night", round: 1 });

  await check("living Cupid on Night 1 links A+B atomically (action + both lovers entries)", () =>
    allowed(update(ref(cupid.db), linkUpdate(R1, cupid.uid, a.uid, b.uid))),
  );
  await check("lover A reads own entry and sees partner B", async () => {
    const snap = await get(ref(a.db, `rooms/${R1}/lovers/${a.uid}`));
    return JSON.stringify(snap.val()) === JSON.stringify({ [b.uid]: true });
  });
  await check("lover B reads own entry and sees partner A", async () => {
    const snap = await get(ref(b.db, `rooms/${R1}/lovers/${b.uid}`));
    return JSON.stringify(snap.val()) === JSON.stringify({ [a.uid]: true });
  });
  await check("lover A is denied reading partner B's entry", () =>
    denied(get(ref(a.db, `rooms/${R1}/lovers/${b.uid}`))),
  );
  await check("another player (Jester) is denied reading lover A's entry", () =>
    denied(get(ref(c.db, `rooms/${R1}/lovers/${a.uid}`))),
  );
  await check("a Mafia is denied reading lover A's entry", () =>
    denied(get(ref(mafia.db, `rooms/${R1}/lovers/${a.uid}`))),
  );
  await check("a spectator (dead player) is denied reading lover A's entry", () =>
    denied(get(ref(dead.db, `rooms/${R1}/lovers/${a.uid}`))),
  );
  await check("Cupid is denied reading lover A's entry", () =>
    denied(get(ref(cupid.db, `rooms/${R1}/lovers/${a.uid}`))),
  );
  await check("moderator is denied reading the whole lovers node", () =>
    denied(get(ref(mod.db, `rooms/${R1}/lovers`))),
  );
  await check("moderator is denied reading lover A's entry", () =>
    denied(get(ref(mod.db, `rooms/${R1}/lovers/${a.uid}`))),
  );
  await check("a player is denied reading the whole lovers node", () =>
    denied(get(ref(a.db, `rooms/${R1}/lovers`))),
  );
  await check("Cupid can read back his own link action", async () => {
    const snap = await get(ref(cupid.db, `rooms/${R1}/rounds/1/nightActions/${cupid.uid}`));
    return snap.val()?.action === "link" && typeof snap.val()?.submittedAt === "number";
  });
  await check("a Mafia is denied reading Cupid's link action", () =>
    denied(get(ref(mafia.db, `rooms/${R1}/rounds/1/nightActions/${cupid.uid}`))),
  );
  await check("Cupid is denied CHANGING the link (overwrite with A+C)", () =>
    denied(update(ref(cupid.db), linkUpdate(R1, cupid.uid, a.uid, c.uid))),
  );
  await check("Cupid is denied DELETING his link action", () =>
    denied(remove(ref(cupid.db, `rooms/${R1}/rounds/1/nightActions/${cupid.uid}`))),
  );
  await check("Cupid is denied deleting a lovers entry", () =>
    denied(remove(ref(cupid.db, `rooms/${R1}/lovers/${a.uid}/${b.uid}`))),
  );
  await check("Cupid is denied adding an extra pair A+C that doesn't match his action", () =>
    denied(
      update(ref(cupid.db), {
        [`rooms/${R1}/lovers/${a.uid}/${c.uid}`]: true,
        [`rooms/${R1}/lovers/${c.uid}/${a.uid}`]: true,
      }),
    ),
  );
  await check("Cupid re-writing his own pair's entries (idempotent true) is allowed", () =>
    allowed(
      update(ref(cupid.db), {
        [`rooms/${R1}/lovers/${a.uid}/${b.uid}`]: true,
        [`rooms/${R1}/lovers/${b.uid}/${a.uid}`]: true,
      }),
    ),
  );
  await check("moderator can clear the whole lovers node (Play Again)", () =>
    allowed(remove(ref(mod.db, `rooms/${R1}/lovers`))),
  );

  console.log("\n== Cupid link — invalid picks ==");
  const R2 = freshCode();
  await seedRoom(R2, mod, seats, { phase: "night", round: 1 });

  await check("Cupid picking HIMSELF is denied", () =>
    denied(update(ref(cupid.db), linkUpdate(R2, cupid.uid, cupid.uid, a.uid))),
  );
  await check("Cupid picking the SAME player twice is denied", () =>
    denied(
      set(ref(cupid.db, `rooms/${R2}/rounds/1/nightActions/${cupid.uid}`), {
        role: "Cupid", action: "link", targetUid: a.uid, secondTargetUid: a.uid, submittedAt: serverTimestamp(),
      }),
    ),
  );
  await check("Cupid picking a DEAD player is denied", () =>
    denied(update(ref(cupid.db), linkUpdate(R2, cupid.uid, a.uid, dead.uid))),
  );
  await check("Cupid's link with role field 'Mafia' (disguise) is denied", () =>
    denied(
      set(ref(cupid.db, `rooms/${R2}/rounds/1/nightActions/${cupid.uid}`), {
        role: "Mafia", action: "link", targetUid: a.uid, secondTargetUid: b.uid, submittedAt: serverTimestamp(),
      }),
    ),
  );
  await check("lovers entries WITHOUT the reciprocal entry are denied", () =>
    denied(
      update(ref(cupid.db), {
        [`rooms/${R2}/rounds/1/nightActions/${cupid.uid}`]: {
          role: "Cupid", action: "link", targetUid: a.uid, secondTargetUid: b.uid, submittedAt: serverTimestamp(),
        },
        [`rooms/${R2}/lovers/${a.uid}/${b.uid}`]: true,
      }),
    ),
  );
  await check("lovers entries with NO link action at all are denied", () =>
    denied(
      update(ref(cupid.db), {
        [`rooms/${R2}/lovers/${a.uid}/${b.uid}`]: true,
        [`rooms/${R2}/lovers/${b.uid}/${a.uid}`]: true,
      }),
    ),
  );
  await check("a non-Cupid (Civilian) writing a link action is denied", () =>
    denied(update(ref(a.db), linkUpdate(R2, a.uid, b.uid, c.uid))),
  );
  await check("a non-Cupid (Mafia) writing lovers entries is denied", () =>
    denied(
      update(ref(mafia.db), {
        [`rooms/${R2}/lovers/${a.uid}/${b.uid}`]: true,
        [`rooms/${R2}/lovers/${b.uid}/${a.uid}`]: true,
      }),
    ),
  );
  await check("the moderator writing a link action is denied (no Cupid role)", () =>
    denied(
      set(ref(mod.db, `rooms/${R2}/rounds/1/nightActions/${mod.uid}`), {
        role: "Cupid", action: "link", targetUid: a.uid, secondTargetUid: b.uid, submittedAt: 1,
      }),
    ),
  );

  console.log("\n== Cupid link — wrong night / dead Cupid / day ==");
  const R3 = freshCode();
  await seedRoom(R3, mod, seats, { phase: "night", round: 2 });
  await check("Cupid linking on Night 2 (rounds/2) is denied", () =>
    denied(update(ref(cupid.db), linkUpdate(R3, cupid.uid, a.uid, b.uid, 2))),
  );
  await check("Cupid writing rounds/1 while the game is on Night 2 is denied", () =>
    denied(update(ref(cupid.db), linkUpdate(R3, cupid.uid, a.uid, b.uid, 1))),
  );

  const R4 = freshCode();
  await seedRoom(
    R4,
    mod,
    seats.map((s) => (s.who === cupid ? { ...s, alive: false } : s)),
    { phase: "night", round: 1 },
  );
  await check("a DEAD Cupid linking on Night 1 is denied", () =>
    denied(update(ref(cupid.db), linkUpdate(R4, cupid.uid, a.uid, b.uid))),
  );

  const R5 = freshCode();
  await seedRoom(R5, mod, seats, { phase: "day", round: 1 });
  await check("Cupid linking during Day 1 is denied", () =>
    denied(update(ref(cupid.db), linkUpdate(R5, cupid.uid, a.uid, b.uid))),
  );

  console.log("\n== Winner / outcome shapes / Play Again ==");
  const R6 = freshCode();
  await seedRoom(R6, mod, seats, { phase: "day", round: 2 });
  await check("moderator can write winner 'jester'", () =>
    allowed(update(ref(mod.db, `rooms/${R6}/game`), { phase: "ended", winner: "jester" })),
  );
  await check("an unknown winner value is still rejected", () =>
    denied(update(ref(mod.db, `rooms/${R6}/game`), { winner: "lovers" })),
  );
  await check("a player cannot write the winner", () =>
    denied(update(ref(c.db, `rooms/${R6}/game`), { winner: "jester" })),
  );
  await check("moderator can write a night outcome with eliminatedUids", () =>
    allowed(
      set(ref(mod.db, `rooms/${R6}/rounds/2/nightOutcome`), {
        eliminatedUids: { [a.uid]: true, [b.uid]: true },
        resolvedAt: Date.now(),
      }),
    ),
  );
  await check("a malformed eliminatedUids entry (not true) is rejected", () =>
    denied(
      set(ref(mod.db, `rooms/${R6}/rounds/2/dayOutcome`), {
        eliminatedUid: a.uid,
        eliminatedUids: { [a.uid]: "yes" },
        resolvedAt: Date.now(),
      }),
    ),
  );
  await check("moderator can write a day outcome with eliminatedUid + eliminatedUids", () =>
    allowed(
      set(ref(mod.db, `rooms/${R6}/rounds/2/dayOutcome`), {
        eliminatedUid: a.uid,
        eliminatedUids: { [a.uid]: true, [b.uid]: true },
        resolvedAt: Date.now(),
      }),
    ),
  );
  await check("a player cannot write the night outcome", () =>
    denied(set(ref(a.db, `rooms/${R6}/rounds/2/nightOutcome`), { resolvedAt: 1 })),
  );
  await adminPut(`rooms/${R6}/lovers`, { [a.uid]: { [b.uid]: true }, [b.uid]: { [a.uid]: true } });
  await check("a non-moderator cannot clear the lovers node", () =>
    denied(remove(ref(a.db, `rooms/${R6}/lovers`))),
  );

  console.log("\n== Regression: 2b night actions / secrecy ==");
  const R7 = freshCode();
  await seedRoom(R7, mod, seats, { phase: "night", round: 1 });
  await check("Mafia kill pick with a server timestamp is allowed", () =>
    allowed(
      set(ref(mafia.db, `rooms/${R7}/rounds/1/nightActions/${mafia.uid}`), {
        role: "Mafia", action: "kill", targetUid: b.uid, submittedAt: serverTimestamp(),
      }),
    ),
  );
  await check("Mafia can CHANGE a kill pick (non-link actions stay re-writable)", () =>
    allowed(
      set(ref(mafia.db, `rooms/${R7}/rounds/1/nightActions/${mafia.uid}`), {
        role: "Mafia", action: "kill", targetUid: a.uid, submittedAt: serverTimestamp(),
      }),
    ),
  );
  await check("an old client's Date.now() submittedAt is still accepted (deploy-order safety)", () =>
    allowed(
      set(ref(mafia2.db, `rooms/${R7}/rounds/1/nightActions/${mafia2.uid}`), {
        role: "Mafia", action: "kill", targetUid: a.uid, submittedAt: Date.now(),
      }),
    ),
  );
  await check("a teammate Mafia can read the other Mafia's kill pick", () =>
    allowed(get(ref(mafia2.db, `rooms/${R7}/rounds/1/nightActions/${mafia.uid}`))),
  );
  await check("a non-Mafia is denied reading a Mafia's kill pick", () =>
    denied(get(ref(c.db, `rooms/${R7}/rounds/1/nightActions/${mafia.uid}`))),
  );
  await check("a dead player cannot submit a night action", () =>
    denied(
      set(ref(dead.db, `rooms/${R7}/rounds/1/nightActions/${dead.uid}`), {
        role: "Civilian", action: "kill", targetUid: a.uid, submittedAt: 1,
      }),
    ),
  );
  await check("a player cannot write another player's night action", () =>
    denied(
      set(ref(a.db, `rooms/${R7}/rounds/1/nightActions/${b.uid}`), {
        role: "Granny", action: "protect", targetUid: a.uid, submittedAt: 1,
      }),
    ),
  );
  await check("an unknown action kind is still rejected", () =>
    denied(
      set(ref(a.db, `rooms/${R7}/rounds/1/nightActions/${a.uid}`), {
        role: "Civilian", action: "poison", targetUid: b.uid, submittedAt: 1,
      }),
    ),
  );
  await check("a player can read only their OWN private role", () =>
    allowed(get(ref(c.db, `rooms/${R7}/privateRoles/${c.uid}`))),
  );
  await check("a player is denied reading another player's private role", () =>
    denied(get(ref(c.db, `rooms/${R7}/privateRoles/${b.uid}`))),
  );
  await check("a player is denied reading the whole privateRoles node", () =>
    denied(get(ref(a.db, `rooms/${R7}/privateRoles`))),
  );
  await check("moderator can read privateRoles (resolver)", () =>
    allowed(get(ref(mod.db, `rooms/${R7}/privateRoles`))),
  );
  await check("moderator can read all night actions (resolver)", () =>
    allowed(get(ref(mod.db, `rooms/${R7}/rounds/1/nightActions`))),
  );
  await check("players cannot read the whole nightActions node", () =>
    denied(get(ref(a.db, `rooms/${R7}/rounds/1/nightActions`))),
  );
  await check("a vote is denied during the night", () =>
    denied(set(ref(a.db, `rooms/${R7}/rounds/1/votes/${a.uid}`), { targetUid: c.uid, votedAt: 1 })),
  );
  await check("a player cannot flip their own alive flag", () =>
    denied(set(ref(dead.db, `rooms/${R7}/players/${dead.uid}/alive`), true)),
  );
  await check("publicRoles cannot be written before the game ends", () =>
    denied(set(ref(mod.db, `rooms/${R7}/publicRoles`), { [a.uid]: "Civilian" })),
  );

  console.log("\n== Regression: 2c chats ==");
  await check("a living Mafia can post to mafiaChat at night", () =>
    allowed(
      set(ref(mafia.db, `rooms/${R7}/mafiaChat/m1`), { uid: mafia.uid, name: "M", text: "hi", ts: 1 }),
    ),
  );
  await check("Cupid (non-Mafia) is denied reading mafiaChat", () =>
    denied(get(ref(cupid.db, `rooms/${R7}/mafiaChat`))),
  );
  await check("the Jester is denied reading mafiaChat", () =>
    denied(get(ref(c.db, `rooms/${R7}/mafiaChat`))),
  );
  await check("the moderator is denied reading mafiaChat", () =>
    denied(get(ref(mod.db, `rooms/${R7}/mafiaChat`))),
  );
  await check("dayChat post is denied at night", () =>
    denied(set(ref(a.db, `rooms/${R7}/dayChat/d1`), { uid: a.uid, name: "A", text: "hi", ts: 1 })),
  );

  const after = await adminGet(`rooms/${R1}/lovers`);
  await check("(sanity) R1 lovers really are gone after the moderator clear", () => after === null);

  summary();
  process.exit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
