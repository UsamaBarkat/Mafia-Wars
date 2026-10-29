// Game-scenario verification: the owner's named Jester / Cupid / Granny scenarios, run
// through the REAL resolveNight, resolveDay, checkWin and lovers.ts (loverPairs +
// withLinkedDeaths, which resolveNight/resolveDay call). No Firebase, no emulator needed.
// Run:  npm run test:scenarios   (or  npx tsx scripts/verify-scenarios.ts)
//
// resolveNightOnClient / resolveDayOnClient are bound to Firebase, so `night()` and `day()`
// below repeat their few lines of glue exactly: lover pairs from round 1's Cupid action,
// keep only deaths of players who are still alive, then checkWin on the roster AFTER every
// death. Each scenario prints PASS or FAIL with the expected and actual result.

import { checkWin } from "../lib/game/checkWin";
import { loverPairs } from "../lib/game/lovers";
import { resolveDay } from "../lib/game/resolveDay";
import { resolveNight } from "../lib/game/resolveNight";
import type { NightAction, Vote, WinnerTeam } from "../lib/room/types";

let passed = 0;
let failed = 0;
function check(name: string, expected: unknown, actual: unknown) {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  console.log(`        expected: ${JSON.stringify(expected)}`);
  console.log(`        actual:   ${JSON.stringify(actual)}`);
}

const kill = (targetUid: string, submittedAt: number): NightAction => ({ role: "Mafia", action: "kill", targetUid, submittedAt });
const protect = (targetUid: string): NightAction => ({ role: "Doctor", action: "protect", targetUid, submittedAt: 0 });
const link = (a: string, b: string): NightAction => ({ role: "Cupid", action: "link", targetUid: a, secondTargetUid: b, submittedAt: 0 });
const votesFor = (map: Record<string, string>): Record<string, Vote> =>
  Object.fromEntries(Object.entries(map).map(([voter, t]) => [voter, { targetUid: t, votedAt: 0 }]));

// The standard cast: m1/m2 Mafia, doc Doctor, det Detective, cup Cupid, gran Granny,
// jes Jester, civ1/civ2 Civilians. 2 Mafia vs 7 others.
const CAST: Record<string, string> = {
  m1: "Mafia", m2: "Mafia", doc: "Doctor", det: "Detective", cup: "Cupid",
  gran: "Granny", jes: "Jester", civ1: "Civilian", civ2: "Civilian",
};

type Game = {
  roles: Record<string, string>;
  alive: Set<string>;
  round1Actions: Record<string, NightAction>; // where Cupid's link lives
};

type Phase = {
  deaths: string[]; // sorted
  winner: WinnerTeam | null;
  aliveBefore: string[];
  aliveRolesChecked: string[]; // exactly what checkWin was given
};

function newGame(opts: { roles?: Record<string, string>; lovers?: [string, string]; dead?: string[] } = {}): Game {
  const roles = opts.roles ?? CAST;
  const round1Actions: Record<string, NightAction> = opts.lovers ? { cup: link(...opts.lovers) } : {};
  const alive = new Set(Object.keys(roles).filter((uid) => !opts.dead?.includes(uid)));
  return { roles, alive, round1Actions };
}

/** Apply one phase's resolved deaths and run the win check — same glue as *OnClient. */
function finish(game: Game, eliminatedUids: string[], jesterDiedByDay: boolean): Phase {
  const aliveBefore = [...game.alive].sort();
  const deaths = eliminatedUids.filter((uid) => game.alive.has(uid));
  for (const uid of deaths) game.alive.delete(uid);
  const aliveRolesChecked = [...game.alive].sort().map((uid) => game.roles[uid]);
  const winner = checkWin(aliveRolesChecked, jesterDiedByDay);
  return { deaths: [...deaths].sort(), winner, aliveBefore, aliveRolesChecked };
}

function night(game: Game, actions: Record<string, NightAction>): Phase {
  // Every night reads round 1's actions for the pairs, as resolveNightOnClient does.
  const pairs = loverPairs(game.round1Actions, game.roles);
  const { eliminatedUids } = resolveNight(actions, game.roles, pairs);
  return finish(game, eliminatedUids, false);
}

function day(game: Game, votes: Record<string, string>): Phase {
  const pairs = loverPairs(game.round1Actions, game.roles);
  const { eliminatedUids, jesterDiedByDay } = resolveDay(votesFor(votes), game.roles, pairs);
  return finish(game, eliminatedUids, jesterDiedByDay);
}

/** Everyone votes for `target` (target votes Skip). */
function allVote(game: Game, target: string): Record<string, string> {
  return Object.fromEntries([...game.alive].map((uid) => [uid, uid === target ? "skip" : target]));
}

/**
 * Scenario 12 — run after EVERY phase: the win check saw exactly the final living players,
 * nobody died twice, and nobody already dead was reported as dying again.
 */
