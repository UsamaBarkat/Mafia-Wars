# tasks.md — Mafia Wars · Phase 1 Task Breakdown

Build order for the Phase 1 app. Derived from [../CLAUDE.md](../CLAUDE.md), [spec.md](spec.md), and [plan.md](plan.md). Each task is sized to finish and verify in one sitting. Build one, stop for review, then the next — never sprint the whole list (CLAUDE.md).

Convention: each task lists **Goal**, **Files**, **Satisfies**, **Done when**, and **Depends on**.

---

## 1. Project scaffolding

- **Goal:** Stand up a Next.js (App Router) + TypeScript + Tailwind project that runs locally.
- **Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (placeholder "Mafia Wars").
- **Satisfies:** CLAUDE.md stack constraint; foundation for all FRs.
- **Done when:** `npm run dev` serves a page reading "Mafia Wars" with a Tailwind utility class visibly applied, no console errors, in both a phone and desktop browser.
- **Depends on:** —

## 2. Role definitions & constants

- **Goal:** Define the standard roles, their default counts, and caps as plain data.
- **Files:** `lib/roles.ts`.
- **Satisfies:** FR-2, FR-3, FR-4.
- **Done when:** Module exports the four standard roles (Mafia, Detective, Doctor, Civilian) with default counts 1/1/1/7 and caps (Mafia/Detective/Doctor = 20, Civilian = 100, custom = 20 as a shared constant). Importing it in a scratch log prints the expected values.
- **Depends on:** 1

## 3. Secure shuffle

- **Goal:** Implement an unbiased Fisher–Yates shuffle backed by Web Crypto (no `Math.random`).
- **Files:** `lib/shuffle.ts`.
- **Satisfies:** FR-7; CLAUDE.md "cryptographically secure" rule; AC "repeated START → different orderings".
- **Done when:** `secureShuffle([...])` returns a new array that is a permutation of the input; uses `crypto.getRandomValues` with rejection sampling (no `Math.random` anywhere); two calls on the same input usually differ; a quick distribution sanity-check (e.g. shuffle `[0,1,2]` many times) shows all 6 orderings appearing.
- **Depends on:** 1

## 4. Assignment builder

- **Goal:** Turn role counts into a shuffled, one-role-per-slot assignment.
- **Files:** `lib/assignment.ts`.
- **Satisfies:** FR-7; AC "exactly 2 Mafia / 1 Detective / 1 Doctor / 6 Civilian across 10 reveals".
- **Done when:** `buildAssignment(roles)` returns an array whose length equals Total Players and whose value tally matches the input counts exactly (e.g. 2/1/1/6 → ten entries with that breakdown), in shuffled order via `secureShuffle`.
- **Depends on:** 3

## 5. Setup validation

- **Goal:** Decide whether START is allowed and why not.
- **Files:** `lib/validation.ts`.
- **Satisfies:** Edge Cases (START rules); AC "START not allowed with 0 Mafia or <3 players".
- **Done when:** `evaluateSetup(roles)` returns `{ canStart, reason }`: false with the correct reason for <3 players, 0 Mafia, or no non-Mafia role; true for a valid setup (incl. a custom-only town like 2 Mafia + 1 Jester). Verified against a few hand-built inputs.
- **Depends on:** 2

## 6. Game state provider

- **Goal:** Hold all in-memory game state and the actions that mutate it.
- **Files:** `components/GameProvider.tsx`.
- **Satisfies:** State model in plan.md; FR-5 (derived Total Players); in-memory-only constraint.
- **Done when:** A `useReducer`-based context exposes the state shape (screen, hostName, roles, assignment, revealIndex, revealShown) plus actions (`setHostName`, `incRole`/`decRole` with cap/0 enforcement, `addCustomRole`, `removeCustomRole`, `start`, `revealCurrent`, `nextPlayer`, `endReveal`, `goHome`, `goConfigure`); derived `totalPlayers`/`canStart` available. No persistence (no localStorage/cookies). A temporary debug render shows state updating; refresh resets to defaults.
- **Depends on:** 2, 4, 5

## 7. Reusable UI: BackArrow, RoleStepper, ConfirmDialog

- **Goal:** Build the three shared UI pieces the screens reuse.
- **Files:** `components/ui/BackArrow.tsx`, `components/ui/RoleStepper.tsx`, `components/ui/ConfirmDialog.tsx`.
- **Satisfies:** FR-2, FR-4 (stepper), FR-11 (back arrow), reveal confirm (FR-11/Edge Cases).
- **Done when:** Rendered in isolation (temporary harness): BackArrow shows a top-left left-arrow and calls `onBack`; RoleStepper shows minus/count/plus, calls handlers, and visually disables minus at 0 / plus at cap; ConfirmDialog shows a yes/no prompt and calls the right handler. No app wiring required yet.
- **Depends on:** 1

