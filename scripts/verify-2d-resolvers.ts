// Slice 2d end-to-end resolver verification (tasks-2d task 4) against the emulator,
// calling the REAL exported functions: submitCupidLink, submitNightAction, beginNight1,
// resolveNightOnClient, resolveDayOnClient, resetForPlayAgain.
// EMULATOR ONLY. Run:  npx tsx scripts/verify-2d-resolvers.ts
//
// The app's lib/firebase.ts singleton is pointed at the emulator via env vars set BEFORE
// it is imported. That singleton is one signed-in identity at a time, so `become()` signs
// it out and back in (a new anonymous uid) whenever a scenario needs the real function to
// run as the moderator or as a specific player. Other players act through their own
// signed-in clients (scripts/emulator.ts), always through the Security Rules.

import { get, ref, serverTimestamp, set } from "firebase/database";
import { signInAnonymously, signOut } from "firebase/auth";
import {
  adminGet,
  adminPut,
  check,
  DB_NAMESPACE,
  freshCode,
  PROJECT_ID,
  signedInClient,
  summary,
  type Client,
} from "./emulator";

process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = "true";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = PROJECT_ID;
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = `http://127.0.0.1:9000?ns=${DB_NAMESPACE}`;

// Loaded inside main(), after the env vars above are set (lib/firebase reads them on load).
let app: {
  firebase: typeof import("../lib/firebase");
  submitCupidLink: typeof import("../lib/game/submitCupidLink").submitCupidLink;
  submitNightAction: typeof import("../lib/game/submitNightAction").submitNightAction;
  beginNight1: typeof import("../lib/game/beginNight1").beginNight1;
  resolveNightOnClient: typeof import("../lib/game/resolveNightOnClient").resolveNightOnClient;
  resolveDayOnClient: typeof import("../lib/game/resolveDayOnClient").resolveDayOnClient;
  resetForPlayAgain: typeof import("../lib/room/resetForPlayAgain").resetForPlayAgain;
  config: typeof import("../lib/room/config");
};

async function loadApp() {
  app = {
    firebase: await import("../lib/firebase"),
    submitCupidLink: (await import("../lib/game/submitCupidLink")).submitCupidLink,
    submitNightAction: (await import("../lib/game/submitNightAction")).submitNightAction,
    beginNight1: (await import("../lib/game/beginNight1")).beginNight1,
    resolveNightOnClient: (await import("../lib/game/resolveNightOnClient")).resolveNightOnClient,
    resolveDayOnClient: (await import("../lib/game/resolveDayOnClient")).resolveDayOnClient,
    resetForPlayAgain: (await import("../lib/room/resetForPlayAgain")).resetForPlayAgain,
    config: await import("../lib/room/config"),
  };
}

