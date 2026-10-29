// Cupid (spec-2d FR-7..FR-15): Cupid links two lovers on Night 1, only the two lovers see
// "Your partner is…", and when one lover dies — by the day vote or at night — the other
// is eliminated in the same moment.

import type { Game, Seat } from "./helpers";
import { expect, test } from "./fixtures";
import {
  endDay,
  endNight,
  expectSpectating,
  namesLine,
  oneWithRole,
  pickNightTarget,
  setUpGame,
  vote,
  withRole,
} from "./helpers";

/** Cupid links two players on Night 1 (two taps, "Link lovers", confirm). */
async function linkLovers(cupid: Seat, a: Seat, b: Seat): Promise<void> {
  await cupid.page.getByRole("button", { name: a.name, exact: true }).click();
  await cupid.page.getByRole("button", { name: b.name, exact: true }).click();
  await cupid.page.getByRole("button", { name: "Link lovers" }).click();
  await cupid.page.getByRole("dialog").getByRole("button", { name: "Link", exact: true }).click();
  await expect(cupid.page.getByText(/You linked/)).toContainText(a.name);
}

/** Only the two lovers see their partner line — not Cupid, not anyone else, not the moderator. */
async function expectOnlyLoversSeePartner(game: Game, a: Seat, b: Seat): Promise<void> {
  await expect(a.page.getByText(/Your partner is/)).toContainText(b.name);
  await expect(b.page.getByText(/Your partner is/)).toContainText(a.name);
  for (const s of game.seats) {
    if (s === a || s === b) continue;
    await expect(s.page.getByText(/Your partner is/), `${s.name} (${s.role})`).toBeHidden();
  }
  await expect(game.mod.getByText(/Your partner is/)).toBeHidden();
}

test("Cupid's lovers: one is voted out by day and both are eliminated", async ({ openPage }) => {
  const game = await setUpGame(openPage, { Mafia: 1, Cupid: 1, Civilian: 3 });
  const mafia = oneWithRole(game, "Mafia");
  const cupid = oneWithRole(game, "Cupid");
  const [loverA, loverB, bystander] = withRole(game, "Civilian");

  await test.step("Night 1: Cupid links two Civilians; the Mafia kill no one", async () => {
    await linkLovers(cupid, loverA, loverB);
    await expectOnlyLoversSeePartner(game, loverA, loverB);
    await endNight(game, 1);
    for (const s of game.seats) {
      await expect(s.page.getByText("No one died", { exact: true })).toBeVisible();
    }
  });

  await test.step("Day 1: the town votes out one lover", async () => {
    for (const s of game.seats) await vote(s.page, s === loverA ? "Skip" : loverA.name);
    await expect(game.mod.getByText(/5\s+of\s+5\s+living players have voted/)).toBeVisible();
    await endDay(game);
    // 1 Mafia vs Cupid + 1 Civilian: no winner, on to Night 2.
    await expect(game.mod.getByRole("heading", { name: "Night 2" })).toBeVisible();
  });

  await test.step("both lovers show as eliminated on every device", async () => {
    for (const s of game.seats) {
      await expect(s.page.getByText(`${loverA.name} was eliminated`, { exact: true })).toBeVisible();
      await expect(s.page.getByText(`${loverB.name} also was eliminated`, { exact: true })).toBeVisible();
    }
    await expectSpectating(loverA, true);
    await expectSpectating(loverB, true);
    for (const s of [mafia, cupid, bystander]) await expectSpectating(s, false);
  });
});

test("Cupid's lovers: one dies at night and both are eliminated", async ({ openPage }) => {
  const game = await setUpGame(openPage, { Mafia: 1, Cupid: 1, Civilian: 3 });
  const mafia = oneWithRole(game, "Mafia");
  const cupid = oneWithRole(game, "Cupid");
  const [loverA, loverB, bystander] = withRole(game, "Civilian");

  await test.step("Night 1: Cupid links two Civilians", async () => {
    await linkLovers(cupid, loverA, loverB);
    await expectOnlyLoversSeePartner(game, loverA, loverB);
  });

  await test.step("the Mafia kill one lover", async () => {
    await pickNightTarget(mafia.page, loverB.name);
    await endNight(game, 1);
    // 1 Mafia vs Cupid + 1 Civilian: no winner yet.
    await expect(game.mod.getByRole("heading", { name: "Day 1" })).toBeVisible();
  });

  await test.step("both lovers show as eliminated on every device", async () => {
    const line = `${namesLine([loverA.name, loverB.name])} were eliminated`;
    for (const s of game.seats) await expect(s.page.getByText(line, { exact: true })).toBeVisible();
    await expectSpectating(loverA, true);
    await expectSpectating(loverB, true);
    for (const s of [mafia, cupid, bystander]) await expectSpectating(s, false);
  });
});