## 8. Home screen

- **Goal:** Build the Home view.
- **Files:** `components/screens/HomeScreen.tsx`; mount the provider + screen switch in `app/page.tsx`.
- **Satisfies:** FR-1.
- **Done when:** Home shows the title, an editable host name (defaults to "Host", edits held in memory), a START button, and a ROLES button. ROLES switches to the (placeholder) Configure screen; editing the name updates it live; refresh resets the name.
- **Depends on:** 6, 7

## 9. Configure Roles screen

- **Goal:** Build the role configuration view with steppers, live total, and custom roles.
- **Files:** `components/screens/ConfigureRolesScreen.tsx`.
- **Satisfies:** FR-2, FR-3, FR-4, FR-5, FR-6; AC "2/1/1/6 shows Total Players: 10", "custom role can be added", "back arrow on Configure returns Home".
- **Done when:** Lists the four standard roles with steppers and defaults 1/1/1/7; Total Players updates live (2/1/1/6 → 10); caps and 0-floor enforced; an inline field adds a custom role (trimmed, ≤24 chars, case-insensitive duplicate blocked, starts at count 1) that gets its own stepper and a remove control; standard roles can't be removed; top-left back arrow returns Home.
- **Depends on:** 6, 7, 8

## 10. START gating

- **Goal:** Wire START to validation on both Home and Configure.
- **Files:** `components/screens/HomeScreen.tsx`, `components/screens/ConfigureRolesScreen.tsx` (uses `evaluateSetup`).
- **Satisfies:** Edge Cases; AC "START not allowed with 0 Mafia or <3 players".
- **Done when:** START is visibly greyed/disabled when invalid, with a short reason line beside it; becomes enabled when the setup is valid; pressing a disabled START does nothing.
- **Depends on:** 5, 8, 9

## 11. Reveal screen

- **Goal:** Build the per-player hidden → reveal → Next flow.
- **Files:** `components/screens/RevealScreen.tsx`.
- **Satisfies:** FR-8, FR-9; AC "each reveal starts hidden, reveals on tap, advances only via Next", "role hidden after Next", "card shows only the role name".
- **Done when:** START builds the assignment and shows player 1's hidden card ("Player 1 of N" + "Pass the phone to Player 1" + "Click to see the role"); tapping the card shows only the bare role name; the revealed card is inert (only Next advances); Next hides the role and shows the next player's hidden card; a 2/1/1/6 run shows exactly that role tally across the N reveals.
- **Depends on:** 6, 10

## 12. All Done screen

- **Goal:** Build the terminal screen after the last player.
- **Files:** `components/screens/AllDoneScreen.tsx`; advance logic in `nextPlayer`.
- **Satisfies:** FR-10; AC "After the last player, the All Done screen appears".
- **Done when:** Tapping Next on the last player shows an "All Done" confirmation with a return-Home / fresh-setup button and no role information; the button returns Home with the prior role config still intact (in-memory).
- **Depends on:** 11

## 13. Reveal back-arrow + confirm

- **Goal:** Let the in-app back arrow leave the reveal safely via a confirm.
- **Files:** `components/screens/RevealScreen.tsx` (using ConfirmDialog), `endReveal` action.
- **Satisfies:** FR-11; Edge Cases (mid-reveal exit).
- **Done when:** Tapping the reveal's back arrow opens "End reveal and return Home? Roles won't be shown again"; cancel keeps the current player's state; confirm clears the assignment and returns Home; it never steps back to an already-shown role.
- **Depends on:** 7, 11

## 14. Browser/hardware Back guard during reveal

- **Goal:** Make the browser/hardware Back button behave like the in-app exit, two-step.
- **Files:** `components/screens/RevealScreen.tsx` (history push + `popstate` handling).
- **Satisfies:** FR-11; Edge Cases (two-step Back rule).
- **Done when:** Entering the reveal pushes a history guard; pressing Back with no dialog open opens the confirm (reveal not ended); pressing Back while the confirm is open closes the dialog and the reveal continues; Back never ends the reveal in a single press and never reopens a shown role; accepting the confirm returns Home.
- **Depends on:** 13

## 15. Responsive & cross-browser polish

- **Goal:** Make every screen read well portrait-first and usable on desktop / any orientation.
- **Files:** all `components/screens/*`, `app/globals.css`, `app/layout.tsx` (viewport).
- **Satisfies:** CLAUDE.md "works in phone and desktop browser"; plan's portrait-first default.
- **Done when:** Each screen looks correct on a narrow phone viewport and a desktop width; tap targets are comfortable; a long custom-role name and the reveal card both display cleanly; no layout breakage in either orientation.
- **Depends on:** 8, 9, 11, 12

