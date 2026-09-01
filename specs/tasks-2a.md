# tasks-2a.md — Mafia Wars · Phase 2 Slice 2a Task Breakdown

Build order for Slice 2a (online rooms, lobby & secret deal). Derived from [../CLAUDE.md](../CLAUDE.md), [spec-2a.md](spec-2a.md), and [research-phase2.md](research-phase2.md). Each task is sized to finish and verify in one sitting. Build one, stop for review, then the next — never sprint the whole list (CLAUDE.md).

Backend (settled): **Firebase, Spark/free, no Cloud Functions; Realtime Database (RTDB); Anonymous Auth; secret roles via Security Rules.** Reuse Phase 1 `lib/shuffle.ts` and the role model/validation ideas.

Convention per task: **Goal**, **Files**, **Satisfies**, **Done when**, **Depends on**.

> **Numbering note:** this list is renumbered 1–18 to match the sequence we actually built (the working order), which merged a few of the original planned sub-tasks. Status per task: ✅ done · ⬜ to do.

---

### Foundation & data layer

## 1. Propose & set up Firebase (dependency + project + RTDB + env config) — ✅ done

- **Goal:** Get an initialized Firebase app (Anonymous Auth + RTDB) wired to the Next.js app, with config read from environment variables.
- **Files:** propose in chat first; then `package.json` (add `firebase`), `lib/firebase.ts` (init app, export `auth`/`db`), `.env.local` (untracked), `.env.local.example` (placeholder keys, committed), emulator config.
- **Satisfies:** spec-2a "Backend (settled)"; CLAUDE.md "propose new deps before adding"; D-security (config is `NEXT_PUBLIC_*`, not a secret).
- **Done when:** `firebase` is proposed and approved, then installed; a Firebase project + RTDB instance (or the Emulator Suite) exist; `lib/firebase.ts` initializes from `NEXT_PUBLIC_FIREBASE_*` env vars; an anonymous sign-in + test read/write succeeds; `.env.local` is not tracked and the example has no real values. `tsc` clean.
- **Depends on:** — (first Phase 2 task)

## 2. Anonymous identity hook — ✅ done

- **Goal:** A stable per-browser identity available to the app.
- **Files:** `lib/useAuthUid.ts`, `components/AuthInit.tsx` (mounts it at the app root).
- **Satisfies:** spec-2a Foundation (Anonymous Auth as the backbone of all rules); FR-17 (persistent identity).
- **Done when:** on load the app signs in anonymously and exposes a stable `uid`; the same browser keeps the same `uid` across refreshes; two different browsers get different `uid`s.
- **Depends on:** 1

## 3. Room data model & path helpers — ✅ done

- **Goal:** One module defining the RTDB shape and typed path helpers for rooms.
- **Files:** `lib/room/paths.ts`, `lib/room/types.ts`.
- **Satisfies:** spec-2a §1 room model (`meta`, `config`, `players/{uid}`, `privateRoles/{uid}`, `chat`); single source of truth for paths.
- **Done when:** exports typed paths for `rooms/{code}`, `meta`, `config`, `players/{uid}`, `privateRoles/{uid}`, `chat`; TypeScript types for `RoomMeta`, `PlayerEntry`, `RoomConfig` (reusing the Phase 1 role shape); `privateRoles/{uid}` is a separate subtree so task 7 can enforce read-only-your-own-role. `tsc` clean; no UI.
- **Depends on:** 1

## 4. 6-digit code generation + atomic room creation — ✅ done

- **Goal:** Create a room under a unique 6-digit code, claimed atomically.
- **Files:** `lib/room/generateCode.ts`, `lib/room/createRoom.ts` (secure RNG via crypto).
- **Satisfies:** FR-4; spec-2a §1 codes; Edge "code format & collisions".
- **Done when:** `createRoom(uid)` generates a 6-digit numeric code via `crypto.getRandomValues`, **transaction-claims** `rooms/{code}/meta` only if absent (regenerates on collision), writes `meta` (status `lobby`, `moderatorId=uid`, timestamps). Returns the code. `tsc` clean.
- **Depends on:** 2, 3

