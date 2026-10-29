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

console.log("\n== Granny (final rule, spec-2d D15) ==");
/** Living roles after `dead` are removed — what checkWin sees right after the night. */
const aliveRolesAfter = (dead: readonly string[]) =>
  Object.keys(roles).filter((u) => !dead.includes(u)).map((u) => roles[u]);
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200) }, roles);
  check("Mafia target Granny: the first picker (m1) dies INSTEAD, Granny survives", same(r.eliminatedUids, ["m1"]), r);
  check("...and the second Mafia (m2) lives", !r.eliminatedUids.includes("m2"), r);
}
{
  const r = resolveNight({ m1: kill("gran", 300), m2: kill("gran", 200) }, roles);
  check("changed pick: m1 re-saved later (300) so m2 (200) is the retaliation target", same(r.eliminatedUids, ["m2"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("gran") }, roles);
  check("Doctor protects Granny: the first picker still dies, Granny survives", same(r.eliminatedUids, ["m1"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("m1") }, roles);
  check("Doctor protects the retaliation target: he lives and Granny dies", same(r.eliminatedUids, ["gran"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("m2") }, roles);
  check("Doctor protects the OTHER Mafia: the first picker still dies", same(r.eliminatedUids, ["m1"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("civ1") }, roles);
  check("Doctor protects a bystander: the first picker still dies", same(r.eliminatedUids, ["m1"]), r);
}
{
  const twoDoctors = { ...roles, doc2: "Doctor" };
  const r = resolveNight(
    { m1: kill("gran", 100), doc: protect("m1"), doc2: { role: "Doctor", action: "protect", targetUid: "gran", submittedAt: 0 } },
    twoDoctors,
  );
  check("two Doctors protect both Granny and the retaliation target: no one dies", r.eliminatedUids.length === 0, r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("civ1", 50) }, roles);
  check("Mafia disagree (one on Granny) => no kill, no retaliation", r.eliminatedUids.length === 0, r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200) }, roles, [["m1", "civ2"]]);
  check("the dying Mafia is a lover: his partner dies too, Granny lives", same(r.eliminatedUids, ["m1", "civ2"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("m1") }, roles, [["gran", "civ1"]]);
  check("Granny dies after the Doctor save and is a lover: her partner dies too", same(r.eliminatedUids, ["gran", "civ1"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100) }, roles, [["gran", "civ1"]]);
  check("Granny is a lover but survives: her partner lives", same(r.eliminatedUids, ["m1"]), r);
}
{
  const r = resolveNight({ m1: kill("gran", 100) }, roles, [["gran", "m1"]]);
  check("Granny is the dying Mafia's lover: she dies as his partner, each listed once",
    same(r.eliminatedUids, ["gran", "m1"]) && r.eliminatedUids.length === 2, r);
}
{
  const r = resolveDay(votesFor({ a: "gran", b: "gran" }), roles);
  check("Granny voted out by day: she is removed, and no Mafia dies", same(r.eliminatedUids, ["gran"]) && r.eliminatedUid === "gran", r);
}
{
  const r = resolveNight({ m1: kill("civ1", 100) }, roles, [["civ1", "gran"]]);
  check("Granny dying as a lover takes no Mafia", same(r.eliminatedUids, ["civ1", "gran"]), r);
}
{
  // Win check right after: a solo Mafia targets Granny and dies instead.
  const solo = { m1: "Mafia", gran: "Granny", civ1: "Civilian", civ2: "Civilian" };
  const r = resolveNight({ m1: kill("gran", 100) }, solo);
  const alive = Object.keys(solo).filter((u) => !r.eliminatedUids.includes(u)).map((u) => solo[u as keyof typeof solo]);
  check("solo Mafia targets Granny: he dies, Granny lives", same(r.eliminatedUids, ["m1"]), r);
  check("...and the win check right after sees no Mafia left => Town", checkWin(alive) === "town");
}
{
  // Win check right after a Doctor-saved retaliation: Granny's death can hand the Mafia parity.
  const small = { m1: "Mafia", m2: "Mafia", gran: "Granny", doc: "Doctor", civ1: "Civilian" };
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200), doc: protect("m1") }, small, [["gran", "civ1"]]);
  const alive = Object.keys(small).filter((u) => !r.eliminatedUids.includes(u)).map((u) => small[u as keyof typeof small]);
  check("Doctor-saved retaliation + Granny's lover: win check sees both deaths => Mafia parity",
    same(r.eliminatedUids, ["gran", "civ1"]) && checkWin(alive) === "mafia", { r, alive });
}
check("win check after the standard retaliation (m1 dead): game continues",
  checkWin(aliveRolesAfter(resolveNight({ m1: kill("gran", 100), m2: kill("gran", 200) }, roles).eliminatedUids)) === null);
{
  const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 100) }, roles, [], (uids) => [...uids].sort()[1]);
  check("exact tie uses the tie-break picker (injected: picks m2)", same(r.eliminatedUids, ["m2"]), r);
}
{
  const picked = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const r = resolveNight({ m1: kill("gran", 100), m2: kill("gran", 100) }, roles);
    r.eliminatedUids.forEach((u) => picked.add(u));
  }
  check("exact tie with the default secure picker: only tied Mafia, both reachable", same([...picked], ["m1", "m2"]), [...picked]);
}

