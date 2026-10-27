// Core online game (spec-2a/2b): create a room, 5 players join in separate browser
// contexts, deal, a Night-1 kill, a Day-1 vote, and a Town win.

import { expect, test } from "./fixtures";
import {
  endDay,
  endNight,
  expectGameOver,
  expectSpectating,
  oneWithRole,
  pickNightTarget,
  setUpGame,
  vote,
  withRole,
} from "./helpers";

test("night kill, day vote, Town wins", async ({ openPage }) => {
  const game = await setUpGame(openPage, { Mafia: 1, Detective: 1, Doctor: 1, Civilian: 2 });
  const mafia = oneWithRole(game, "Mafia");
  const doctor = oneWithRole(game, "Doctor");
  const detective = oneWithRole(game, "Detective");
  const [victim, otherCivilian] = withRole(game, "Civilian");

  await test.step("Night 1: Mafia kills a Civilian, Doctor protects themself", async () => {
    await pickNightTarget(mafia.page, victim.name);
    await pickNightTarget(doctor.page, doctor.name);
    await pickNightTarget(detective.page, mafia.name);
    await expect(game.mod.getByText(/3\s+of\s+3\s+role-holders have acted/)).toBeVisible();
    await endNight(game, 1);
  });

  await test.step("Day 1: everyone sees the kill; the victim spectates", async () => {
    for (const s of game.seats) {
      await expect(s.page.getByText(`${victim.name} was eliminated`, { exact: true })).toBeVisible();
    }
    await expectSpectating(victim, true);
    await expectSpectating(mafia, false);
    // Only the Detective gets their private finding.
    await expect(detective.page.getByText(new RegExp(`${mafia.name}\\s*—\\s*Mafia$`))).toBeVisible();
    await expect(otherCivilian.page.getByText("Your investigation")).toBeHidden();
  });

  await test.step("Day 1: the town votes out the Mafia", async () => {
    await vote(doctor.page, mafia.name);
    await vote(detective.page, mafia.name);
    await vote(otherCivilian.page, mafia.name);
    await vote(mafia.page, otherCivilian.name);
    await expect(game.mod.getByText(/4\s+of\s+4\s+living players have voted/)).toBeVisible();
    await endDay(game);
  });

  await test.step("Town wins on every device, with every role revealed", async () => {
    await expectGameOver(game, "Town wins!");
  });
});

test("two Mafia see the 'haven't agreed' warning until their picks match", async ({
  openPage,
}) => {
  const game = await setUpGame(openPage, { Mafia: 2, Civilian: 3 });
  const [mafiaA, mafiaB] = withRole(game, "Mafia");
  const [civ1, civ2] = withRole(game, "Civilian");
  const warning = /haven't agreed on a target/;

  await test.step("no warning before anyone picks", async () => {
    for (const m of [mafiaA, mafiaB]) await expect(m.page.getByText(warning)).toBeHidden();
  });

  await test.step("different targets: both Mafia see the warning", async () => {
    // Both teammate listeners were attached at night start, before either pick existed.
    await pickNightTarget(mafiaA.page, civ1.name);
    await pickNightTarget(mafiaB.page, civ2.name);
    for (const m of [mafiaA, mafiaB]) await expect(m.page.getByText(warning)).toBeVisible();
  });

  await test.step("matching targets: the warning disappears for both", async () => {
    await pickNightTarget(mafiaB.page, civ1.name);
    for (const m of [mafiaA, mafiaB]) await expect(m.page.getByText(warning)).toBeHidden();
  });

  await test.step("the agreed kill goes through: 2 Mafia vs 2 Civilians is a Mafia win", async () => {
    await endNight(game, 1);
    await expectGameOver(game, "Mafia wins!");
  });
});
