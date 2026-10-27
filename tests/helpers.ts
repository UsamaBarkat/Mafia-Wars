// Game-driving helpers. They use only what a real player sees and taps: each player
// learns their role by revealing it on their own screen, and the tests never read the
// database. Roles are dealt with a secure shuffle, so tests look up "who is the Mafia"
// from the revealed roles instead of assuming a seat.

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

export const ROLE_NAMES = [
  "Mafia",
  "Detective",
  "Doctor",
  "Civilian",
  "Jester",
  "Cupid",
  "Granny",
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const PLAYER_NAMES = ["Ann", "Ben", "Cleo", "Dev", "Eli"];

export type Seat = { name: string; page: Page; role: string };

export type Game = { code: string; mod: Page; seats: Seat[] };

/** The moderator creates a room from Home → Play Online. Returns the 6-digit code. */
export async function createRoom(mod: Page): Promise<string> {
  await mod.goto("/");
  await mod.getByRole("button", { name: "Play Online" }).click();
  await mod.getByLabel("Your name").fill("Mod");
  await mod.getByRole("button", { name: "Create Game" }).click();
  await expect(mod.getByRole("heading", { name: "Waiting Room" })).toBeVisible();
  const code = await mod.getByText(/^\d{6}$/).textContent();
  return code!.trim();
}

export async function joinRoom(page: Page, code: string, name: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Play Online" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Game code").fill(code);
  await page.getByRole("button", { name: "Join Game" }).click();
  await expect(page.getByRole("heading", { name: "Waiting Room" })).toBeVisible();
  await expect(page.getByText(`You're in as ${name}`, { exact: false })).toBeVisible();
}

/** Step every built-in role to its target count (missing roles → 0). One tap at a time,
 *  waiting for each write to come back, because the stepper writes `count ± 1` from the
 *  count it last rendered. */
export async function setRoles(
  mod: Page,
  counts: Partial<Record<RoleName, number>>,
): Promise<void> {
  for (const name of ROLE_NAMES) {
    const target = counts[name] ?? 0;
    const label = mod.locator(`[aria-label="${name} count"]`);
    await expect(label).toBeVisible();
    let current = Number(await label.textContent());
    while (current !== target) {
      const step = current < target ? 1 : -1;
      await mod
        .getByRole("button", { name: `${step > 0 ? "Increase" : "Decrease"} ${name}`, exact: true })
        .click();
      current += step;
      await expect(label).toHaveText(String(current));
    }
  }
}

/** Taps "Tap to see your role" on the player's own screen and returns the role shown. */
export async function revealRole(page: Page): Promise<string> {
  await page.getByRole("button", { name: /Tap to see your role/ }).click();
  const role = page.getByTestId("revealed-role");
  await expect(role).toBeVisible();
  return (await role.textContent())!.trim();
}

/**
 * Everything up to Night 1: create the room, join 5 players (each in their own browser
 * context), configure roles, start + deal, every player reveals their role, then the
 * moderator begins Night 1.
 */
export async function setUpGame(
  openPage: () => Promise<Page>,
  counts: Partial<Record<RoleName, number>>,
): Promise<Game> {
  const mod = await openPage();
  const code = await test.step("moderator creates a room", () => createRoom(mod));

  const pages: Page[] = [];
  await test.step("5 players join in separate browser contexts", async () => {
    for (const name of PLAYER_NAMES) {
      const page = await openPage();
      await joinRoom(page, code, name);
      pages.push(page);
    }
    await expect(mod.getByText(/· 5 players joined/)).toBeVisible();
  });

  const seats: Seat[] = [];
  await test.step("configure roles, start and deal", async () => {
    await setRoles(mod, counts);
    const start = mod.getByRole("button", { name: "Start Game" });
    await expect(start).toBeEnabled();
    await start.click();

    for (const [i, page] of pages.entries()) {
      seats.push({ name: PLAYER_NAMES[i], page, role: await revealRole(page) });
    }
    // The deal hands out exactly the configured roles, one per player.
    const expected = Object.entries(counts).flatMap(([role, n]) => Array(n).fill(role));
    expect(seats.map((s) => s.role).sort()).toEqual(expected.sort());
  });

  await test.step("moderator begins Night 1", async () => {
    await expect(mod.getByText("5 of 5")).toBeVisible(); // everyone has seen their role
    await mod.getByRole("button", { name: "Begin Night 1" }).click();
    await expect(mod.getByRole("heading", { name: "Night 1" })).toBeVisible();
    for (const s of seats) await expect(s.page.getByText("Night 1", { exact: true })).toBeVisible();
  });

  return { code, mod, seats };
}

export function withRole(game: Game, role: string): Seat[] {
  return game.seats.filter((s) => s.role === role);
}

export function oneWithRole(game: Game, role: string): Seat {
  const found = withRole(game, role);
  expect(found, `exactly one ${role}`).toHaveLength(1);
  return found[0];
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A night pick (kill / protect / investigate). Waits until it's saved ("✓ chosen"). */
export async function pickNightTarget(page: Page, targetName: string): Promise<void> {
  await page.getByRole("button", { name: targetName, exact: true }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(`^${escape(targetName)}.*chosen`) }),
  ).toBeVisible();
}

/** A day vote for a player's name, or "Skip". Waits until it's saved ("✓"). */
export async function vote(page: Page, targetName: string): Promise<void> {
  await page
    .getByRole("button", { name: new RegExp(`^${escape(targetName)}\\s*\\d+ votes?`) })
    .click();
  await expect(
    page.getByRole("button", { name: new RegExp(`^${escape(targetName)}.*✓`) }),
  ).toBeVisible();
}

export async function endNight(game: Game, round: number): Promise<void> {
  await game.mod.getByRole("button", { name: "End Night" }).click();
  await expect(
    game.mod
      .getByRole("heading", { name: `Day ${round}` })
      .or(game.mod.getByText("Game Over", { exact: true })),
  ).toBeVisible();
}

export async function endDay(game: Game): Promise<void> {
  await game.mod.getByRole("button", { name: "End Day" }).click();
  await expect(game.mod.getByRole("button", { name: "End Day" })).toBeHidden();
}

/** "A", "A and B", "A, B and C", names sorted, matching the app's outcome lines. */
export function namesLine(names: string[]): string {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  return sorted.length <= 1
    ? sorted.join("")
    : `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

export async function expectSpectating(seat: Seat, spectating: boolean): Promise<void> {
  const banner = seat.page.getByText(/You've been eliminated/);
  if (spectating) await expect(banner, `${seat.name} should be eliminated`).toBeVisible();
  else await expect(banner, `${seat.name} should be alive`).toBeHidden();
}

/** Every device (players + moderator) shows the same game-over headline. */
export async function expectGameOver(game: Game, headline: string): Promise<void> {
  for (const page of [game.mod, ...game.seats.map((s) => s.page)]) {
    await expect(page.getByRole("heading", { name: headline })).toBeVisible();
  }
  // Full reveal: every player's name next to their true role.
  for (const s of game.seats) {
    await expect(game.mod.locator("li", { hasText: s.name })).toContainText(s.role);
  }
}