function invariants(label: string, game: Game, p: Phase) {
  const finalLiving = p.aliveBefore.filter((uid) => !p.deaths.includes(uid));
  check(`12 · ${label}: win check ran on the final living players; nothing died twice`,
    {
      uniqueDeaths: true,
      deadWereAlive: true,
      rolesGivenToCheckWin: finalLiving.map((uid) => game.roles[uid]),
    },
    {
      uniqueDeaths: new Set(p.deaths).size === p.deaths.length,
      deadWereAlive: p.deaths.every((uid) => p.aliveBefore.includes(uid)),
      rolesGivenToCheckWin: p.aliveRolesChecked,
    });
}

function scenario(label: string, run: () => void) {
  console.log(`\n== ${label} ==`);
  run();
}

scenario("1. The town votes out the Jester", () => {
  const g = newGame();
  const p = day(g, allVote(g, "jes"));
  check("1 · Jester voted out: winner is jester, game ends", { deaths: ["jes"], winner: "jester" }, { deaths: p.deaths, winner: p.winner });
  invariants("1", g, p);
});

scenario("2. Two Mafia agree on Granny, no Doctor protect", () => {
  const g = newGame();
  const p = night(g, { m1: kill("gran", 100), m2: kill("gran", 200) });
  check("2 · only the earliest picker (m1) dies; Granny and m2 live",
    { deaths: ["m1"], granAlive: true, m2Alive: true, winner: null },
    { deaths: p.deaths, granAlive: g.alive.has("gran"), m2Alive: g.alive.has("m2"), winner: p.winner });
  invariants("2", g, p);
});

scenario("3. Two Mafia agree on Granny, Doctor protects the first picker", () => {
  const g = newGame();
  const p = night(g, { m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("m1") });
  check("3 · m1 lives, Granny dies",
    { deaths: ["gran"], m1Alive: true, winner: null },
    { deaths: p.deaths, m1Alive: g.alive.has("m1"), winner: p.winner });
  invariants("3", g, p);
});

scenario("4. Cupid's lovers: one is voted out by day", () => {
  const g = newGame({ lovers: ["civ1", "civ2"] });
  const p = day(g, allVote(g, "civ1"));
  check("4 · both lovers are eliminated together", { deaths: ["civ1", "civ2"], winner: null }, { deaths: p.deaths, winner: p.winner });
  invariants("4", g, p);
});

scenario("5. Cupid's lovers: one is killed at night", () => {
  const g = newGame({ lovers: ["civ1", "civ2"] });
  const p = night(g, { m1: kill("civ1", 100), m2: kill("civ1", 200) });
  check("5 · both lovers die together", { deaths: ["civ1", "civ2"], winner: null }, { deaths: p.deaths, winner: p.winner });
  invariants("5", g, p);
});

scenario("6. The Jester is a lover", () => {
  {
    const g = newGame({ lovers: ["jes", "civ1"] });
    const p = day(g, allVote(g, "jes"));
    check("6a · Jester voted out directly: Jester wins (partner dies too)",
      { deaths: ["civ1", "jes"], winner: "jester" }, { deaths: p.deaths, winner: p.winner });
    invariants("6a", g, p);
  }
  {
    // spec-2d D16: dying with a voted-out lover is a Jester win.
    const g = newGame({ lovers: ["jes", "civ1"] });
    const p = day(g, allVote(g, "civ1"));
    check("6b · partner voted out, Jester dies of heartbreak by day: Jester wins",
      { deaths: ["civ1", "jes"], winner: "jester" }, { deaths: p.deaths, winner: p.winner });
    invariants("6b", g, p);
  }
  {
    const g = newGame({ lovers: ["jes", "civ1"] });
    const p = night(g, { m1: kill("civ1", 100), m2: kill("civ1", 200) });
    check("6c · partner killed at night, Jester dies of heartbreak: no win, game continues",
      { deaths: ["civ1", "jes"], winner: null }, { deaths: p.deaths, winner: p.winner });
    invariants("6c", g, p);
  }
  {
    // 2 Mafia vs Cupid + Jester + Civilian. Voting out the Civilian also kills the Jester,
    // leaving 2 Mafia vs Cupid: Mafia parity — but the Jester win takes priority (FR-4).
    const g = newGame({
      roles: { m1: "Mafia", m2: "Mafia", cup: "Cupid", jes: "Jester", civ1: "Civilian" },
      lovers: ["jes", "civ1"],
    });
    const p = day(g, allVote(g, "civ1"));
    check("6d · Jester heartbreak by day while the Mafia reach parity: Jester wins",
      { deaths: ["civ1", "jes"], winnerWithoutJester: "mafia", winner: "jester" },
      { deaths: p.deaths, winnerWithoutJester: checkWin(p.aliveRolesChecked), winner: p.winner });
    invariants("6d", g, p);
  }
});

scenario("7. Granny is a lover and dies because the Doctor saved the Mafia picker", () => {
  const g = newGame({ lovers: ["gran", "civ1"] });
  const p = night(g, { m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("m1") });
  check("7 · Granny and her partner both die; m1 lives",
    { deaths: ["civ1", "gran"], m1Alive: true, winner: null },
    { deaths: p.deaths, m1Alive: g.alive.has("m1"), winner: p.winner });
  invariants("7", g, p);
});

