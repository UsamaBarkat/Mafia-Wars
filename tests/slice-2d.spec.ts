// Slice 2d roles (spec-2d): Cupid's lovers die together, the Mafia targeting Granny kill
// their first picker instead (final Granny rule, D15), and a Jester voted out wins outright.

import { expect, test } from "./fixtures";
import {
  endDay,
  endNight,
  expectGameOver,
  expectSpectating,
  namesLine,
  oneWithRole,
  pickNightTarget,
  setUpGame,
  vote,
  withRole,
} from "./helpers";

test("Cupid links two players; killing one lover kills the partner", async ({ openPage }) => {
  const game = await setUpGame(openPage, { Mafia: 1, Cupid: 1, Civilian: 3 });
  const mafia = oneWithRole(game, "Mafia");
  const cupid = oneWithRole(game, "Cupid");
  const [loverA, loverB, bystander] = withRole(game, "Civilian");

  await test.step("Night 1: Cupid links two Civilians (confirm dialog)", async () => {
    await cupid.page.getByRole("button", { name: loverA.name, exact: true }).click();
    await cupid.page.getByRole("button", { name: loverB.name, exact: true }).click();
    await cupid.page.getByRole("button", { name: "Link lovers" }).click();
    const dialog = cupid.page.getByRole("dialog");
    await expect(dialog).toContainText("This can't be changed");
    await dialog.getByRole("button", { name: "Link", exact: true }).click();
    await expect(cupid.page.getByText(/You linked/)).toContainText(loverA.name);
  });

  await test.step("only the two lovers see their partner line", async () => {
    await expect(loverA.page.getByText(/Your partner is/)).toContainText(loverB.name);
    await expect(loverB.page.getByText(/Your partner is/)).toContainText(loverA.name);
    for (const s of [mafia, cupid, bystander]) {
      await expect(s.page.getByText(/Your partner is/)).toBeHidden();
    }
    await expect(game.mod.getByText(/Your partner is|You linked/)).toBeHidden();
  });

  await test.step("Mafia kills one lover; both die in the same night", async () => {
    await pickNightTarget(mafia.page, loverA.name);
    await endNight(game, 1);
    const line = `${namesLine([loverA.name, loverB.name])} were eliminated`;
    for (const s of game.seats) await expect(s.page.getByText(line, { exact: true })).toBeVisible();
    await expectSpectating(loverA, true);
    await expectSpectating(loverB, true);
    await expectSpectating(bystander, false);
    // 1 Mafia vs Cupid + 1 Civilian: no winner yet.
    await expect(game.mod.getByRole("heading", { name: "Day 1" })).toBeVisible();
  });
});

test("the Mafia targeting Granny kill their first picker instead; a day vote still removes her", async ({
  openPage,
}) => {
  const game = await setUpGame(openPage, { Mafia: 2, Granny: 1, Civilian: 2 });
  const granny = oneWithRole(game, "Granny");
  const [firstMafia, secondMafia] = withRole(game, "Mafia");
  const civilians = withRole(game, "Civilian");

  await test.step("Granny's role card explains her power", async () => {
    // Still revealed from the deal, so the in-game role box shows the description.
    await expect(
      granny.page.getByText("If the Mafia target you, one of them dies instead.", { exact: true }),
    ).toBeVisible();
  });

  await test.step("Night 1: both Mafia pick Granny, one clearly first", async () => {
    await pickNightTarget(firstMafia.page, granny.name);
    // Picks are stamped with server time; leave a clear gap so "first" is unambiguous.
    await firstMafia.page.waitForTimeout(1500);
    await pickNightTarget(secondMafia.page, granny.name);
    await endNight(game, 1);
  });

  await test.step("only the first picker dies; Granny and the second Mafia live", async () => {
    const line = `${firstMafia.name} was eliminated`;
    for (const s of game.seats) await expect(s.page.getByText(line, { exact: true })).toBeVisible();
    await expectSpectating(firstMafia, true);
    await expectSpectating(granny, false);
    await expectSpectating(secondMafia, false);
    // 1 Mafia vs Granny + 2 Civilians: no winner yet.
    await expect(game.mod.getByRole("heading", { name: "Day 1" })).toBeVisible();
  });

  await test.step("Day 1: the town votes Granny out; no Mafia dies with her", async () => {
    await vote(secondMafia.page, granny.name);
    for (const c of civilians) await vote(c.page, granny.name);
    await vote(granny.page, "Skip");
    await expect(game.mod.getByText(/4\s+of\s+4\s+living players have voted/)).toBeVisible();
    await endDay(game);
    // 1 Mafia vs 2 Civilians: the game goes on to Night 2.
    await expect(game.mod.getByRole("heading", { name: "Night 2" })).toBeVisible();
    for (const s of game.seats) {
      await expect(s.page.getByText(`${granny.name} was eliminated`, { exact: true })).toBeVisible();
    }
    await expectSpectating(granny, true);
    await expectSpectating(secondMafia, false);
  });
});

test("a Jester voted out wins and the game ends for everyone", async ({ openPage }) => {
  // setRoles steps the BUILT-IN Jester row (no custom role is ever added).
  const game = await setUpGame(openPage, { Mafia: 1, Jester: 1, Civilian: 3 });
  const jester = oneWithRole(game, "Jester");

  await test.step("the Jester is dealt the built-in role, with its own role card", async () => {
    // Still revealed from the deal, so the in-game role box shows the description.
    await expect(jester.page.getByText("Get voted out to win.", { exact: true })).toBeVisible();
    await expect(jester.page.getByText(/A custom role/)).toBeHidden();
  });

  await test.step("Night 1: nobody acts, nobody dies", async () => {
    await endNight(game, 1);
    for (const s of game.seats) {
      await expect(s.page.getByText("No one died", { exact: true })).toBeVisible();
    }
  });

  await test.step("Day 1: everyone else votes out the Jester", async () => {
    for (const s of game.seats) {
      await vote(s.page, s === jester ? "Skip" : jester.name);
    }
    await expect(game.mod.getByText(/5\s+of\s+5\s+living players have voted/)).toBeVisible();
    await endDay(game);
  });

  await test.step("The Jester wins on every device", async () => {
    await expectGameOver(game, "The Jester wins!");
  });
});