## 5. Join / leave / presence operations — ✅ done

- **Goal:** Pure operations for joining a room by code, leaving, and presence.
- **Files:** `lib/room/joinRoom.ts`, `lib/room/leaveRoom.ts`, `lib/room/presence.ts`.
- **Satisfies:** FR-5, FR-7/FR-17 (presence, connected flag), Edge "atomic joins", D2 (block-when-full), D4 (names not unique).
- **Done when:** `joinRoom(code, uid, name)` rejects non-existent / not-`lobby` / full rooms (capacity via transaction) and otherwise writes `players/{uid}`; `presence` registers `onDisconnect` to flag disconnected + stamp `lastSeen`; `leaveRoom` frees the slot. `tsc` clean.
- **Depends on:** 4

---

### Online entry & security

## 6. Play Online entry + Online Mode (create + join flows) — ✅ done  _(merges the original entry / create-flow / join-flow tasks)_

- **Goal:** Reach online mode from Home; CREATE GAME (become moderator) or JOIN GAME by code; on success enter the Waiting Room.
- **Files:** `components/screens/HomeScreen.tsx` (add PLAY ONLINE), `components/screens/OnlineModeScreen.tsx`, `components/screens/WaitingRoomScreen.tsx` (shell), online state/router in `GameProvider`.
- **Satisfies:** FR-1, FR-2, FR-3 (name required, ≤24, dup-allowed), FR-4, FR-5, Edge "bad joins".
- **Done when:** Home shows PLAY ONLINE (Phase 1 START/ROLES unchanged); Online Mode has a name field, CREATE GAME, a 6-digit code input + JOIN GAME, and a back arrow. CREATE calls `createRoom` → Waiting Room as moderator; JOIN validates the code (specific errors for wrong/nonexistent/started/full) → Waiting Room as player. `tsc` clean.
- **Depends on:** 2, 4, 5

## 7. Security Rules — rooms, players, config, chat, **secret roles** — ✅ done

- **Goal:** RTDB Security Rules enforcing who-can-read/write, especially that a player reads only their **own** role.
- **Files:** `database.rules.json`.
- **Satisfies:** spec-2a "Security: secret roles" (FR-12/FR-13), FR-10 (only moderator writes config/status), FR-9 (chat shape/auth/length), D9 (no moderator role).
- **Done when:** `privateRoles/{uid}` is **readable only when `auth.uid === $uid`** (and not via the parent); only the moderator may write `config`, `meta.status`, and `privateRoles/*`; a player may write only their own `players/{uid}` and well-formed chat. **Verified:** a signed-in player is denied reading another player's role and the whole `privateRoles` node.
- **Depends on:** 3 (paths), 5 (the operations rules must permit)

---

### Live data & lobby

## 8. Live subscriptions — ✅ done

- **Goal:** Typed real-time listeners the UI will consume.
- **Files:** `lib/room/subscriptions.ts`.
- **Satisfies:** FR-7/FR-8 (live roster/count/config), FR-9 (chat stream), real-time everywhere.
- **Done when:** exports live hooks for meta/players/config-roles/own-role (and later chat) returning `{ data, loading, error }` with proper unsubscribe on unmount; a missing/removed room surfaces as `data: null`. `tsc` clean.
- **Depends on:** 3

## 9. Waiting Room — live roster + shareable code (copy) — ✅ done  _(merges the original waiting-room + copy-code tasks; copy-code is complete here)_

- **Goal:** Show the room live: shareable code with copy, who's in with connected/disconnected state, moderator excluded from the count; wire presence for joined players.
- **Files:** `WaitingRoomScreen.tsx`, presence hookup, copy helper.
- **Satisfies:** FR-6 (shareable, copy), FR-7, FR-17 (presence), D8 (disconnected shown, not instantly removed).
- **Done when:** large game code + working Copy; live roster/count updates on all clients within ~1–2s; the moderator is labeled and not counted; `setupPresence` is wired for joined players (closing a tab marks them disconnected, slot kept); moderator/player leave handled; room-removed handled gracefully. `tsc` clean.
- **Depends on:** 6, 7, 8

