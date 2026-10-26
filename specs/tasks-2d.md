# tasks-2d.md — Mafia Wars · Phase 2 Slice 2d Task Breakdown

Build order for Slice 2d (Jester, Cupid, Granny). Derived from [../CLAUDE.md](../CLAUDE.md) and [spec-2d.md](spec-2d.md).

Convention per task: **Goal**, **Files**, **Satisfies**, **Done when**, **Depends on**.

> **Security Rules (task 2) and the pure resolver logic (task 3) land before any UI**, the same discipline as 2a/2b/2c.

---

## 1. Data model & paths

- **Goal:** add types and paths for the lover pairing, the `link` action and the `"jester"` winner. The 2a/2b/2c paths are untouched.
- **Files:** `lib/room/types.ts`, `lib/room/paths.ts`.
- **Satisfies:** spec-2d Backend, FR‑3, FR‑24.
- **Done when:**
  - `WinnerTeam` includes `"jester"`.
  - `NightActionKind` includes `"link"`, and `NightAction` has an optional `secondTargetUid`.
  - The outcomes have an optional `eliminatedUids`.
  - `roomPaths.lovers(code)` and `roomPaths.loversEntry(code, uid)` exist.
  - `tsc` is clean.
- **Depends on:** —

## 2. Security Rules: Cupid link, `lovers`, jester winner, outcome lists

- **Goal:** every rules change in spec-2d FR‑25, emulator-verified **before any UI**.
- **Files:** `database.rules.json`.
- **Satisfies:** FR‑7, FR‑8, FR‑10, FR‑25, FR‑30.
- **Done when:** verified against the emulator with real signed-in identities:
  - A living Cupid on Night 1 can atomically write `link` plus both `lovers` entries.
  - Each of these is denied:
    - a self-pick, the same player twice, or a dead target;
    - a link on round 2;
    - a non-Cupid writing a link or lovers entries;
    - a dead Cupid acting;
    - changing or deleting the link;
    - lovers entries that don't match the action, or a missing reciprocal entry.
  - Each lover reads only their own entry. Other players, Cupid and the moderator are denied.
  - The moderator can clear `lovers`.
  - `winner: 'jester'` is accepted, and `eliminatedUids` is accepted.
  - The existing 2b/2c rules still pass.
- **Depends on:** 1

## 3. Pure logic: lovers, Granny, Jester, `checkWin`

- **Goal:** extend `resolveNight`, `resolveDay` and `checkWin`, and add a `lovers` helper (pair extraction plus death closure). No Firebase.
- **Files:** `lib/game/lovers.ts` (new), `lib/game/resolveNight.ts`, `lib/game/resolveDay.ts`, `lib/game/checkWin.ts`, `scripts/verify-2d-logic.ts` (new test script).
- **Satisfies:** FR‑2..5, FR‑9, FR‑12..14, FR‑17..19, FR‑21..23.
- **Done when:** the test script passes. It covers lover chains and loops, Granny who is also a lover, Granny's Mafia who is a lover, a Doctor save of a lover, a Doctor save of Granny, Mafia disagreement, the earliest-final-pick rule, a secure tie-break, Cupid with no picks or an invalid link, a Jester voted out with few players, a Jester override, Jester parity, everyone dead, and the unchanged 2b cases.
- **Depends on:** 1

## 4. Wire the resolvers, `submitNightAction`, Play Again

- **Goal:** `resolveNightOnClient` and `resolveDayOnClient` read the round‑1 actions for the pairs, apply every linked death plus the outcome plus the phase or winner in **one** atomic update, keep `withTimeout`, and keep `publicRoles` as the second write.
  - `submitNightAction` uses `serverTimestamp()`.
  - A new `submitCupidLink` does the atomic link plus lovers write.
  - `resetForPlayAgain` clears `lovers`.
- **Files:** `lib/game/resolveNightOnClient.ts`, `lib/game/resolveDayOnClient.ts`, `lib/game/submitNightAction.ts`, `lib/game/submitCupidLink.ts` (new), `lib/room/resetForPlayAgain.ts`.
- **Satisfies:** FR‑12, FR‑13, FR‑18, FR‑21..24, FR‑30, D10.
- **Done when:** the real exported functions, run against the emulator, produce the right deaths, outcome, winner and reveal for the lover, Granny and Jester scenarios. Play Again leaves `lovers` empty.
- **Depends on:** 2, 3

## 5. Role config: new rows, reserved names, backfill

- **Goal:** online seed plus backfill of Jester/Cupid/Granny (count 0, cap 20), with built-in names reserved. Phase 1 is untouched.
- **Files:** `lib/roles.ts`, `lib/room/config.ts`, `components/online/RoleConfig.tsx`.
- **Satisfies:** FR‑26.
- **Depends on:** 1

## 6. Night UI: Cupid picker, lover line, no-op re-tap, moderator counter

- **Files:** `components/screens/NightScreen.tsx`, `components/online/NightAction.tsx`, `components/online/CupidPicker.tsx` (new), `components/screens/OnlineRevealScreen.tsx`, `lib/room/subscriptions.ts`, `components/online/ModeratorStarted.tsx`.
- **Satisfies:** FR‑7..10, FR‑20, FR‑29.
- **Depends on:** 2, 4

## 7. Reveal info, multi-death outcomes, Jester game-over

- **Files:** `lib/roleInfo.ts` (new, shared with Phase 1's `RevealScreen.tsx`, whose behavior is unchanged), `components/screens/OnlineRevealScreen.tsx`, `components/screens/GameOverScreen.tsx`.
- **Satisfies:** FR‑24, FR‑27, FR‑28.
- **Depends on:** 4

## 8. Verification & regression pass

- **Done when:**
  - `tsc --noEmit` and `next build` are clean.
  - The 2d rules and resolver emulator suites pass.
  - The 2b/2c regression checks pass: role secrecy, the Mafia unanimous kill, the Doctor cancel, the Detective result, day tie/Skip, Town/Mafia wins, the chat rules, Play Again.
  - There is no `Math.random`.
- **Depends on:** all

---

## Progress

*(filled in as tasks complete)*