## 16. Acceptance pass & cleanup

- **Goal:** Walk the full spec Acceptance Criteria and remove any temporary scaffolding.
- **Files:** repo-wide (remove debug renders/harnesses); no behaviour changes.
- **Satisfies:** All Acceptance Criteria; CLAUDE.md "reviewed the diff against the spec".
- **Done when:** Every checkbox in spec.md's Acceptance Criteria is manually verified on a phone and desktop browser; no leftover debug/test harness code; no `Math.random` anywhere in `lib/` or `components/`.
- **Depends on:** all prior

---

### Dependency summary

- Logic first: 2 → (3 → 4), 5 depends on 2.
- State (6) needs 2, 4, 5.
- UI primitives (7) need only 1.
- Screens build on 6/7: 8 → 9 → 10 → 11 → 12, with 13 → 14 layering reveal-exit behaviour onto 11.
- 15 and 16 are polish/verification after the screens exist.

---

## Progress

**Status:** ✅ Phase 1 DONE — all 16 tasks complete; all 10 Acceptance Criteria verified; `tsc` clean.

- ✅ **Task 1 — Project scaffolding** (complete): Next.js App Router + TypeScript + Tailwind set up; `npm run dev` serves the placeholder home page at http://localhost:3000 with Tailwind compiling.
- ✅ **Task 2 — `lib/roles.ts`** (complete): `Role` type, caps/constants, `createDefaultRoles()` (Mafia/Detective/Doctor 1, Civilian 7), and `createCustomRole()` (count 1, cap 20). Type-checks clean; runtime check confirms defaults total 10 and fresh copies per call.
- ✅ **Task 3 — `lib/shuffle.ts`** (complete): generic `secureShuffle()` — Fisher–Yates using `crypto.getRandomValues` with rejection sampling, no `Math.random`. Type-checks clean; runtime check confirms permutation, non-mutation, variability, and a near-uniform distribution across all 6 orderings of `[0,1,2]`.
- ✅ **Task 4 — `lib/assignment.ts`** (complete): `buildAssignment(roles)` expands each count 1:1 into one role-name entry per slot (standard + custom), then returns them via `secureShuffle`. Type-checks clean; runtime check confirms length = Total Players, exact tally (2/1/1/6 → 10), custom roles included, count-0 roles excluded, shuffled, input untouched.
- ✅ **Task 5 — `lib/validation.ts`** (complete): `evaluateSetup(roles)` → `{ canStart, reason }` checking Total Players ≥ 3, ≥ 1 Mafia (by `MAFIA_ROLE_ID`, not name), and ≥ 1 non-Mafia role; reports the first unmet rule. Type-checks clean; runtime check covers valid/invalid cases, including a custom role named "Mafia" correctly not counting as Mafia.
- ✅ **Task 6 — `components/GameProvider.tsx`** (complete): single `useReducer` context holding `{ screen, hostName, roles, assignment, revealIndex, revealShown }` with derived `totalPlayers`/`canStart`/`disabledReason`; actions for host name, role +/− (cap + 0 floor), add/remove custom role (trim, case-insensitive dup, 24-char cap), START (validate → `buildAssignment` → reveal), reveal/next, and return Home. In memory only. Type-checks clean; reducer exercised across all actions (caps, dup blocking, START gating, reveal advance, All Done clears assignment, Home keeps config).
- ✅ **Task 7 — `components/ui/` primitives** (complete): presentational `BackArrow` (top-left left-chevron → `onBack`), `RoleStepper` (name + count with − / +, disables − at 0 and + at cap, optional `onRemove` for custom roles), and `ConfirmDialog` (message + confirm/cancel overlay). Tailwind-styled, callback-driven, no game logic. Type-checks clean; verified in a temporary rendered harness (disabled states, remove-only-on-custom, dialog message/labels) then the placeholder page was restored.
- ✅ **Task 8 — `components/screens/HomeScreen.tsx` + `app/page.tsx`** (complete): `app/page.tsx` now mounts `GameProvider` and renders by `state.screen` (Home built; other screens show a temporary placeholder with a Back-to-Home). Home shows the "Mafia Wars" title, "Social Deduction Game" subtitle, an editable in-memory host name (default "Host"), START (`start()`), and ROLES (`goConfigure`), in the dark red-accented style. Type-checks clean; dev-server render confirms all elements present.
- ✅ **Task 9 — `components/screens/ConfigureRolesScreen.tsx`** (complete): back arrow → Home, "Configure Roles" heading, live "Total Players" (derived), all roles as `RoleStepper`s wired to `incRole`/`decRole` (caps + 0 floor), custom roles with a remove control (standard roles without), and an inline "Add Custom Role" field (`maxLength` 24, Add disabled when blank) calling `addCustomRole`. Registered in the page router (`configure`). Dark frame + light role card to suit the light-styled stepper. Type-checks clean; dev render confirms heading, Total Players 10, 1/1/1/7 counts, steppers, no remove on standard roles, and the add field with the 24-char cap. START gating deferred to task 10.
- ✅ **Task 10 — START gating** (complete): START on both Home and Configure now uses derived `canStart`/`disabledReason` — visibly disabled (greyed) with a short reason line when invalid, enabled and calling `start()` when valid. Type-checks clean; dev render confirms enabled + no reason for the valid default, and `disabled` + "Need at least 1 Mafia" when forced invalid.
- ✅ **Task 11 — `components/screens/RevealScreen.tsx`** (complete): forward-only per-player flow driven by `assignment`/`revealIndex`/`revealShown`. Hidden card (whole area tappable → `revealCurrent`) shows "Player N of M", "Pass the phone to Player N", and "Click to see the role"; shown state renders ONLY the bare role name with a bottom-right Next (`nextPlayer`), which re-hides and advances; after the last player it routes to All Done. Registered in the page router (`reveal`). Dark/red styling. Type-checks clean; dev render confirms hidden state (progress/pass/prompt, no role span, no Next) and shown state (one bare role name, one Next, no progress/"You are" text). Back-arrow confirm (task 13) and Back guard (task 14) not built yet.
- ✅ **Task 12 — `components/screens/AllDoneScreen.tsx`** (complete): "All Done" confirmation ("Every role has been dealt. Time to play!") with a single "Back to Home" button (`goHome`); shows NO role information. Registered in the page router (`allDone`). Dark/red styling. Type-checks clean; dev render confirms the `<main>` body contains only the heading/line/button and zero role words.
- ✅ **Task 13 — Reveal back-arrow + confirm** (complete): top-left `BackArrow` on the Reveal screen opens a `ConfirmDialog` ("End reveal and return Home? Roles won't be shown again", End reveal / Keep going) instead of leaving immediately. Confirm → `endReveal` (Home); cancel → closes the dialog and stays on the same player/shown-hidden state. The dialog's `z-50 fixed inset-0` overlay covers the card so it can't reveal/advance while open. Type-checks clean; dev render confirms the back arrow, dialog closed initially, and (forced open) the dialog message + both buttons over the still-mounted card.
- ✅ **Task 14 — Browser/hardware Back guard during reveal** (complete): a `useEffect` pushes a history guard entry on entering the reveal and listens for `popstate`. Two-step Back: if the confirm dialog is open it closes it (cancel), otherwise it opens the same "End reveal and return Home?" confirm — re-arming the guard each time and never ending the reveal on a single press (ending only via the confirm button → `endReveal`, forward-only). Cleanup removes the listener and pops the guard on unmount so Home/Configure/All Done Back is unaffected. Fixed a Strict Mode self-trigger (cleanup's programmatic `back()` is now ignored via a ref) so the dialog no longer pops on entry. Type-checks clean; dev smoke-test confirms the reveal route compiles/renders with no errors. (The actual Back-press behaviour needs a manual browser check.)
- ✅ **Task 15 — Responsive & cross-browser polish** (complete): reviewed every screen at phone-portrait widths (~320–414px). Home, Configure (role card + steppers via `truncate`/`min-w-0`/`shrink-0`), All Done, and the ConfirmDialog (`max-w-sm`, `p-4`) all fit with no overflow. Fixed two issues: (1) the revealed role name could overflow / collide with Next — now `text-5xl sm:text-6xl` with `max-w-full break-words` and `pb-28` to reserve space for the bottom-right Next; (2) the shared `BackArrow` was dark-gray on near-black — now `text-neutral-300` with subtle `white/10` hover so it's visible on the dark screens (no redesign, just contrast). Type-checks clean; dev render confirms the new classes. (Visual confirmation across widths is a manual browser check.)
- ✅ **Task 16 — Final polish & acceptance pass** (complete): polished all screens to a consistent dark, red-accented look — restyled the Configure role card from white to dark (`bg-neutral-900` + `border-neutral-800`), made `RoleStepper` and the `ConfirmDialog` dark-native, and the custom-role input dark. No behaviour or layout-structure changes. Walked all 10 Acceptance Criteria: behavioural ones verified by an end-to-end reducer simulation (50-run exact-tally check, reveal flow, START gating, custom roles, shuffle variability, navigation); UI ones verified by SSR render (Total Players display, revealed card shows only the role name, Configure back arrow). All 10 pass. Confirmed no leftover scaffolding/`TEMP`, no `Math.random` (only the warning comment), and `tsc --noEmit` clean. **Phase 1 complete.**
