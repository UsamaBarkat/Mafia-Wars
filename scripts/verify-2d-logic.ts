// Slice 2d pure-logic verification (tasks-2d task 3). No Firebase, no emulator needed.
// Run:  npx tsx scripts/verify-2d-logic.ts
//
// Exercises resolveNight / resolveDay / checkWin / lovers.ts directly, including the
// unchanged 2b behavior (unanimous kill, Doctor cancel, Detective, tie/Skip, wins).

import { checkWin } from "../lib/game/checkWin";
import { loverPairs, withLinkedDeaths, type LoverPair } from "../lib/game/lovers";
import { resolveDay } from "../lib/game/resolveDay";
import { resolveNight } from "../lib/game/resolveNight";
import type { NightAction, Vote } from "../lib/room/types";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`, detail ?? "");
  }
}
const same = (a: readonly string[], b: readonly string[]) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const kill = (targetUid: string, submittedAt: number): NightAction => ({ role: "Mafia", action: "kill", targetUid, submittedAt });
const protect = (targetUid: string): NightAction => ({ role: "Doctor", action: "protect", targetUid, submittedAt: 0 });
const investigate = (targetUid: string): NightAction => ({ role: "Detective", action: "investigate", targetUid, submittedAt: 0 });
const link = (a: string, b: string): NightAction => ({ role: "Cupid", action: "link", targetUid: a, secondTargetUid: b, submittedAt: 0 });
const votesFor = (map: Record<string, string>): Record<string, Vote> =>
  Object.fromEntries(Object.entries(map).map(([voter, t]) => [voter, { targetUid: t, votedAt: 0 }]));

// A standard cast: m1/m2 Mafia, doc Doctor, det Detective, cup Cupid, gran Granny,
// jes Jester, civ1/civ2 Civilians.
const roles: Record<string, string> = {
  m1: "Mafia", m2: "Mafia", doc: "Doctor", det: "Detective", cup: "Cupid",
  gran: "Granny", jes: "Jester", civ1: "Civilian", civ2: "Civilian",
};

console.log("\n== 2b regression ==");
{
  const r = resolveNight({ m1: kill("civ1", 1), m2: kill("civ1", 2) }, roles);
  check("unanimous Mafia kill eliminates the target", same(r.eliminatedUids, ["civ1"]), r);
}
{
  const r = resolveNight({ m1: kill("civ1", 1), m2: kill("civ2", 2) }, roles);
  check("Mafia disagreeing => no kill", r.eliminatedUids.length === 0, r);
}
{
  const r = resolveNight({ m1: kill("civ1", 1), doc: protect("civ1") }, roles);
  check("Doctor protecting the target cancels the kill", r.eliminatedUids.length === 0, r);
}
{
  const r = resolveNight({ m1: kill("civ1", 1) }, roles);
  check("one submitting Mafia counts as agreement", same(r.eliminatedUids, ["civ1"]), r);
}
{
  const r = resolveNight({ det: investigate("m1"), m1: kill("det", 1) }, roles);
  check("Detective learns 'mafia' even on the night they die",
    r.detectiveResults.det?.result === "mafia" && same(r.eliminatedUids, ["det"]), r);
}
{
  const r = resolveNight({ det: investigate("jes") }, roles);
  check("Detective investigating the Jester learns 'not-mafia'", r.detectiveResults.det?.result === "not-mafia");
}
{
  const r = resolveNight({ civ1: { role: "Mafia", action: "kill", targetUid: "civ2", submittedAt: 0 } }, roles);
  check("a non-Mafia faking a Mafia kill is ignored", r.eliminatedUids.length === 0);
}
check("day: most votes eliminated", resolveDay(votesFor({ a: "civ1", b: "civ1", c: "civ2" }), roles).eliminatedUid === "civ1");
check("day: tie => no one", resolveDay(votesFor({ a: "civ1", b: "civ2" }), roles).eliminatedUid === null);
check("day: Skip winning => no one", resolveDay(votesFor({ a: "skip", b: "skip", c: "civ1" }), roles).eliminatedUid === null);
check("day: Skip tying => no one", resolveDay(votesFor({ a: "skip", b: "civ1" }), roles).eliminatedUid === null);
check("day: no votes => no one", resolveDay({}, roles).eliminatedUids.length === 0);
check("win: Town when no Mafia alive", checkWin(["Civilian", "Doctor"]) === "town");
check("win: Mafia at parity", checkWin(["Mafia", "Civilian"]) === "mafia");
check("win: game continues", checkWin(["Mafia", "Civilian", "Doctor"]) === null);
check("win: old one-arg call still works", checkWin(["Mafia", "Mafia", "Civilian"]) === "mafia");

console.log("\n== Cupid: pair extraction ==");
check("Cupid's link becomes a pair", JSON.stringify(loverPairs({ cup: link("civ1", "civ2") }, roles)) === JSON.stringify([["civ1", "civ2"]]));
check("Cupid with no picks => no lovers", loverPairs({ m1: kill("civ1", 1) }, roles).length === 0);
check("no actions at all => no lovers", loverPairs({}, roles).length === 0);
check("a non-Cupid's 'link' is ignored", loverPairs({ civ1: link("civ2", "doc") }, roles).length === 0);
check("Cupid linking himself is ignored", loverPairs({ cup: link("cup", "civ1") }, roles).length === 0);
check("Cupid linking the same player twice is ignored", loverPairs({ cup: link("civ1", "civ1") }, roles).length === 0);
check("Cupid linking an unknown uid is ignored", loverPairs({ cup: link("civ1", "ghost") }, roles).length === 0);
check("Cupid link missing its second target is ignored",
  loverPairs({ cup: { role: "Cupid", action: "link", targetUid: "civ1", submittedAt: 0 } }, roles).length === 0);
{
  const night = resolveNight({ m1: kill("civ1", 1) }, roles, loverPairs({}, roles));
  check("Cupid with no picks: the night still resolves normally", same(night.eliminatedUids, ["civ1"]), night);
}

console.log("\n== Lovers: chains and loops ==");
const pairAB: LoverPair[] = [["civ1", "civ2"]];
check("a lover's death takes the partner", same([...withLinkedDeaths(["civ1"], pairAB)], ["civ1", "civ2"]));
check("no death => no linked death", withLinkedDeaths([], pairAB).size === 0);
check("an unlinked death takes no one", same([...withLinkedDeaths(["doc"], pairAB)], ["doc"]));
{
  const chain: LoverPair[] = [["a", "b"], ["b", "c"], ["c", "d"]];
  check("a chain of links (several Cupids) dies together", same([...withLinkedDeaths(["a"], chain)], ["a", "b", "c", "d"]));
}
{
  const loop: LoverPair[] = [["a", "b"], ["b", "c"], ["c", "a"]];
  const dead = withLinkedDeaths(["b"], loop);
  check("a link LOOP terminates and kills each member once", dead.size === 3 && same([...dead], ["a", "b", "c"]));
}
{
  const dup: LoverPair[] = [["a", "b"], ["b", "a"]];
  check("the same pair linked twice (two Cupids) is fine", same([...withLinkedDeaths(["a"], dup)], ["a", "b"]));
}
{
  const r = resolveNight({ m1: kill("civ1", 1) }, roles, pairAB);
  check("night: Mafia kill on a lover kills both", same(r.eliminatedUids, ["civ1", "civ2"]), r);
}
{
  const r = resolveNight({ m1: kill("civ1", 1), doc: protect("civ1") }, roles, pairAB);
  check("night: Doctor saves a lover => nobody dies, partner unaffected", r.eliminatedUids.length === 0, r);
}
{
  const r = resolveNight({ m1: kill("civ1", 1), doc: protect("civ2") }, roles, pairAB);
  check("night: Doctor protecting the PARTNER doesn't stop the heartbreak death", same(r.eliminatedUids, ["civ1", "civ2"]), r);
}
{
  const r = resolveNight({ m1: kill("civ1", 1), m2: kill("civ2", 1) }, roles, pairAB);
  check("night: Mafia disagreeing over two lovers => no kill", r.eliminatedUids.length === 0, r);
}
{
  const mafiaLover: LoverPair[] = [["m1", "civ1"]];
  const r = resolveDay(votesFor({ a: "m1", b: "m1", c: "civ2" }), roles, mafiaLover);
  check("day: voting out a lover kills the partner too", same(r.eliminatedUids, ["m1", "civ1"]) && r.eliminatedUid === "m1", r);
}
{
  const r = resolveDay(votesFor({ a: "civ1", b: "civ2" }), roles, pairAB);
  check("day: a tie with lovers kills no one", r.eliminatedUids.length === 0, r);
}
{
  const r = resolveNight({ cup: link("civ1", "civ2"), m1: kill("civ1", 1) }, roles, loverPairs({ cup: link("civ1", "civ2") }, roles));
  check("Night 1: a link made tonight applies tonight", same(r.eliminatedUids, ["civ1", "civ2"]), r);
}
{
  const r = resolveNight({ m1: kill("cup", 1) }, roles, pairAB);
  check("Cupid dying doesn't affect the lovers", same(r.eliminatedUids, ["cup"]), r);
}

console.log("\n== Granny ==");
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200) }, roles);
  check("Granny killed: the earliest-picking Mafia (m1) dies with her", same(r.eliminatedUids, ["gran", "m1"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 300), m2: kill("gran", 200) }, roles);
  check("changed pick: m1 re-saved later (300) so m2 (200) is first", same(r.eliminatedUids, ["gran", "m2"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100) }, roles);
  check("solo Mafia kills Granny: both die", same(r.eliminatedUids, ["gran", "m1"]), r);
  const alive = Object.keys(roles).filter((u) => !r.eliminatedUids.includes(u) && u !== "m2");
  check("...and with no Mafia left Town wins that night", checkWin(alive.map((u) => roles[u])) === "town");
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("gran") }, roles);
  check("Doctor saves Granny => nobody dies", r.eliminatedUids.length === 0, r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("civ1", 50) }, roles);
  check("Mafia disagree (one on Granny) => no kill, no retaliation", r.eliminatedUids.length === 0, r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("m1") }, roles);
  check("Doctor protecting the first Mafia doesn't save them (D8)", same(r.eliminatedUids, ["gran", "m1"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100) }, roles, [["gran", "civ1"]]);
  check("Granny who is a lover: her partner dies too", same(r.eliminatedUids, ["gran", "m1", "civ1"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200) }, roles, [["m1", "civ2"]]);
  check("Granny's Mafia is a lover: his partner dies too", same(r.eliminatedUids, ["gran", "m1", "civ2"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100) }, roles, [["gran", "m1"]]);
  check("Granny and her killer are lovers: each listed once", same(r.eliminatedUids, ["gran", "m1"]) && r.eliminatedUids.length === 2, r);
}
{
  const r = resolveDay(votesFor({ a: "gran", b: "gran" }), roles);
  check("Granny voted out by day takes no Mafia", same(r.eliminatedUids, ["gran"]), r);
}
{
  const r = resolveNight({ m1: kill("civ1", 100) }, roles, [["civ1", "gran"]]);
  check("Granny dying as a lover takes no Mafia", same(r.eliminatedUids, ["civ1", "gran"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 100) }, roles, [], (uids) => [...uids].sort()[1]);
  check("exact tie uses the tie-break picker (injected: picks m2)", same(r.eliminatedUids, ["gran", "m2"]), r);
}
{
  const picked = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 100) }, roles);
    r.eliminatedUids.filter((u) => u !== "gran").forEach((u) => picked.add(u));
  }
  check("exact tie with the default secure picker: only tied Mafia, both reachable", same([...picked], ["m1", "m2"]), [...picked]);
}

console.log("\n== Jester & win checks ==");
{
  const day = resolveDay(votesFor({ a: "jes", b: "jes", c: "m1" }), roles);
  check("Jester voted out => jesterVotedOut", day.jesterVotedOut && day.eliminatedUid === "jes", day);
  check("...and checkWin returns 'jester'", checkWin(["Mafia", "Civilian"], day.jesterVotedOut) === "jester");
}
{
  // Only 3 left: Jester, 1 Mafia, 1 Civilian. Town votes out the Jester.
  const day = resolveDay(votesFor({ m1: "jes", civ1: "jes", jes: "civ1" }), roles);
  const alive = ["m1", "civ1"].map((u) => roles[u]);
  check("few players left: Jester voted out still wins (not Mafia parity)", checkWin(alive, day.jesterVotedOut) === "jester");
}
{
  // Jester is the last Mafia's lover: voting out the Jester also kills the last Mafia,
  // which would be a Town win — the Jester overrides it.
  const day = resolveDay(votesFor({ a: "jes", b: "jes" }), roles, [["jes", "m1"]]);
  const alive = ["civ1", "doc"].map((u) => roles[u]);
  check("Jester win overrides a simultaneous Town win", same(day.eliminatedUids, ["jes", "m1"]) && checkWin(alive, day.jesterVotedOut) === "jester", day);
}
{
  const r = resolveNight({ m1: kill("jes", 1) }, roles);
  check("Jester killed at night just dies (no Jester win at night)", same(r.eliminatedUids, ["jes"]) && checkWin(["Mafia", "Civilian", "Doctor"]) === null);
}
{
  const day = resolveDay(votesFor({ a: "civ1", b: "civ1" }), roles, [["civ1", "jes"]]);
  check("Jester dying as a lover by day is NOT a Jester win", !day.jesterVotedOut && same(day.eliminatedUids, ["civ1", "jes"]), day);
}
check("Jester counts as non-Mafia for parity (1 Mafia vs Jester+Civ => continues)", checkWin(["Mafia", "Jester", "Civilian"]) === null);
check("1 Mafia + Jester left => Mafia parity win", checkWin(["Mafia", "Jester"]) === "mafia");
check("last Mafia dead with Jester alive => Town wins (Jester loses)", checkWin(["Jester", "Civilian"]) === "town");
check("everyone dead => Town (Mafia = 0 checked first)", checkWin([]) === "town");
check("Cupid and Granny count as Town", checkWin(["Mafia", "Cupid", "Granny"]) === null);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
