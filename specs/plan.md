# plan.md — Mafia Wars · Phase 1 Build Plan

This is the blueprint for building the Phase 1 app described in [spec.md](spec.md), under the constraints in [../CLAUDE.md](../CLAUDE.md). No app code yet.

## Approach in one paragraph

A single-page experience built with Next.js App Router. There is one route (`/`) that renders a state machine: the app holds a "current screen" value in memory and swaps between Home, Configure Roles, Reveal, and All Done. There is no routing per screen and no server work — everything is client-side, in memory, and resets on refresh, exactly as the spec requires. Shared game state lives in one React context. Role assignment is a small pure module that uses `crypto.getRandomValues` for the shuffle.

## Project structure

```
mafia-wars/
├── CLAUDE.md
├── specs/
│   ├── spec.md
│   └── plan.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── app/
│   ├── layout.tsx          # Root HTML shell, imports global CSS, sets viewport (portrait-first, mobile-friendly)
│   ├── globals.css         # Tailwind directives + a few base styles
│   └── page.tsx            # The only route. Mounts GameProvider and renders the current screen
├── components/
│   ├── GameProvider.tsx    # React context: all in-memory game state + actions (see "State")
│   ├── screens/
│   │   ├── HomeScreen.tsx        # Title, editable host name, START, ROLES (FR-1)
│   │   ├── ConfigureRolesScreen.tsx  # Role list + steppers + Total Players + Add Custom Role (FR-2..FR-6)
│   │   ├── RevealScreen.tsx      # Hidden card → tap to reveal → Next (FR-8, FR-9)
│   │   └── AllDoneScreen.tsx     # Confirmation + return Home (FR-10)
│   └── ui/
│       ├── BackArrow.tsx        # Top-left back control; takes an onBack handler (FR-11)
│       ├── RoleStepper.tsx      # One row: minus / count / plus, with caps + removable flag (FR-2, FR-4)
│       └── ConfirmDialog.tsx    # Simple yes/no modal, used by the reveal back arrow (FR-11)
└── lib/
    ├── roles.ts            # Standard role definitions, default counts, caps (FR-3, FR-4)
    ├── assignment.ts       # buildAssignment(): expand counts → secure shuffle → player slots (FR-7)
    ├── shuffle.ts          # secureShuffle(): Fisher–Yates using crypto.getRandomValues (no Math.random)
    └── validation.ts       # canStart() + the reason string for a disabled START (Edge Cases)
```

Notes:
- `components/` and `lib/` sit outside `app/` so they're plainly not routes. Screens are dumb-ish views; logic lives in `lib/` and `GameProvider`.
- Everything that touches state or `crypto` is a Client Component (`"use client"`). `layout.tsx` stays a Server Component; `page.tsx` is a thin client entry that mounts the provider.

## Screens and navigation

One in-memory `screen` value drives what renders. No URL changes between screens (keeps Phase 1 trivially offline and refresh = reset).

```
Home ──START──▶ Reveal ──Next×N──▶ All Done ──Home──▶ Home
  │                 ▲                    │
  └──ROLES──▶ Configure Roles ──START────┘ (START lives on Configure too, per scenario)
        ▲              │
        └──back arrow──┘
```

- **Home → Configure Roles**: ROLES button.
- **Home / Configure Roles → Reveal**: START (only enabled when valid; see Validation). START runs the assignment and sets reveal progress to player 1.
- **Configure Roles → Home**: top-left back arrow (Acceptance Criteria: "back arrow on Configure Roles returns to Home").
- **Reveal → All Done**: after the last player taps Next.
- **Reveal → Home**: back arrow, but only after the ConfirmDialog is accepted; this ends the reveal. Browser/hardware Back is wired to the same "end reveal" outcome via a history guard (see Open Questions for the one detail I want to confirm).
- **All Done → Home**: the return/fresh-setup button. Role config and host name survive (in-memory, per session); only a refresh clears them.

Reveal sub-states (held in the provider, not separate screens): `hidden` (showing "Player X of N" + pass prompt + "Click to see the role") and `shown` (role name + Next). Tapping the card flips `hidden → shown`; Next advances the player index and resets to `hidden`.

## Game state (in memory only)

All of it lives in `GameProvider` via `useReducer` (a small explicit action set reads better than scattered `useState`). Nothing is written to `localStorage`, cookies, or a server — refresh wipes it, per the spec.

State shape (conceptual):
```
{
  screen: 'home' | 'configure' | 'reveal' | 'allDone',
  hostName: string,                    // editable on Home, default "Host"
  roles: Array<{                       // standard + custom, in display order
    id: string,
    name: string,
    count: number,
    cap: number,                       // 20 standard non-civilian / 100 civilian / 20 custom
    isStandard: boolean,               // standard can't be removed, only stepped to 0
  }>,
  assignment: string[] | null,         // role name per player slot, set by START, cleared on exit
  revealIndex: number,                 // which player (0-based)
  revealShown: boolean,                // hidden vs shown for the current player
}
```

Derived (computed, not stored): `totalPlayers` = sum of counts; `canStart` + `disabledReason` from `lib/validation.ts`.

Actions exposed by the provider: `setHostName`, `incRole`/`decRole` (respect caps and 0 floor), `addCustomRole(name)` (trim, 24-char cap, case-insensitive duplicate block, starts at count 1), `removeCustomRole(id)`, `start()` (validate → build assignment → go to reveal), `revealCurrent()`, `nextPlayer()` (advance or → All Done), `endReveal()` (clear assignment → Home), `goHome()`, `goConfigure()`.