## 10. Lobby chat (send + live render) — ✅ done

- **Goal:** Real-time waiting-room chat for everyone in the room.
- **Files:** `components/online/Chat.tsx`, `lib/room/chat.ts`, `useRoomChat` in `subscriptions.ts`.
- **Satisfies:** FR-9, D7 (lobby-only), Edge "chat hygiene" (non-empty, length cap, recent window).
- **Done when:** a message from any member appears for all members in real time, ordered oldest→newest; empty/over-long messages are blocked (rule + client); only the last ~50 render. `tsc` clean.
- **Depends on:** 8, 9

---

### Config, start & deal

## 11. Moderator role configuration (reuse Phase 1 model) — ✅ done

- **Goal:** Moderator edits the room's role counts; everyone sees them live (read-only for players).
- **Files:** `components/online/RoleConfig.tsx` (reuse `RoleStepper`, `lib/roles.ts`), `lib/room/config.ts`.
- **Satisfies:** FR-8, FR-10 (Phase 1 caps/defaults/custom rules), only-moderator-writes (rules from 7).
- **Done when:** the moderator sees steppers (defaults 1/1/1/7, caps 20/20/20/100, add/remove custom, dup/empty blocked) writing to `config`; **Total Players Needed** updates live; players see the same config **read-only** (no steppers); a non-moderator write is rejected by rules.
- **Depends on:** 7, 8, 9

## 12. START gating (valid setup + exact player match) — ✅ done

- **Goal:** Enable START only when the setup is valid and joined players exactly equal Total Players Needed.
- **Files:** `WaitingRoomScreen.tsx`, reuse/extend `lib/validation.ts` for the online rule.
- **Satisfies:** FR-11; Edge "min players online" (moderator excluded), D2 (too-many message).
- **Done when:** START shows only for the moderator and is disabled with a short reason ("Need N more players" / "Too many players — add roles" / Phase 1 reasons) until valid **and** connected players == Total Players Needed; enabled exactly at the match. Verified across browsers.
- **Depends on:** 11

## 13. Secure deal on START (moderator-client dealing) — ✅ done

- **Goal:** On START, assign roles with a secure shuffle and write each to its private per-player node.
- **Files:** `lib/room/dealRoles.ts` (reuse `lib/shuffle.ts` + `lib/assignment.ts`), START handler.
- **Satisfies:** FR-12 (secure shuffle, counts exact, no `Math.random`), D9 (moderator gets no role), spec-2a Security (moderator-client deal).
- **Done when:** START builds the assignment over the **connected players** via `secureShuffle`, writes `privateRoles/{uid}` for each (honouring counts exactly), and sets `meta.status` to dealt/in_game; the moderator is **not** assigned a role; two separate games on the same setup produce different orderings.
- **Depends on:** 12, 7, 5

---

### Reveal, resilience & wrap-up

## 14. Player Reveal screen (own role only, hidden-by-default) — ✅ done

- **Goal:** Each player sees only their own role, hidden until tapped, re-viewable.
- **Files:** `components/screens/OnlineRevealScreen.tsx`.
- **Satisfies:** FR-13 (bare role name, hidden-by-default tap-to-reveal, hide/re-reveal), FR-14 (persists; refresh re-opens), spec-2a Security (reads only own node).
- **Done when:** after the deal each player's device shows "Tap to see your role" → their **own** role name only (no other info, no "You are…"), with hide/re-reveal; a different player's device shows a different role and cannot read this one (rules); refreshing returns the player to their reveal.
- **Depends on:** 13, 7

## 15. Moderator post-start view (viewed status, no roles) — ✅ done

- **Goal:** Moderator sees the game started and who has viewed their role — never the roles.
- **Files:** `WaitingRoomScreen.tsx`/`components/online/ModeratorStarted.tsx`; players stamp a `viewed` flag.
- **Satisfies:** FR-15, FR-16 (2a ends when all have viewed), D6.
- **Done when:** post-START the moderator sees a per-player viewed/not-viewed list (no roles anywhere on the moderator UI); the list updates as players reveal; an end state is reached once all have viewed.
- **Depends on:** 13, 14

