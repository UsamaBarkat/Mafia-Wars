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

All 8 tasks were built in one autonomous pass, at the user's explicit request ("build Slice 2d end to end, autonomously"). That overrides CLAUDE.md's usual one-task-then-review rhythm for this slice only. Each task was still committed separately for review.

- ✅ **Task 1 — Data model & paths.** `WinnerTeam` gains `"jester"`, `NightActionKind` gains `"link"` and `NightAction.secondTargetUid`, the outcomes gain `eliminatedUids`, and there is a new `LoversEntry` type plus `roomPaths.lovers`/`loversEntry`.
- ✅ **Task 2 — Security Rules.** `scripts/verify-2d-rules.ts` passes **63/63** against the emulator, with 8 real signed-in identities.
  - **Cupid happy path:** the link and the lovers entries write atomically, and each lover reads only their own entry.
  - **Lovers secrecy:** each of these is denied reading a lover's entry: the other lover, another player, a Mafia, a spectator, Cupid, and the moderator. The moderator and players are also denied the whole `lovers` node.
  - **Denied link writes:** changing or deleting the link, an extra mismatched pair, a self-pick, the same player twice, a dead target, a role disguise, a missing reciprocal entry, lovers without an action, a non-Cupid link, Mafia writing lovers, a moderator link, a link on Night 2, rounds/1 written during Night 2, a dead Cupid, and a link during the day.
  - **Winner and outcomes:** `jester` is accepted, a bogus winner value is rejected, and the `eliminatedUids` shape is accepted or rejected as expected.
  - **Play Again:** the moderator clears `lovers`, and a non-moderator is denied.
  - **2b/2c regressions:**
    - A server-time kill pick is accepted, a changed pick is accepted, and an old client's `Date.now()` pick is still accepted.
    - The Mafia-teammate read still works, and non-Mafia can't read Mafia picks.
    - Dead players can't act, and players can't write another player's action.
    - An unknown action is rejected.
    - `privateRoles` stays own-only, with moderator read intact. Players can't read the `nightActions` parent.
    - No votes at night. No self-revive.
    - `publicRoles` is gated to game end.
    - The `mafiaChat`/`dayChat` gates still hold.
- ✅ **Task 3 — Pure logic.** `scripts/verify-2d-logic.ts` passes **64/64**. It covers:
  - the 2b cases: unanimous kill, disagreement, Doctor cancel, Detective, out-of-role fakes, tie/Skip, wins;
  - Cupid pair extraction, including no picks and invalid links;
  - lover chains and loops, a Doctor saving a lover, the Doctor protecting a partner, and a Night‑1 link applying immediately;
  - Granny: first pick, changed pick, solo Mafia, Doctor save, disagreement, Doctor protecting the chosen Mafia, Granny as a lover, Granny's Mafia as a lover, voted out, dying as a lover, and the tie-break (both injected and secure);
  - Jester: override, few players left, override of a simultaneous Town win, killed at night, dying as a lover, parity, everyone dead.
- ✅ **Task 4 — Wiring.** `scripts/verify-2d-resolvers.ts` passes **40/40** by driving the real exported functions against the emulator. It covers:
  - the real `submitCupidLink` and `submitNightAction` (server timestamps confirmed);
  - lovers dying in one atomic write;
  - a Doctor save;
  - Granny + first Mafia + that Mafia's lover;
  - Granny's changed-pick rule;
  - a solo-Mafia Granny night ending in a Town win, with `publicRoles` written;
  - a Jester win overriding a Town win, and a Jester win with 3 players left;
  - a day lover chain causing a Mafia parity win;
  - 2b regressions through the real `beginNight1` and resolvers;
  - Cupid with no pick;
  - Play Again clearing `lovers` and `rounds` (a second reset also succeeds);
  - the role-config seed and backfill.
- ✅ **Task 5 — Role config.** Online seed plus backfill of Jester/Cupid/Granny (count 0, cap 20, non-removable). Built-in names are reserved for custom roles. Phase 1's `createDefaultRoles` is untouched.
- ✅ **Task 6 — Night UI.**
  - `CupidPicker` (confirm-once).
  - The Cupid branch in `NightScreen`, which waits for the saved link to load before showing the picker.
  - The private 💘 partner line.
  - Re-tapping the current pick does nothing.
  - The moderator counter includes Cupid on Night 1 only.
