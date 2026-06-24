# spec.md — Mafia Wars · Phase 1 (Offline Role Setup & Reveal)

## Goal

A single-device web app that lets a host configure a Mafia game's roles, randomly assign them to players, and reveal each player's role privately by passing the phone — ending on an "All Done" screen. No internet, no accounts. It replaces the manual card-dealing step of in-person Mafia. (The online version is Phase 2.)

## User Scenarios

- A host opens the app, taps ROLES, sets 2 Mafia / 1 Detective / 1 Doctor / 6 Civilian (Total Players: 10), goes back, and taps START.
- The app shuffles the 10 roles and shows the first reveal: a hidden screen reading "Click to see the role."
- A player taps, sees just the role name — Mafia — then taps Next. The phone is passed, and the next player sees a fresh hidden "Click to see the role" screen.
- After the 10th player taps Next, an All Done screen appears and in-person play begins.
- A host taps "Add Custom Role," types "Jester," gives it a count, and it joins the random assignment exactly like a standard role.

## Functional Requirements

- FR-1 — Home screen shows the title, a START button, a ROLES button, and the host's display name. The display name is editable on Home, kept in memory only, and resets to a default (e.g. "Host") on refresh.
- FR-2 — ROLES screen lists the standard roles (Mafia, Detective, Doctor, Civilian), each with a minus / count / plus stepper.
- FR-3 — Default counts: Mafia 1, Detective 1, Doctor 1, Civilian 7.
- FR-4 — Caps: Mafia, Detective, and Doctor max out at 20 each; Civilian maxes at 100. No count goes below 0.
- FR-5 — "Total Players" always equals the sum of all role counts and updates live as counts change.
- FR-6 — "Add Custom Role" lets the host type a name (max 24 characters); the new role appears at count 1 with its own stepper (same behaviour as a standard role, with its count capped at 20) and can be removed. Standard roles cannot be removed — they can only be stepped down to 0.
- FR-7 — START randomly assigns exactly one role instance per player slot via a cryptographically secure shuffle (the result is unpredictable and can't be guessed or reproduced), so the counts are honoured exactly (2 Mafia means exactly 2 players are Mafia).
- FR-8 — The reveal runs one player at a time. The hidden screen shows the progress ("Player 3 of 10"), a pass prompt ("Pass the phone to Player 3"), and "Click to see the role." Tapping anywhere on the card reveals that player's role as just the role name (e.g. "Mafia"), with no extra wording like "You are…", and it stays visible until "Next" is tapped. Once revealed, the card is inert — tapping it again does nothing; only "Next" advances. A "Next" button (bottom-right) then advances to the next player's hidden screen. The button reads "Next" for every player, including the last.
- FR-9 — A revealed role is hidden again the moment "Next" is tapped. The reveal is forward-only — there is no going back to an already-shown role.
- FR-10 — After the last player taps "Next," an "All Done" screen appears: a simple confirmation plus a button to return Home / start a fresh setup. It shows no role information (no tally, no per-player recap) to preserve secrecy.
- FR-11 — A back arrow (left-pointing) sits in the top-left corner of every screen except Home, returning to the previous screen. During the reveal, tapping it first shows a confirm dialog ("End reveal and return Home? Roles won't be shown again"); confirming returns to Home and ends the reveal. It never steps back to an already-shown role, so roles stay secret.

## Edge Cases & Rules

- START is disabled unless Total Players >= 3 and Mafia >= 1 and at least one non-Mafia role exists; a custom role (count >= 1) counts as a non-Mafia role, so 2 Mafia + 1 Jester is valid. When disabled, START is visibly greyed and a short line states the unmet rule (e.g. "Need at least 3 players" / "Need at least 1 Mafia").
- Pressing minus on a role already at 0 does nothing; pressing plus at the cap does nothing.
- A custom role with an empty name can't be added; duplicate role names are blocked. The duplicate check trims surrounding whitespace and compares case-insensitively against both standard and existing custom roles (so "mafia" is rejected as a duplicate of "Mafia").
- Players are anonymous slots (Player 1…N). Each reveal screen shows progress like "Player 3 of 10" but no entered names.
- Closing or refreshing mid-reveal ends the reveal (no resume, no stepping back to a shown role); the host taps START again. The browser/hardware Back button is handled in two steps and never ends the reveal in a single press: if the confirm dialog is open, Back closes it and the reveal continues; if no dialog is open, Back opens the "End reveal and return Home?" confirm, and the reveal ends only when that is accepted. The app manages browser history so Back can never reopen an already-shown role.
- Role config (counts, custom roles) and the host's display name persist in memory for the life of the session — returning Home from "All Done" or via the back arrow keeps the setup — but nothing persists across a refresh or app close, which resets everything to defaults.

## Resolved Decisions

These resolve ambiguities surfaced during spec review. Where a decision tightened a requirement it is folded into the FR or Edge Case above; the rest are recorded here.

- **Reveal tap target** — the whole hidden card is tappable to reveal (not a small button), and the revealed role stays visible until "Next." (See FR-8.)
- **Mid-reveal exit** — the in-app back arrow confirms first; the browser/hardware Back button ends the reveal directly. Both return Home, end the reveal, and never reopen a shown role. (See FR-11 and Edge Cases.)
- **Custom roles are first-class** — same stepper, cap (20), and assignment behaviour as standard roles, and they satisfy the "non-Mafia role" validity check. They start at count 1 and can be removed; names are capped at 24 characters and matched case-insensitively after trimming.
- **Within-session state** — role config and host name live in memory and survive Home ↔ reveal navigation; only a refresh/close resets to defaults.

### Assumed defaults

- Standard roles cannot be removed from the list — they can only be stepped down to 0.
- The advance button reads "Next" for every player, including the last (which leads to "All Done").
- Layout is portrait-first (phone passing is the primary use) but remains usable in any orientation and on desktop.

## Out of Scope (Phase 1)

- Any online / multiplayer, rooms, lobbies, or accounts — that is Phase 2.
- Running the actual game (day/night cycle, voting, win detection).
- Custom-role team alignment or special abilities (added in Phase 2, where the game logic uses them).
- Saving/remembering setups, themes, sound, or animations.

## Acceptance Criteria

- [x] Setting 2 Mafia / 1 Detective / 1 Doctor / 6 Civilian shows Total Players: 10.
- [x] START with that setup produces exactly 2 Mafia, 1 Detective, 1 Doctor, and 6 Civilian across the 10 reveals.
- [x] Each reveal starts hidden, reveals only on tap, and advances only via "Next."
- [x] A revealed role is no longer visible after "Next" is tapped.
- [x] A revealed card shows only the role name (e.g. "Mafia") — no other words.
- [x] After the last player, the "All Done" screen appears.
- [x] A custom role can be added, given a count, and is included in the assignment.
- [x] START is not allowed with 0 Mafia or fewer than 3 total players.
- [x] Running START repeatedly on the same setup yields different role orderings (securely shuffled, not fixed).
- [x] The top-left back arrow on Configure Roles returns to Home.