## 16. Reconnect / rejoin by identity — ✅ done

- **Goal:** Refresh or brief drop returns a device to its room/role as the same person.
- **Files:** small session-restore in the online provider/router (remember current room code), reuse presence.
- **Satisfies:** FR-17, FR-18, D3 (moderator rejoins as moderator), D8 (keep slot+role after deal).
- **Done when:** refreshing as a player in the lobby keeps the slot; refreshing after the deal re-opens the same role; refreshing as the moderator resumes moderator control; a brief disconnect doesn't drop an after-deal player.
- **Depends on:** 9, 14

## 17. Room expiry & bad-state handling — ✅ done

- **Goal:** Treat stale rooms as expired and fail joins gracefully (no Functions), AND handle a **moderator-gone / abandoned room** for people already inside it — including on reconnect.
- **Files:** `lib/room/joinRoom.ts` (staleness check), the online screens / `ReconnectOnLoad` (moderator-present check + "game abandoned" surface), small client cleanup, error surfaces in Online Mode.
- **Satisfies:** Edge "room expiry & cleanup" (D5), Edge "moderator disconnect/abandon" (D3), FR-5 error paths.
- **Done when:** joining a room older than the inactivity TTL is refused as expired; `lastActivity` is bumped on meaningful writes; clients best-effort delete a clearly-stale room; joining started/ended/nonexistent rooms shows the right errors. **Also:** when the moderator has left/abandoned the room (e.g. moderator not present for a while), players in the room — and players who **refresh** back into it — are told the game is abandoned and returned Home cleanly, rather than being left on their reveal screen indefinitely. (Observed in task-16 testing: a moderator leaving currently still lets players refresh back onto their reveal — this task fixes that.)
- **Depends on:** 5, 6, 16

## 18. Polish & 2a acceptance pass — ✅ done

- **Goal:** Consistent dark/green styling across the new online screens; walk the spec's Acceptance Criteria.
- **Files:** the online `components/screens/*` and `components/online/*`; remove any debug scaffolding.
- **Satisfies:** spec-2a Acceptance Criteria; CLAUDE.md done-definition; visual consistency with Phase 1.
- **Done when:** online screens match the centered, dark, green-accented look; every spec-2a Acceptance Criterion is checked with two browsers; no leftover debug scaffolding; no `Math.random`; `tsc` clean.
- **Depends on:** all prior

---

### Dependency summary

- Foundation & data layer: **1 → 2 → 3 → 4 → 5**.
- Online entry (**6**) then **Security Rules (7)** before the live UI that relies on them.
- Live data & lobby: **8** (subscriptions), then **9** (Waiting Room) → **10** (chat).
- Config/start/deal: **11 → 12 → 13**.
- Reveal & wrap-up: **14 → 15**; resilience **16, 17**; **18** final polish/acceptance.

---

## How to test 2a end-to-end (two browser windows)

You need **two separate browser sessions** so they get **different anonymous `uid`s** — use two different browsers or Chrome profiles (separate incognito windows of the same browser share one uid).

1. Run the app (`npm run dev`) against the **Emulator Suite**.
2. **Window A (moderator):** PLAY ONLINE → enter a name → CREATE GAME. Note the 6-digit code; try Copy.
3. **Window B (player):** PLAY ONLINE → enter a name → type the code → JOIN GAME. Confirm B appears in A's player list and the count updates live in both.
4. **Chat:** send a message from each window; confirm both see it in real time.
5. **Config:** in A, set roles so Total Players Needed = number of joined players. Confirm B sees the config read-only and (once built) START is disabled with a reason until players match exactly.
6. **Start & reveal:** when the count matches, START in A. Confirm B sees **only its own** role (hidden until tapped); A sees "started" + viewed-status and **no** roles. Confirm another player's role is **not** retrievable in dev tools.
7. **Resilience:** refresh B after the deal → same role returns. Refresh A → still moderator. Close B → A shows it disconnected.

*No app code or dependencies were added until task 1's `firebase` proposal was approved.*

---

## Progress