- ✅ **Task 7 — Reveal/outcomes/game-over.**
  - Shared `lib/roleInfo.ts`; Phase 1's reveal output is unchanged.
  - The online reveal shows the icon and description card.
  - Multi-death night outcomes, sorted by name. The day outcome adds an "also eliminated" line.
  - "The Jester wins!"
- ✅ **Task 8 — Verification.**
  - `tsc --noEmit` and `next build` are clean.
  - All three suites pass (167/167 total).
  - No `Math.random`.
  - **Not done:** real multi-browser or phone UI testing (no browser in this session), so manual playtesting is still needed. Also, the pre-existing `TEMP DEBUG` `console.log`s in `NightScreen.tsx`/`subscriptions.ts` (from the Mafia-warning investigation) were left untouched on purpose.

### Status

**Follow-up session (2026-10-27):**

- **Mafia "haven't agreed" warning fixed.** The `nightActions/$uid` read rule now checks both players' `privateRoles`, not the pick's own contents. Before the fix, a teammate listener attached before the pick existed was denied and cancelled for good. `verify-2d-rules.ts` gained 9 checks for this; all three suites now pass 176/176.
- **The temporary `[MAFIA-DEBUG]` `console.log`s are removed** from `NightScreen.tsx` and `subscriptions.ts`.
- **Playwright e2e suite added** (`npm run test:e2e`, emulator + `localhost:3000` only). It runs 5 real multi-browser games: a moderator plus 5 players, each in their own browser context. Covered:
  - Core loop: deal, night kill, day vote, Town win.
  - The Mafia disagreement warning appears, then clears once picks match.
  - Cupid picker and the private partner line; a lover death kills the partner.
  - Granny takes the first Mafia picker.
  - Jester vote-out → "The Jester wins!"
- Rules deployed to production; code pushed to `origin/main`.

**Granny rule change (2026-10-28, spec-2d D15 — replaces all earlier Granny designs):** the Mafia's agreed kill on Granny now kills the first Mafia picker *instead* of her; a Doctor on Granny doesn't stop it; a Doctor on that Mafia saves him and lets the kill on Granny through. `resolveNight.ts` changed (no rules change). Granny's card now reads "If the Mafia target you, one of them dies instead." Suites: logic 71/71, resolvers 51/51, rules 72/72 (194 total); e2e 5/5, with the Granny test now also checking her card and a day vote-out of her, and the Jester test confirming the built-in role card. Pushed as `07ede93`.

**Live bug (2026-10-28): "Granny and the first Mafia both eliminated".** Not a code bug in the current build: the emulator reproduction of the exact night (2 Mafia agree on Granny, no Cupid, no protect) kills only the first picker, and the deployed bundle contains the new resolver. The previous resolver (`6105e7a`) gives exactly the reported result, so the moderator's tab was running a build from before the deploy. Fix: the stale-build guard (spec-2d FR‑24a) — `lib/buildVersion.ts`, `app/version.json/route.ts`, `next.config.ts`, `ModeratorStarted.tsx`. Resolvers 54/54 (new S5g reproduction), e2e 6/6 (new stale-moderator test). Fix committed and pushed (`19eeff2`..`f33c568`).

**Still not covered by the e2e suite:** phone-sized layouts, the role icon/description cards, and the new role-config rows (only their counts are exercised).

~~**NEXT:** ask everyone in a live room to refresh.~~ ✅ Done — superseded by the moderator version guard and the playtest checklist below.

**Progress (2026-10-28):** Slice 2d is deployed: rules deployed and code pushed, including the final Granny rule and the moderator version guard.

**STILL TO DO:** live playtest with the built-in Jester, Cupid and Granny rows in a NEW room, with everyone refreshed first. Check:

- the Jester wins when voted out;
- Granny's first picker dies while Granny survives;
- the Mafia warning appears and clears;
- Cupid's lovers die together.

Cutie is deferred.