scenario("8. Granny is a lover and the Mafia target her", () => {
  {
    const g = newGame({ lovers: ["gran", "civ1"] });
    const p = night(g, { m1: kill("gran", 100), m2: kill("gran", 200) });
    check("8a · first picker m1 dies; Granny and her partner live",
      { deaths: ["m1"], granAlive: true, partnerAlive: true, winner: null },
      { deaths: p.deaths, granAlive: g.alive.has("gran"), partnerAlive: g.alive.has("civ1"), winner: p.winner });
    invariants("8a", g, p);
  }
  {
    const g = newGame({ lovers: ["gran", "m1"] });
    const p = night(g, { m1: kill("gran", 100), m2: kill("gran", 200) });
    check("8b · the dying Mafia (m1) is Granny's lover: she dies as his partner",
      { deaths: ["gran", "m1"], m2Alive: true, winner: null },
      { deaths: p.deaths, m2Alive: g.alive.has("m2"), winner: p.winner });
    invariants("8b", g, p);
  }
});

scenario("9. The Mafia disagree", () => {
  for (const [label, actions] of [
    ["9a · m1 picks Granny, m2 picks civ1", { m1: kill("gran", 100), m2: kill("civ1", 200) }],
    ["9b · m1 picks civ1, m2 picks Granny", { m1: kill("civ1", 100), m2: kill("gran", 200) }],
  ] as const) {
    const g = newGame();
    const p = night(g, actions);
    check(`${label}: nobody dies`, { deaths: [], winner: null }, { deaths: p.deaths, winner: p.winner });
    invariants(label.slice(0, 2), g, p);
  }
});

scenario("10. Granny is voted out by day", () => {
  const g = newGame();
  const p = day(g, allVote(g, "gran"));
  check("10 · only Granny dies; no Mafia dies",
    { deaths: ["gran"], m1Alive: true, m2Alive: true, winner: null },
    { deaths: p.deaths, m1Alive: g.alive.has("m1"), m2Alive: g.alive.has("m2"), winner: p.winner });
  invariants("10", g, p);
});

scenario("11. The Doctor protects Granny while the Mafia target her", () => {
  const g = newGame();
  const p = night(g, { m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("gran") });
  check("11 · first picker m1 still dies; Granny lives",
    { deaths: ["m1"], granAlive: true, winner: null },
    { deaths: p.deaths, granAlive: g.alive.has("gran"), winner: p.winner });
  invariants("11", g, p);
});

scenario("12. Win check on the final roster; nothing dies twice", () => {
  {
    // Only the lover's heartbreak death brings the Mafia to parity.
    const g = newGame({ roles: { m1: "Mafia", cup: "Cupid", civ1: "Civilian", civ2: "Civilian" }, lovers: ["civ1", "civ2"] });
    const p = day(g, allVote(g, "civ1"));
    check("12a · a lover's death counts before the win check (Mafia reach parity)",
      { deaths: ["civ1", "civ2"], winner: "mafia" }, { deaths: p.deaths, winner: p.winner });
    invariants("12a", g, p);
  }
  {
    // Granny's retaliation kills the last Mafia.
    const g = newGame({ roles: { m1: "Mafia", gran: "Granny", civ1: "Civilian", civ2: "Civilian" } });
    const p = night(g, { m1: kill("gran", 100) });
    check("12b · Granny's retaliation on the last Mafia counts before the win check (Town wins)",
      { deaths: ["m1"], winner: "town" }, { deaths: p.deaths, winner: p.winner });
    invariants("12b", g, p);
  }
  {
    // A lover whose partner is already dead: the dead partner is not killed again.
    const g = newGame({ lovers: ["civ1", "civ2"], dead: ["civ2"] });
    const p = night(g, { m1: kill("civ1", 100) });
    check("12c · partner already dead is not reported as dying again",
      { deaths: ["civ1"] }, { deaths: p.deaths });
    invariants("12c", g, p);
  }
  {
    // A whole game: lovers die at night, then Granny is voted out — no uid dies twice.
    const g = newGame({ lovers: ["civ1", "civ2"] });
    const n1 = night(g, { m1: kill("civ1", 100), m2: kill("civ1", 200) });
    const d1 = day(g, allVote(g, "gran"));
    const n2 = night(g, { m1: kill("civ1", 100) }); // a stale pick on a dead lover
    const all = [...n1.deaths, ...d1.deaths, ...n2.deaths];
    check("12d · across Night 1, Day 1, Night 2 no uid dies twice",
      { allDeaths: ["civ1", "civ2", "gran"], unique: true },
      { allDeaths: all, unique: new Set(all).size === all.length });
    invariants("12d night 1", g, n1);
    invariants("12d day 1", g, d1);
    invariants("12d night 2", g, n2);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