## Role assignment & the secure shuffle

Lives in `lib/`, kept as pure functions so it's easy to read and (later) test.

- `lib/assignment.ts` — `buildAssignment(roles)`:
  1. Expand counts into a flat array: `2 Mafia, 1 Detective, …` → `['Mafia','Mafia','Detective', …]`. Length = Total Players, so counts are honoured exactly (FR-7).
  2. Return `secureShuffle(flat)`. Each array index = one anonymous player slot.

- `lib/shuffle.ts` — `secureShuffle(items)`: a standard **Fisher–Yates** shuffle where each random index comes from `crypto.getRandomValues`, **never `Math.random`** (CLAUDE.md hard rule, FR-7).
  - For each position `i` from `n-1` down to `1`, pick `j` uniformly in `[0, i]` and swap.
  - To get an unbiased `j` in `[0, i]`: draw a `Uint32` from `crypto.getRandomValues` and **reject** values in the small remainder zone that would skew the modulo, redrawing until one is in range. Rejection sampling keeps every ordering equally likely (the "can't be guessed or reproduced" requirement).
  - `crypto` here is the Web Crypto API, available in the browser and in modern Node — no dependency needed.

Because the shuffle reseeds from the OS CSPRNG each call, running START repeatedly on the same setup yields different orderings (Acceptance Criteria) without us storing or exposing a seed.

## Validation

`lib/validation.ts` — `evaluateSetup(roles)` returns `{ canStart, reason }`:
- `canStart` requires `totalPlayers >= 3` **and** Mafia count `>= 1` **and** at least one non-Mafia role with count `>= 1` (a custom role qualifies — per Resolved Decisions).
- `reason` is the first unmet rule as a short string ("Need at least 3 players" / "Need at least 1 Mafia" / "Need at least one non-Mafia role"), shown beside the greyed START button. START stays disabled, so the reason is informational only.

Steppers enforce their own bounds (minus at 0 and plus at cap are no-ops) so state can't reach an invalid count in the first place.

## Libraries beyond Next / React / Tailwind

**None planned.** Rationale:
- Shuffle/randomness → Web Crypto (`crypto.getRandomValues`), built in. Adding a crypto lib would violate "prefer well-known libraries… but no new deps without proposing."
- State → React context + `useReducer`, built in. No Redux/Zustand needed for four screens of in-memory state.
- Confirm dialog & steppers → small in-house components with Tailwind. No UI kit warranted at this size.
- IDs for custom roles → `crypto.randomUUID()` (built in), not a uuid package.

If anything later genuinely needs a dependency (e.g. a test runner when we add tests), I'll propose it first per CLAUDE.md rather than adding it here.

## How this maps to the Acceptance Criteria

| Acceptance criterion | Where it's satisfied |
| --- | --- |
| 2/1/1/6 setup shows Total Players: 10 | `totalPlayers` derived sum in ConfigureRolesScreen (FR-5) |
| START yields exactly those role counts across reveals | `buildAssignment` expands counts 1:1 before shuffling (FR-7) |
| Each reveal starts hidden, reveals on tap, advances only via Next | RevealScreen `hidden`/`shown` sub-states + `nextPlayer` (FR-8) |
| Revealed role hidden after Next | `nextPlayer` resets `revealShown=false` (FR-9) |
| Card shows only the role name | RevealScreen renders the bare name, no surrounding copy (FR-8) |
| All Done after last player | `nextPlayer` at last index → `screen='allDone'` (FR-10) |
| Custom role added, counted, included | `addCustomRole` + same expansion path as standard roles (FR-6, FR-7) |
| START blocked at 0 Mafia / <3 players | `evaluateSetup` disables START (Edge Cases) |
| Repeated START → different orderings | `secureShuffle` reseeds from the CSPRNG each call |
| Back arrow on Configure returns Home | BackArrow → `goHome()` in ConfigureRolesScreen (FR-11) |

A lightweight manual test pass on a phone browser and a desktop browser will confirm the "works in both" definition of done; automated tests are out of scope unless we decide to add a runner (which I'd propose first).

## Settled interaction details

These three were previously open; they are now decided and reflected in the structure above (and in [spec.md](spec.md) where they tighten a requirement).

1. **Browser/hardware Back during reveal.** On entering the reveal we push a history entry and listen for `popstate`. Behaviour is two-step and never ends the reveal in a single press while a dialog is showing:
   - If the confirm dialog is **open**, Back closes the dialog (and re-pushes the guard entry so a later Back still works) — the reveal continues.
   - If **no** dialog is open, Back opens the "End reveal and return Home?" confirm. Ending only happens when that confirm is accepted, which then runs `endReveal()`.
   This mirrors the in-app back arrow exactly: arrow and Back both lead through the same confirm.
2. **Add Custom Role input.** An **inline** text field + Add button on the Configure Roles screen — no modal, no extra screen. (Reflected in `ConfigureRolesScreen.tsx` above.)
3. **Tapping an already-revealed card does nothing.** Only the "Next" button advances. The card is interactive only in the `hidden` sub-state (tap to reveal); in `shown` it is inert. (Reflected in `RevealScreen.tsx`/FR-8.)