- ✅ **Task 1 — Propose & set up Firebase** (complete): proposed and installed `firebase@12.15.0`; single init module `lib/firebase.ts` (duplicate-init guarded, reads `NEXT_PUBLIC_FIREBASE_*`, connects Auth+RTDB to the Emulator Suite when `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`); committed `.env.local.example` + gitignored `.env.local` (emulator/demo defaults, verified not tracked); emulator config `firebase.json` (auth:9099, database:9000, UI:4000), `.firebaserc` (demo project), starter `database.rules.json` (authed-only — hardened in task 7). `tsc` clean. **Emulator run not verified here** — Java + Firebase CLI are not installed in this environment (see install steps reported to the user).
- ✅ **Task 2 — Anonymous identity hook** (complete): `lib/useAuthUid.ts` — `useAuthUid()` does a silent anonymous sign-in and returns `{ uid, ready, error }`; Firebase local persistence keeps the same `uid` across refreshes. Mounted at the app root via `components/AuthInit.tsx` (in `app/layout.tsx`) so sign-in fires on initial load. Identity only, no game logic. `tsc` clean.
- ✅ **Task 3 — Room data model & path helpers** (complete): `lib/room/types.ts` defines the RTDB room shape — `RoomStatus`, `RoomMeta`, `PlayerEntry` (optional `viewed`), `RoomConfig` (roles map keyed by id, reusing Phase 1 `Role`), `PrivateRoleEntry` (separate per-uid subtree), `ChatMessage`, and the full `Room`. `lib/room/paths.ts` exports `roomPaths` + `isValidRoomCode`/`ROOM_CODE_PATTERN`. Pure data + string builders. `tsc` clean; runtime-checked.
- ✅ **Task 4 — 6-digit code generation + atomic room creation** (complete, **emulator-verified**): `lib/room/generateCode.ts` (`generateRoomCode()` — crypto-secure, rejection-sampled, no `Math.random`) and `lib/room/createRoom.ts` (`createRoom(uid)` — transaction create-if-not-exists on `meta`, retries on collision). Manually verified against the emulator (three rooms created with correct `moderatorId`); throwaway button removed, screens clean.
- ✅ **Task 5 — Join / leave / presence operations** (complete, **emulator-verified**): `joinRoom` (validates room + `lobby`, rejects moderator/empty names, capacity transaction, `JoinRoomError` reasons), `leaveRoom` (cancel onDisconnect + remove), `presence` (`.info/connected` + `onDisconnect`, keeps slot). Manually verified: incognito player joined `connected: true`, tab close flipped to `false` while keeping the slot. (Note: `meta.lastActivity` bumping deferred to task 17.)
- ✅ **Task 6 — Play Online entry + Online Mode (create/join)** (complete): green **PLAY ONLINE** on Home → `OnlineModeScreen` (name, green CREATE, OR divider, 6-digit code, green JOIN, back arrow); CREATE→`createRoom`, JOIN→`joinRoom`; on success routes to the Waiting Room; validation + `JoinRoomError` messages surfaced. Navigation added to `GameProvider` (screens `onlineMode`/`waitingRoom`, state `roomCode`/`isModerator`/`onlineName`, `goOnlineMode`/`enterWaitingRoom`, `GO_HOME` clears room state). `tsc` clean; dev render verified.
- ✅ **Task 7 — Security Rules** (complete, **emulator-verified**): `database.rules.json` — no `.read` at `rooms`/`$code`/`privateRoles` (no cascade); `privateRoles/$uid` readable only by that uid, writable only by the moderator; `meta`/`config` moderator-write (meta with create-bootstrap); `players` own-write (parent write lobby-only for the join transaction); `chat` members-only append-own, length-capped. **Verified:** a player read their own role but was `⛔ Permission denied` for another's role and the whole node. Known residual: lobby roster tamperable via the parent join transaction (griefing, not a role leak).
- ✅ **Task 8 — Live subscriptions** (complete, **emulator-verified**): `lib/room/subscriptions.ts` — generic `useDbValue<T>` + `useRoomMeta`, `useRoomPlayers`, `useRoomRoles`, `useMyRole` (own role only), plus `useRoomChat` (task 10). `{ data, loading, error }`, clean unsubscribe, missing room → `data: null`. Verified: roster updated live (no refresh) when a player joined. **Known gap (not a subscription bug):** presence wasn't wired on the join path — closed by task 9 (`setupPresence` in the Waiting Room).
- ✅ **Task 9 — real Waiting Room UI** (complete): live screen — big shareable code + Copy, live Players count/roster (name + connected, `useRoomPlayers`), roles panel + total (`useRoomRoles`), moderator banner vs player badge, display-only readiness line. Back arrow: players `leaveRoom`, moderator returns Home (D3). **Presence wired** (`setupPresence` on mount / cleanup on unmount, players only — closes the task-8 gap). Room removed/ended → graceful. **Copy-code control complete here.** `tsc` clean; both views dev-rendered.
- ✅ **Task 10 — lobby chat** (complete): `useRoomChat(code, max=50)` (query + `limitToLast`, push-key `id`); `lib/room/chat.ts` `sendChatMessage` (trim, ≤300, `serverTimestamp`, `push`); `components/online/Chat.tsx` (bounded scroll, auto-scroll to newest, sender name + text, Send disabled when blank). Appends satisfy the task-7 rules. Mounted in the Waiting Room; lobby-only (D7). `tsc` clean; dev render confirms the panel.
- ✅ **Task 11 — moderator role configuration** (complete, **two-window verified**): `lib/room/config.ts` (moderator-only `seedDefaultRoles`/`setRoleCount`/`addCustomRole`/`removeRole`) and `components/online/RoleConfig.tsx` (reuses Phase 1 `RoleStepper` + model). Moderator sees editing steppers + Add Custom Role (trim/≤24/dup block) + remove custom (standard can't be removed), auto-seeds 1/1/1/7 once; players see read-only roles; live for everyone via `useRoomRoles`; shows total roles · players joined; moderator-gated by rules. **Two-window verification completed:** moderator saw the edit controls and a real second-browser player saw the roles read-only, updating live as the moderator changed them.
- ✅ **Task 12 — START gating** (complete): `evaluateOnlineStart(roles, connectedPlayers)` added to `lib/validation.ts` (reuses `evaluateSetup` for config validity — total ≥ 3, ≥ 1 Mafia, ≥ 1 non-Mafia — then requires connected players == Total Players Needed, else "Need N more player(s)" / "Too many players — add roles or remove players"). `lib/room/startGame.ts` (`startGame(code)` sets `meta.status` → "dealing"; **no dealing** — that's task 13, moderator-only per rules). Waiting Room: **only the moderator** sees a green **Start Game** button, disabled with the live reason until valid AND connected count matches exactly (re-evaluates live via `useRoomPlayers`/`useRoomRoles`); players see a readiness line, never the button. Once status leaves `lobby`, both see "The game is starting…". `tsc` clean; `evaluateOnlineStart` runtime-checked across cases; dev render confirms moderator sees the gated button and players don't.
- ⬜ **Next — Task 13: Secure deal on START** — build the assignment over connected players via `secureShuffle`, write each `privateRoles/{uid}`, no `Math.random`, moderator gets no role.

**Task 12 (START gating) two-window verified:** reason counted down live as players joined, START enabled exactly when connected players == total roles, players never saw the button, and clicking Start flipped status to 'dealing' (both windows show 'The game is starting…'). NEXT = task 13: secure deal on START (deal each player their own secret role, readable only by them per the task-7 rules).

- ✅ **Task 13 — Secure deal on START** (complete): `lib/room/dealRoles.ts` (`dealRoles(code, playerUids, roles)`) reuses the Phase 1 `buildAssignment` (expand counts one-per-slot → cryptographically secure `secureShuffle`, no `Math.random`) and writes each connected player's role to `privateRoles/<uid>` plus flips `meta.status` → "in_game" in **one atomic multi-path update**. Moderator is not in `playerUids` → gets no role (D9); counts honoured exactly. Wired into the moderator START handler (`startGame` → dealing, then `dealRoles` → in_game), dealing over the players connected at click time. **Trust assumption documented:** the deal runs on the moderator's (trusted, non-playing) client which transiently holds the full mapping — "secret enough for friends" — but the task-7 rules still prevent any *player* from reading another's role. `tsc` clean; deal math runtime-checked (40 runs: exactly one role per player, counts match config, deals differ). **Live emulator deal not verified here** — user multi-window test steps provided.
- ⬜ **Next — Task 14: Player Reveal screen** — each player sees ONLY their own role (via `useMyRole`), hidden-by-default tap-to-reveal, persists across refresh; a different player sees a different role and can't read this one.

- ✅ **Task 14 — Player Reveal screen** (complete): `components/screens/OnlineRevealScreen.tsx` — once the room is `in_game`, the Waiting Room hands off to this per-device reveal. Each **player** reads ONLY their own role via `useMyRole(code, uid)` (only `privateRoles/<uid>`, never the parent — task-7 rules); hidden-by-default "Tap to see your role" → bare role name (Phase 1 red-accent styling) with a **Hide** to re-hide/re-reveal; graceful loading/"waiting" states. Per-device & private (no passing the phone). The **moderator** (no role, subscription kept inactive) sees a minimal "Game started" view — no role shown (full per-player viewed view is task 15). Back arrow → Home (role persists in RTDB, not deleted). `tsc` clean; dev render verified moderator view (no role) and player reveal shell. **Note:** re-opening the reveal after a full refresh needs session-restore (roomCode is in-memory) — that's task 16. **Live tap-reveal not verified here** (no emulator) — user multi-window steps provided.
- ⬜ **Next — Task 15: Moderator post-start view** — per-player "has viewed their role" status (no roles shown); players stamp a `viewed` flag; 2a ends when all have viewed.

- ✅ **Task 15 — Moderator post-start view** (complete): `components/online/ModeratorStarted.tsx` (rendered by `OnlineRevealScreen` for the moderator when `in_game`) shows the live per-player **viewed** status via `useRoomPlayers` — each player's name + "✓ seen" / "waiting…", a "**X of N** have seen their role" count, and an "everyone's all set" end state when all have viewed. **No role information anywhere** (moderator can't read `privateRoles` per task-7 rules anyway). Players stamp their own `viewed` flag on reveal via `lib/room/markViewed.ts` (`markViewed(code, uid)` — own `players/<uid>` write, allowed by rules); wired into the reveal tap. Dark/green styling. `tsc` clean; dev render confirms the moderator view (Game Started, "Seen their role", "0 of 0", no role words). **Live viewed-status not verified here** (no emulator) — user multi-window steps provided.
- ⬜ **Next — Task 16: Reconnect / rejoin by identity** — refresh/brief-drop returns a device to its room/role as the same person (lobby slot kept; reveal re-opens after refresh; moderator resumes).

- ✅ **Task 16 — Reconnect / rejoin by identity** (complete, **two-window verified**): `lib/room/session.ts` persists a tiny reconnect hint in **sessionStorage** — `{ code, isModerator, name }` only, **no secret/role data** — saved on `enterWaitingRoom`, cleared on `goHome` (wired into the `GameProvider` actions). `components/online/ReconnectOnLoad.tsx` (mounted inside `GameProvider` in `app/page.tsx`) runs once after auth resolves: if a stored code exists and the room still exists, it re-verifies membership (**moderator = `meta.moderatorId === uid`**, D3 no auto-transfer; **player = `players/<uid>` exists**) and re-enters the Waiting Room — which routes lobby → waiting room, `in_game` → reveal (player) / moderator view, and **re-arms `setupPresence`** for players on mount. If the room is gone or the uid is no longer a member, it clears the hint and stays Home cleanly. `tsc` clean. **Two-window verified:** refresh restored players and the moderator to the correct screen at every stage (lobby and in-game), and a deleted room sent the user Home cleanly.
  - **Expected behavior (not a bug):** revealing a role then refreshing returns to "tap to see your role" and re-reveals the **same** role. The reveal shown/hidden state is intentionally **in-memory only** (secrecy); the role and the `viewed` flag persist server-side, so re-tapping shows the same role and the moderator's "viewed" status stays set.
  - **Deferred to task 17:** if the **moderator leaves/abandons** the room, players can still refresh back onto their reveal screen (no abandoned-game notice yet). Moderator-gone / dead-room handling belongs to task 17 (scope updated there).
- ⬜ **Next — Task 17: Room expiry & bad-state handling** — treat stale rooms as expired (inactivity TTL), bump `lastActivity` on meaningful writes, best-effort cleanup, the right errors for started/ended/nonexistent rooms, **and** notify players when the moderator has abandoned the room (incl. on refresh).

- ✅ **Task 17 — Room expiry & bad-state handling** (complete): `lib/room/lifecycle.ts` ties room liveness to a **moderator heartbeat** — while the moderator's tab is open, `WaitingRoomScreen` bumps `meta.lastActivity` every 30s (`touchRoom`, moderator-only write per task-7 rules, no rules change). `roomDeadReason(meta, now)` → `gone` (meta null) / `ended` (status) / `abandoned` (no heartbeat for > `ROOM_ABANDON_MS` = 2 min) — one signal covering both moderator-vanish (D3) and long-stale rooms (D5). **Explicit moderator leave** (`endRoom` → status `"ended"`) ends the game for everyone; a player leaving just frees their slot. **Dead-room handling everywhere:** `joinRoom` rejects dead rooms with a friendly `expired` `JoinRoomError` (surfaced by Online Mode); `ReconnectOnLoad` clears the hint + stays Home; and players *in* the room get a "This game has ended" screen with the reason (a 15s tick re-checks so abandonment is noticed even with no new snapshots). No Cloud Functions; secret-role protection untouched. `tsc` clean; `roomDeadReason` thresholds/messages runtime-checked; dev render confirms the live lobby doesn't false-trigger the dead screen. **Two-window verified** (setting `meta/lastActivity` to 1 triggered the "game ended" screen — moderator ~5–6s, player ~15–20s, matching the 15s tick). *Known limits:* true storage deletion of dead rooms needs Blaze/cron (dead rooms are marked/ignored, not deleted); liveness compares client clocks, so the 2-min threshold absorbs modest skew.
- ⬜ **Next — Task 18: Polish & 2a acceptance pass** — consistent dark/green styling across online screens, remove debug scaffolding, walk the spec-2a Acceptance Criteria on two browsers, no `Math.random`.

- ✅ **Task 17 — two-window verified:** setting `meta/lastActivity` to 1 correctly triggered the "game ended" screen. The moderator's own window detected it in ~5–6s; the player's window within ~15–20s (matching the 15s liveness tick) — both within expected timing (`ROOM_ABANDON_MS = 120s`).
- ✅ **Task 18 — Polish & 2a acceptance pass** (complete): **Polish** (light, no behaviour/layout change) — unified the green online CTA buttons so every one carries the same `hover`/`active`/`disabled` states (added the missing `active:bg-emerald-800` to the dead-room "Back to Home"), and rewrote the dead-room messages so they no longer echo the "This game has ended." heading (`"The moderator ended the game."` / `"The moderator left the game."`). Confirmed no stray debug scaffolding, no `TEMP`, and **no `Math.random`** anywhere (only warning comments). **Acceptance pass** — walked all 13 spec-2a Acceptance Criteria; **all 13 pass** (boxes checked in `spec-2a.md`), each backed by a prior two-window verification and/or runtime/SSR check (see checklist). `tsc` clean; final Home render confirmed. **Slice 2a is DONE.**

---

## ✅ Slice 2a COMPLETE — all 18 tasks done, all 13 Acceptance Criteria pass, `tsc` clean.

Online multiplayer (create/join by 6-digit code, live waiting room + roster + presence, lobby chat, moderator role config, gated START, cryptographically-secure secret deal with per-player role secrecy enforced by Security Rules, per-device reveal, moderator viewed-status view, reconnect-by-identity, and room-expiry/abandon handling) is built and verified on the Firebase Spark plan with no Cloud Functions. Next up would be **Slice 2b** (in-app night actions, day voting, eliminations, multi-round win logic) — a new spec/research pass, not part of 2a.