/** Re-sign the app singleton in as a brand-new anonymous identity; returns its uid. */
async function become(): Promise<string> {
  const { auth } = app.firebase;
  if (auth.currentUser) await signOut(auth);
  return (await signInAnonymously(auth)).user.uid;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Seed a dealt room: roster (all alive unless dead), private roles, optional game. */
async function seed(
  code: string,
  moderatorId: string,
  cast: Record<string, string>, // uid -> role
  game: { phase: string; round: number } | null,
  dead: string[] = [],
) {
  const players: Record<string, unknown> = {};
  const privateRoles: Record<string, unknown> = {};
  Object.entries(cast).forEach(([uid, role], i) => {
    players[uid] = { name: `${role}-${i}`, joinedAt: i, connected: true, lastSeen: 0, alive: !dead.includes(uid), viewed: true };
    privateRoles[uid] = { role };
  });
  await adminPut(`rooms/${code}`, {
    meta: { moderatorId, status: "in_game", createdAt: 0, lastActivity: 0 },
    players,
    privateRoles,
    ...(game ? { game } : {}),
  });
}

const alive = async (code: string, uid: string) => (await adminGet(`rooms/${code}/players/${uid}/alive`)) as boolean;
const keys = (v: unknown) => Object.keys((v ?? {}) as object).sort();
const same = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

async function killAs(c: Client, code: string, round: number, target: string) {
  await set(ref(c.db, `rooms/${code}/rounds/${round}/nightActions/${c.uid}`), {
    role: "Mafia", action: "kill", targetUid: target, submittedAt: serverTimestamp(),
  });
}

async function main() {
  await loadApp();
  const pool = await Promise.all(Array.from({ length: 8 }, () => signedInClient()));
  const [m1, m2, doc, civA, civB, civC, gran, jes] = pool;

  // ---------------------------------------------------------------------------------
  console.log("\n== S1: Cupid links (real submitCupidLink) → Mafia kills a lover on Night 1 ==");
  {
    const code = freshCode();
    const cupidUid = await become();
    await seed(code, "placeholder", {
      [cupidUid]: "Cupid", [m1.uid]: "Mafia", [civA.uid]: "Civilian", [civB.uid]: "Civilian",
      [doc.uid]: "Doctor", [civC.uid]: "Civilian",
    }, { phase: "night", round: 1 });
    await check("real submitCupidLink succeeds for a living Night-1 Cupid", async () => {
      await app.submitCupidLink(code, cupidUid, civA.uid, civB.uid);
      return true;
    });
    await check("lover A privately sees partner B", async () =>
      keys((await get(ref(civA.db, `rooms/${code}/lovers/${civA.uid}`))).val()).join() === civB.uid,
    );
    await check("real submitCupidLink a second time is rejected (link is final)", async () => {
      try { await app.submitCupidLink(code, cupidUid, civA.uid, civC.uid); return false; } catch { return true; }
    });

    await killAs(m1, code, 1, civA.uid);
    const modUid = await become();
    await adminPut(`rooms/${code}/meta/moderatorId`, modUid);
    await app.resolveNightOnClient(code, 1);

    await check("both lovers are dead after one resolve", async () => !(await alive(code, civA.uid)) && !(await alive(code, civB.uid)));
    const outcome = (await adminGet(`rooms/${code}/rounds/1/nightOutcome`)) as Record<string, unknown>;
    await check("night outcome lists both deaths, with no single eliminatedUid for 2 deaths",
      () => same(keys(outcome.eliminatedUids), [civA.uid, civB.uid]) && outcome.eliminatedUid === undefined);
    await check("outcome carries no role/cause fields", () => same(Object.keys(outcome), ["eliminatedUids", "resolvedAt"]));
    await check("game advances to day (no win yet)", async () => (await adminGet(`rooms/${code}/game/phase`)) === "day");
    await check("the moderator's device still cannot read the lovers node", async () => {
      try { await get(ref(app.firebase.db, `rooms/${code}/lovers`)); return false; } catch { return true; }
    });
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S2: Doctor saves a lover ==");
  {
    const code = freshCode();
    const modUid = await become();
    await seed(code, modUid, { [m1.uid]: "Mafia", [doc.uid]: "Doctor", [civA.uid]: "Civilian", [civB.uid]: "Civilian", [civC.uid]: "Civilian", [m2.uid]: "Cupid" },
      { phase: "night", round: 1 });
    await adminPut(`rooms/${code}/rounds/1/nightActions/${m2.uid}`, { role: "Cupid", action: "link", targetUid: civA.uid, secondTargetUid: civB.uid, submittedAt: 1 });
    await killAs(m1, code, 1, civA.uid);
    await set(ref(doc.db, `rooms/${code}/rounds/1/nightActions/${doc.uid}`), { role: "Doctor", action: "protect", targetUid: civA.uid, submittedAt: serverTimestamp() });
    await app.resolveNightOnClient(code, 1);
    await check("saved lover and partner both alive", async () => (await alive(code, civA.uid)) && (await alive(code, civB.uid)));
    const outcome = (await adminGet(`rooms/${code}/rounds/1/nightOutcome`)) as Record<string, unknown>;
    await check("outcome says no one died", () => outcome.eliminatedUids === undefined && outcome.eliminatedUid === undefined);
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S3: Granny (real submitNightAction) — first Mafia dies, and his lover too ==");
  {
    const code = freshCode();
    const firstMafiaUid = await become();
    const cast = { [firstMafiaUid]: "Mafia", [m2.uid]: "Mafia", [gran.uid]: "Granny", [civA.uid]: "Civilian",
      [civB.uid]: "Civilian", [civC.uid]: "Civilian", [doc.uid]: "Cupid", [jes.uid]: "Civilian" };
    await seed(code, "placeholder", cast, { phase: "night", round: 2 });
    // Round-1 Cupid link: the first Mafia is in love with civA.
    await adminPut(`rooms/${code}/rounds/1/nightActions/${doc.uid}`, { role: "Cupid", action: "link", targetUid: firstMafiaUid, secondTargetUid: civA.uid, submittedAt: 1 });
    await app.submitNightAction(code, 2, firstMafiaUid, "Mafia", "kill", gran.uid);
    await pause(30);
    await killAs(m2, code, 2, gran.uid);
    const t1 = (await adminGet(`rooms/${code}/rounds/2/nightActions/${firstMafiaUid}/submittedAt`)) as number;
    const t2 = (await adminGet(`rooms/${code}/rounds/2/nightActions/${m2.uid}/submittedAt`)) as number;
    await check("submittedAt is a server timestamp (number, ordered)", () => typeof t1 === "number" && t1 < t2);

    const modUid = await become();
    await adminPut(`rooms/${code}/meta/moderatorId`, modUid);
    await app.resolveNightOnClient(code, 2);
    const outcome = (await adminGet(`rooms/${code}/rounds/2/nightOutcome`)) as Record<string, unknown>;
    await check("Granny + first Mafia + that Mafia's lover all die in one write",
      () => same(keys(outcome.eliminatedUids), [gran.uid, firstMafiaUid, civA.uid]));
    await check("the later Mafia survives", async () => await alive(code, m2.uid));
    await check("1 Mafia vs 4 others → game continues to day", async () => (await adminGet(`rooms/${code}/game/phase`)) === "day");
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S4: Granny — a Mafia who CHANGES away and back loses 'first' ==");
  {
    const code = freshCode();
    const modUid = await become();
    await seed(code, modUid, { [m1.uid]: "Mafia", [m2.uid]: "Mafia", [gran.uid]: "Granny", [civA.uid]: "Civilian", [civB.uid]: "Civilian", [civC.uid]: "Civilian" },
      { phase: "night", round: 1 });
    await killAs(m1, code, 1, gran.uid);
    await pause(30);
    await killAs(m2, code, 1, gran.uid);
    await pause(30);
    await killAs(m1, code, 1, civA.uid); // m1 switches away…
    await pause(30);
    await killAs(m1, code, 1, gran.uid); // …and back: re-saved, now later than m2
    await app.resolveNightOnClient(code, 1);
    const outcome = (await adminGet(`rooms/${code}/rounds/1/nightOutcome`)) as Record<string, unknown>;
    await check("m2 (unchanged, earlier final pick) dies with Granny; m1 lives",
      () => same(keys(outcome.eliminatedUids), [gran.uid, m2.uid]));
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S5: Solo Mafia kills Granny → Town wins that night ==");
  {
    const code = freshCode();
    const modUid = await become();
    await seed(code, modUid, { [m1.uid]: "Mafia", [gran.uid]: "Granny", [civA.uid]: "Civilian", [civB.uid]: "Civilian" }, { phase: "night", round: 1 });
    await killAs(m1, code, 1, gran.uid);
    await app.resolveNightOnClient(code, 1);
    await check("winner is town", async () => (await adminGet(`rooms/${code}/game/winner`)) === "town");
    await check("game ended", async () => (await adminGet(`rooms/${code}/game/phase`)) === "ended");
    await check("publicRoles written after end", async () => (await adminGet(`rooms/${code}/publicRoles/${gran.uid}`)) === "Granny");
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S6: Jester voted out while his lover is the last Mafia → Jester wins ==");
  {
    const code = freshCode();
    const modUid = await become();
    await seed(code, modUid, { [m1.uid]: "Mafia", [jes.uid]: "Jester", [civA.uid]: "Civilian", [civB.uid]: "Civilian", [doc.uid]: "Cupid" },
      { phase: "day", round: 2 });
    await adminPut(`rooms/${code}/rounds/1/nightActions/${doc.uid}`, { role: "Cupid", action: "link", targetUid: jes.uid, secondTargetUid: m1.uid, submittedAt: 1 });
    for (const v of [civA, civB, doc]) {
      await set(ref(v.db, `rooms/${code}/rounds/2/votes/${v.uid}`), { targetUid: jes.uid, votedAt: Date.now() });
    }
    await app.resolveDayOnClient(code, 2);
    const outcome = (await adminGet(`rooms/${code}/rounds/2/dayOutcome`)) as Record<string, unknown>;
    await check("day outcome: Jester voted out, lover Mafia also died",
      () => outcome.eliminatedUid === jes.uid && same(keys(outcome.eliminatedUids), [jes.uid, m1.uid]));
    await check("winner is jester (overrides the Town win)", async () => (await adminGet(`rooms/${code}/game/winner`)) === "jester");
    await check("roles revealed as usual", async () => (await adminGet(`rooms/${code}/publicRoles/${jes.uid}`)) === "Jester");
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S7: Jester voted out with only 3 players left ==");
  {
    const code = freshCode();
    const modUid = await become();
    await seed(code, modUid, { [m1.uid]: "Mafia", [jes.uid]: "Jester", [civA.uid]: "Civilian", [civB.uid]: "Civilian" },
      { phase: "day", round: 3 }, [civB.uid]);
    await set(ref(m1.db, `rooms/${code}/rounds/3/votes/${m1.uid}`), { targetUid: jes.uid, votedAt: 1 });
    await set(ref(civA.db, `rooms/${code}/rounds/3/votes/${civA.uid}`), { targetUid: jes.uid, votedAt: 1 });
    await app.resolveDayOnClient(code, 3);
    await check("Jester wins (not Mafia parity)", async () => (await adminGet(`rooms/${code}/game/winner`)) === "jester");
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S8: Day vote kills a lover → partner dies → Mafia parity ==");
  {
    const code = freshCode();
    const modUid = await become();
    await seed(code, modUid, { [m1.uid]: "Mafia", [civA.uid]: "Civilian", [civB.uid]: "Civilian", [civC.uid]: "Cupid" },
      { phase: "day", round: 1 });
    await adminPut(`rooms/${code}/rounds/1/nightActions/${civC.uid}`, { role: "Cupid", action: "link", targetUid: civA.uid, secondTargetUid: civB.uid, submittedAt: 1 });
    for (const v of [m1, civB, civC]) {
      await set(ref(v.db, `rooms/${code}/rounds/1/votes/${v.uid}`), { targetUid: civA.uid, votedAt: 1 });
    }
    await app.resolveDayOnClient(code, 1);
    await check("both lovers dead", async () => !(await alive(code, civA.uid)) && !(await alive(code, civB.uid)));
    await check("win check ran after BOTH deaths: Mafia (1) >= Town (1) → mafia", async () => (await adminGet(`rooms/${code}/game/winner`)) === "mafia");
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S9: 2b regressions through the real resolvers ==");
  {
    const code = freshCode();
    const modUid = await become();
    const cast = { [m1.uid]: "Mafia", [m2.uid]: "Mafia", [doc.uid]: "Doctor", [civA.uid]: "Civilian", [civB.uid]: "Civilian", [civC.uid]: "Civilian", [jes.uid]: "Detective" };
    await seed(code, modUid, cast, null);
    await check("real beginNight1 still starts the game", async () => {
      await app.beginNight1(code, Object.keys(cast));
      return (await adminGet(`rooms/${code}/game/phase`)) === "night";
    });
    await killAs(m1, code, 1, civA.uid);
    await killAs(m2, code, 1, civB.uid);
    await set(ref(jes.db, `rooms/${code}/rounds/1/nightActions/${jes.uid}`), { role: "Detective", action: "investigate", targetUid: m1.uid, submittedAt: serverTimestamp() });
    await app.resolveNightOnClient(code, 1);
    await check("Mafia disagreement → no one dies", async () => (await adminGet(`rooms/${code}/rounds/1/nightOutcome/eliminatedUids`)) === null);
    await check("Detective still gets a private 'mafia' result", async () =>
      (await get(ref(jes.db, `rooms/${code}/rounds/1/nightResults/${jes.uid}`))).val()?.result === "mafia");
    await check("the Detective's result is private from others", async () => {
      try { await get(ref(civA.db, `rooms/${code}/rounds/1/nightResults/${jes.uid}`)); return false; } catch { return true; }
    });

    await set(ref(civA.db, `rooms/${code}/rounds/1/votes/${civA.uid}`), { targetUid: civB.uid, votedAt: 1 });
    await set(ref(civB.db, `rooms/${code}/rounds/1/votes/${civB.uid}`), { targetUid: civA.uid, votedAt: 1 });
    await app.resolveDayOnClient(code, 1);
    await check("day tie → no one eliminated, next night begins", async () =>
      (await adminGet(`rooms/${code}/rounds/1/dayOutcome/eliminatedUid`)) === null &&
      (await adminGet(`rooms/${code}/game/round`)) === 2);

    await killAs(m1, code, 2, civC.uid);
    await killAs(m2, code, 2, civC.uid);
    await app.resolveNightOnClient(code, 2);
    const outcome = (await adminGet(`rooms/${code}/rounds/2/nightOutcome`)) as Record<string, unknown>;
    await check("unanimous kill → single death, with the eliminatedUid fallback written",
      () => outcome.eliminatedUid === civC.uid && same(keys(outcome.eliminatedUids), [civC.uid]));
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S10: Cupid picks nobody → night resolves normally ==");
  {
    const code = freshCode();
    const modUid = await become();
    await seed(code, modUid, { [m1.uid]: "Mafia", [civA.uid]: "Cupid", [civB.uid]: "Civilian", [civC.uid]: "Civilian" }, { phase: "night", round: 1 });
    await killAs(m1, code, 1, civB.uid);
    await app.resolveNightOnClient(code, 1);
    await check("only the Mafia's target dies", async () =>
      same(keys(await adminGet(`rooms/${code}/rounds/1/nightOutcome/eliminatedUids`)), [civB.uid]));
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S11: Play Again clears lovers ==");
  {
    const code = freshCode();
    const modUid = await become();
    await seed(code, modUid, { [m1.uid]: "Mafia", [civA.uid]: "Civilian", [civB.uid]: "Civilian", [civC.uid]: "Cupid" }, { phase: "ended", round: 2 });
    await adminPut(`rooms/${code}/lovers`, { [civA.uid]: { [civB.uid]: true }, [civB.uid]: { [civA.uid]: true } });
    await adminPut(`rooms/${code}/rounds/1/nightActions/${civC.uid}`, { role: "Cupid", action: "link", targetUid: civA.uid, secondTargetUid: civB.uid, submittedAt: 1 });
    await app.resetForPlayAgain(code, [m1.uid, civA.uid, civB.uid, civC.uid]);
    await check("lovers cleared", async () => (await adminGet(`rooms/${code}/lovers`)) === null);
    await check("rounds (incl. Cupid's link) cleared", async () => (await adminGet(`rooms/${code}/rounds`)) === null);
    await check("room back in the lobby", async () => (await adminGet(`rooms/${code}/meta/status`)) === "lobby");
    await check("a second reset still succeeds", async () => {
      await app.resetForPlayAgain(code, [m1.uid, civA.uid, civB.uid, civC.uid]);
      return true;
    });
  }

  // ---------------------------------------------------------------------------------
  console.log("\n== S12: role config seed + backfill (real lib/room/config) ==");
  {
    const code = freshCode();
    const modUid = await become();
    await adminPut(`rooms/${code}/meta`, { moderatorId: modUid, status: "lobby", createdAt: 0, lastActivity: 0 });
    await app.config.seedDefaultRoles(code);
    const seeded = (await adminGet(`rooms/${code}/config/roles`)) as Record<string, { name: string; count: number; cap: number; isStandard: boolean }>;
    await check("a new room seeds 7 built-in roles", () => same(Object.keys(seeded), ["mafia", "detective", "doctor", "civilian", "jester", "cupid", "granny"]));
    await check("Jester/Cupid/Granny start at count 0, cap 20, non-removable", () =>
      ["jester", "cupid", "granny"].every((id) => seeded[id].count === 0 && seeded[id].cap === 20 && seeded[id].isStandard));
    await check("the standard four keep their Phase 1 defaults (1/1/1/7)", () =>
      seeded.mafia.count === 1 && seeded.detective.count === 1 && seeded.doctor.count === 1 && seeded.civilian.count === 7);

    // A pre-2d room: only the standard four, with the moderator's own counts.
    const old = freshCode();
    await adminPut(`rooms/${old}/meta`, { moderatorId: modUid, status: "lobby", createdAt: 0, lastActivity: 0 });
    await adminPut(`rooms/${old}/config/roles`, {
      mafia: { id: "mafia", name: "Mafia", count: 2, cap: 20, isStandard: true },
      civilian: { id: "civilian", name: "Civilian", count: 4, cap: 100, isStandard: true },
    });
    await app.config.addMissingBuiltInRoles(old, ["mafia", "civilian"]);
    const backfilled = (await adminGet(`rooms/${old}/config/roles`)) as Record<string, { count: number }>;
    await check("a pre-2d room gets the missing rows at 0", () =>
      backfilled.jester?.count === 0 && backfilled.cupid?.count === 0 && backfilled.granny?.count === 0 && backfilled.doctor?.count === 0);
    await check("...without touching the moderator's existing counts", () => backfilled.mafia.count === 2 && backfilled.civilian.count === 4);
  }

  summary();
  process.exit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