console.log("\n== Jester & win checks ==");
{
  const day = resolveDay(votesFor({ a: "jes", b: "jes", c: "m1" }), roles);
  check("Jester voted out => jesterDiedByDay", day.jesterDiedByDay && day.eliminatedUid === "jes", day);
  check("...and checkWin returns 'jester'", checkWin(["Mafia", "Civilian"], day.jesterDiedByDay) === "jester");
}
{
  // Only 3 left: Jester, 1 Mafia, 1 Civilian. Town votes out the Jester.
  const day = resolveDay(votesFor({ m1: "jes", civ1: "jes", jes: "civ1" }), roles);
  const alive = ["m1", "civ1"].map((u) => roles[u]);
  check("few players left: Jester voted out still wins (not Mafia parity)", checkWin(alive, day.jesterDiedByDay) === "jester");
}
{
  // Jester is the last Mafia's lover: voting out the Jester also kills the last Mafia,
  // which would be a Town win — the Jester overrides it.
  const day = resolveDay(votesFor({ a: "jes", b: "jes" }), roles, [["jes", "m1"]]);
  const alive = ["civ1", "doc"].map((u) => roles[u]);
  check("Jester win overrides a simultaneous Town win", same(day.eliminatedUids, ["jes", "m1"]) && checkWin(alive, day.jesterDiedByDay) === "jester", day);
}
{
  const r = resolveNight({ m1: kill("jes", 1) }, roles);
  check("Jester killed at night just dies (no Jester win at night)", same(r.eliminatedUids, ["jes"]) && checkWin(["Mafia", "Civilian", "Doctor"]) === null);
}
{
  const day = resolveDay(votesFor({ a: "civ1", b: "civ1" }), roles, [["civ1", "jes"]]);
  check("Jester dying as a lover by day IS a Jester win (D16)", day.jesterDiedByDay && same(day.eliminatedUids, ["civ1", "jes"]), day);
}
{
  const r = resolveNight({ m1: kill("civ1", 1) }, roles, [["civ1", "jes"]]);
  check("Jester dying as a lover at night is NOT a Jester win", same(r.eliminatedUids, ["civ1", "jes"]) && checkWin(["Mafia", "Doctor", "Civilian"]) === null, r);
}
check("tie or Skip by day: no death, no Jester win", !resolveDay(votesFor({ a: "jes", b: "skip" }), roles).jesterDiedByDay);
check("Jester counts as non-Mafia for parity (1 Mafia vs Jester+Civ => continues)", checkWin(["Mafia", "Jester", "Civilian"]) === null);
check("1 Mafia + Jester left => Mafia parity win", checkWin(["Mafia", "Jester"]) === "mafia");
check("last Mafia dead with Jester alive => Town wins (Jester loses)", checkWin(["Jester", "Civilian"]) === "town");
check("everyone dead => Town (Mafia = 0 checked first)", checkWin([]) === "town");
check("Cupid and Granny count as Town", checkWin(["Mafia", "Cupid", "Granny"]) === null);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
