# spec-2a.md — Mafia Wars · Phase 2, Slice 2a (Online Rooms, Lobby & Secret Deal)

## Goal

Let people play Mafia together from their own phones over the internet. A non‑playing **moderator** creates an online room with a shareable 6‑digit code; players join by code into a **Waiting Room** that shows everyone present, the roles configured for the game, and a live chat. The moderator configures the roles and, once the right number of players have joined, starts the game. On start, roles are dealt randomly and securely and **each player sees only their own role on their own device**. Slice 2a ends the moment every player has seen their role — there is no in‑app night/day play yet (that is Slice 2b).

This builds on Phase 1 ([spec.md](spec.md)) and the research in [research-phase2.md](research-phase2.md). The Phase 1 offline flow (single‑device setup & pass‑the‑phone reveal) stays exactly as it is; 2a is an additional, parallel "online" path reached from Home.

### Backend (settled)

- **Firebase, Spark (free) plan — no Cloud Functions.**
- **Database: Firebase Realtime Database (RTDB)** for all room/game state, presence, and chat — chosen per [research-phase2.md](research-phase2.md) §2 for low‑latency real‑time updates, bandwidth‑based (not per‑read) billing, and native `onDisconnect` presence.
- **Identity: Firebase Anonymous Auth** — every browser gets a stable, server‑verifiable `uid` with no login, used by Security Rules to scope who can read/write what.
- **Secret roles via Firebase Security Rules** (see "Security: secret roles" below). This is **"secret enough for friends," explicitly not bulletproof** against a determined cheater.

## User Scenarios

- A moderator opens the app, taps **PLAY ONLINE**, enters their name, and taps **CREATE GAME**. They land in a Waiting Room showing a 6‑digit code (e.g. `482917`) with a Copy button.
- The moderator shares the code. Five friends open the app, tap PLAY ONLINE, enter their names, type `482917`, and tap **JOIN GAME**. The Waiting Room's player list and count update live on everyone's screen as each joins.
- In the Waiting Room, people chat ("waiting on Sam…"). The moderator configures **2 Mafia / 1 Detective / 1 Doctor / 2 Civilian** (Total Players Needed: 6). The roles and the "needed" count are visible to everyone.
- When 6 players have joined, the moderator's **START** button enables. They tap it. Each player's phone shows a reveal screen with **only their own role**; one sees "Mafia," another sees "Doctor." The moderator's screen confirms the game has started and shows no roles.
- A player accidentally refreshes; the app puts them back in the game and they can re‑view their own role. Slice 2a is complete once everyone has seen their role; in‑person (or future in‑app) play begins.

## Functional Requirements

### Entry & Online Mode

- FR‑1 — Home gains a **PLAY ONLINE** button alongside the existing Phase 1 START / ROLES. The Phase 1 offline flow is unchanged. PLAY ONLINE opens the **Online Mode** screen.
- FR‑2 — The Online Mode screen has: a **name** field (required), a **CREATE GAME** action, and a **6‑digit code** input next to a **JOIN GAME** action. A top‑left back arrow returns Home. Both CREATE and JOIN require a non‑empty name.
- FR‑3 — The name is trimmed, must be non‑empty, and is capped at 24 characters (consistent with Phase 1's custom‑role name cap). It becomes the player's display name in the room. **Display names need not be unique within a room** — two players may share a name; identity is the internal `uid`, not the name.

### Create a room (moderator)

- FR‑4 — **CREATE GAME** creates a new room with a unique, randomly generated **6‑digit numeric** code, marks the creator as the room's **moderator** (non‑playing), and opens the **Waiting Room** in moderator mode. Code generation must guarantee uniqueness (claim the code atomically; regenerate on the rare collision).

### Join a room (player)

- FR‑5 — **JOIN GAME** validates the entered code: the room must **exist** and be in the **joinable (lobby) state**. On success the player joins and opens the Waiting Room in player mode. On failure (no such room / already started / ended or expired / room full) it shows a clear, specific error and stays on the Online Mode screen.

### Waiting Room (shared by moderator + players)

- FR‑6 — The Waiting Room shows the **game code** prominently with a one‑tap **Copy** control so it can be shared.
- FR‑7 — It shows a **live player list and count**, updating in real time as players join, leave, or disconnect. The moderator is shown as the moderator and is **not** counted toward the player total. Disconnected players are shown as disconnected (e.g. greyed) rather than instantly removed (see FR‑17, Edge Cases).
- FR‑8 — It shows the **roles currently configured** for the game (role names, counts, and Total Players Needed), visible to everyone and updating live. (Role list and counts are public knowledge, as is standard in Mafia.)
- FR‑9 — It provides **real‑time text chat** for everyone in the room (moderator + players). Each message shows the sender's name and text, appears in real time for all, and is ordered oldest→newest. Messages must be non‑empty and are length‑capped (≈300 chars); clients show only a recent window (e.g. the last 50).

### Role configuration (moderator only)

- FR‑10 — The moderator configures roles using the **Phase 1 role model and rules**: standard roles Mafia / Detective / Doctor / Civilian with minus/count/plus steppers; caps Mafia/Detective/Doctor = 20, Civilian = 100, no count below 0; default counts 1 / 1 / 1 / 7; **Add Custom Role** (max 24 chars, starts at 1, cap 20, removable; standard roles can't be removed, only stepped to 0; empty names blocked; trim + case‑insensitive duplicate block). **Total Players Needed** = sum of all counts, updating live. Only the moderator can change the config; players see it read‑only.

### Starting the game (moderator only)

- FR‑11 — Only the moderator can **START**, and only when **both** hold: (a) the role setup is **valid** by the Phase 1 rules — Total Players Needed ≥ 3, Mafia ≥ 1, and at least one non‑Mafia role with count ≥ 1 (a custom role counts as non‑Mafia); **and** (b) the number of **joined players exactly equals Total Players Needed**. When START is disabled, a short reason is shown (e.g. "Need 2 more players", "Need at least 1 Mafia", "Too many players — add roles or wait for someone to leave").

### Dealing & secret reveal

- FR‑12 — On START, the joined players are assigned roles via a **cryptographically secure shuffle** (never `Math.random`, per CLAUDE.md — reuse Phase 1's `secureShuffle`), one role per player, honouring the configured counts exactly (2 Mafia ⇒ exactly 2 players are Mafia). The **moderator receives no playing role**. Each player's role is written to a **per‑player private location** that, by Security Rules, only that player can read (see Security section).
- FR‑13 — After START, each player's device shows a **Reveal screen** displaying **only their own role name** (e.g. "Mafia"), with no other player's information and no extra wording like "You are…" (consistent with Phase 1's bare‑name rule). The role is **hidden by default** behind a "Tap to see your role" prompt; tapping reveals it, and the player can hide and re‑reveal it on their own device (so a neighbour can't catch it on screen).
- FR‑14 — A player's own role **persists for them for the duration of the game session**: refreshing or reconnecting re‑opens their Reveal screen and they can view their role again. (This differs from Phase 1, where a refresh ends the reveal — online, the role is stored server‑side and is readable only by that player.)
- FR‑15 — After START the moderator sees a **"game started / roles dealt"** confirmation showing, per player, **whether they have viewed their role yet** (so the moderator knows when everyone is ready). It shows **no player roles** of any kind.
- FR‑16 — **Slice 2a ends once every player has seen their role.** There are no night/day phases, actions, votes, or eliminations in 2a (those are 2b). From the end state, players and the moderator can leave / return Home.

### Identity, reconnect & navigation

- FR‑17 — Each device has a **persistent anonymous identity** (Anonymous Auth `uid`, preserved in browser storage). Refreshing or a brief network drop keeps the device in the room as the **same person** — same lobby slot, and after dealing the **same role**. The roster reflects connected/disconnected state. A moderator who refreshes rejoins **as the moderator**.
- FR‑18 — A top‑left back arrow appears on Online Mode and the Waiting Room. A **player** leaving the Waiting Room leaves the room (their slot is freed and the count drops). Leaving the Reveal screen returns Home but does **not** delete the player's stored role. Moderator‑leave behaviour is covered in Edge Cases.

## Security: secret roles (explicit)

The core promise is **a player can read only their own role; nobody can read another player's role by inspecting the browser, network traffic, or dev tools.** How that is (and isn't) achieved:

- **Enforced by Firebase Security Rules, not by the UI.** Each player's role lives at a private per‑`uid` path (e.g. `/rooms/{code}/privateRoles/{uid}`) with a read rule of the form "readable only if `auth.uid` equals this uid." Because the data is never sent to other players' devices, hiding it in the UI is not relied upon. Clients read only their own path (RTDB rules cannot filter a list read).
- **Dealing happens on the moderator's device (Spark plan has no Cloud Functions).** On START the moderator's browser runs the secure shuffle and writes each player's role to their private path. Security Rules let the moderator write those nodes and let each player read only their own.
- **What this means honestly — "secret enough for friends," not bulletproof.** Because the moderator's browser computes the assignment, that one device transiently holds the full mapping; a technically savvy moderator could inspect their **own** device. The guarantee we *do* provide is that **players cannot see each other's roles**. This trade‑off is accepted for 2a on the free plan. The documented upgrade path (later, on the Blaze plan) is to move dealing into a Cloud Function so no client ever holds the full mapping (see [research-phase2.md](research-phase2.md) §3).
- **Firebase web config is not a secret** and may ship to the browser (`NEXT_PUBLIC_FIREBASE_*`); security comes from Auth + Rules. Any future service‑account key *is* secret and must never be committed.

## Edge Cases & Rules

- **Code format & collisions.** Codes are 6‑digit numeric. Generation retries on the (rare) collision so every active room has a unique code.
- **Bad joins.** Joining a non‑existent, already‑started, ended/expired, or full room shows a specific error and does not join.
- **Room capacity / over‑join.** A room is "full" when joined players = Total Players Needed; further joins are blocked ("Game is full"). If the moderator **increases** counts, capacity grows and more may join. If the moderator **decreases** counts below the number already joined, START is blocked (too many players) until counts are raised again or a player leaves. 2a has **no kick/remove‑player** control.
- **Joins are atomic.** Two players joining at once each write their own node; capacity is enforced with a transaction so a room can't exceed Total Players Needed (last one over the limit is rejected as full).
- **Player disconnect (lobby).** A network drop marks the player disconnected (via `onDisconnect`) and starts a **short grace window**; if they don't return within it, the slot is freed and the count drops. The roster shows them as disconnected meanwhile. Explicitly **leaving** frees the slot immediately. If the connected‑player count drops below needed, START disables. (Exact grace duration set at build time.)
- **Player disconnect/refresh (after deal).** They **keep their slot and role for the whole game session** (no grace‑window drop after the deal); reconnecting re‑opens their Reveal screen.
- **Moderator disconnect/refresh.** The room persists; the moderator rejoins by stored identity and resumes control. 2a has **no automatic moderator transfer or claim** — but `meta` is shaped (a single `moderatorId`) so transfer can be added later without restructuring. If the moderator truly **abandons** the room it goes stale and expires (below); a stuck room is an accepted 2a limitation.
- **No new joins after START.** Once the room leaves the lobby state, the code is no longer joinable.
- **Chat is lobby‑only.** Chat lives in the Waiting Room; once the game starts it stops mattering (in‑game chat, with dead/alive rules, is 2b). Messages are non‑empty, length‑capped, and rule‑validated (authed sender, sane shape); clients render only a recent window. There is **no profanity filter and no robust server‑side rate‑limiting** in 2a (Functions would be needed) — only a simple client throttle and the moderator's social authority.
- **Room expiry & cleanup.** With no Cloud Functions there is no scheduled cleanup, so expiry is **lazy**: a room is treated as **expired after N hours of inactivity** (exact TTL set at build time), joining a stale or expired room is refused with an error, and clients best‑effort delete rooms they find stale. (No background job guarantees deletion.)
- **Free‑tier limits.** Spark plan, RTDB, no Functions. Keep room sizes modest (hobby scale) and mind RTDB's ~100 concurrent‑connection ceiling and bandwidth; prune chat to a recent window.
- **Randomness.** All fairness‑affecting randomness (the deal, and any code generation we want unguessable) uses `crypto.getRandomValues`, never `Math.random`.
- **Min players online.** Validation mirrors Phase 1 but the **moderator is excluded** from player counts: roles total must be ≥ 3 and that many real players must have joined.

## Out of Scope (Slice 2a — these are 2b or later)

- In‑app **night actions** (Mafia kill, Doctor save, Detective investigate) and any custom‑role powers/behaviour.
- **Day voting, eliminations, multiple rounds, and win detection** (the game ending when all Mafia are out).
- In‑game chat beyond the lobby, dead/alive chat rules, spectators.
- **Kicking/removing** players; **moderator transfer/claim**; pausing/resuming a started game.
- Accounts, persistent profiles, friend lists, match history, reconnect across full app close after a long time.
- Server‑side (Cloud Function) dealing or resolution; scheduled room cleanup — both need the Blaze plan.

## Acceptance Criteria

- [x] Home shows a PLAY ONLINE button; tapping it opens Online Mode with a name field, CREATE GAME, and a code input + JOIN GAME. The Phase 1 offline flow still works.
- [x] CREATE GAME (with a name) makes a room with a unique 6‑digit code and opens the Waiting Room as moderator; the code shows with a working Copy control.
- [x] A second device entering that code with a name via JOIN GAME appears in the moderator's player list within a second or two, and the count increments live on all devices.
- [x] Entering a wrong/nonexistent code shows a clear error and does not join.
- [x] Chat messages typed by any room member appear in real time for everyone in the room.
- [x] The moderator can configure roles (defaults 1/1/1/7, steppers, caps, add/remove custom) and Total Players Needed updates live; players see the config read‑only.
- [x] START is disabled until the setup is valid AND joined players exactly equals Total Players Needed, with a short reason shown while disabled. Only the moderator has START.
- [x] With 2 Mafia / 1 Detective / 1 Doctor / 2 Civilian and exactly 6 joined players, START deals exactly those roles across the 6 players, one each.
- [x] After START, each player's device shows only that player's own role; no device shows another player's role, and the role is not retrievable from the database by a different player (Security Rules verified).
- [x] The moderator receives no playing role, and the moderator screen shows no player roles.
- [x] A player who refreshes after the deal is returned to the game and can re‑view their own role.
- [x] Running START on the same room/setup twice (in separate games) yields a different, securely shuffled assignment (not fixed).
- [x] Slice 2a reaches its end state after the deal with no night/day/voting UI present.

## Settled Decisions (Q1–Q9 review)

These were open questions; all are now decided and folded into the requirements and edge cases above. Recorded here for traceability.

- **D1 — Player reveal interaction (→ FR‑13).** Hidden‑by‑default "Tap to see your role," with hide/re‑reveal on the player's own device. *Why: phones may be visible to neighbours.*
- **D2 — Over‑join & kicking (→ Edge Cases).** Block joins when full; **no** kick/remove‑player control in 2a. *Why: keeps 2a small; capacity grows if the moderator adds roles.*
- **D3 — Moderator disconnect/abandon (→ Edge Cases, FR‑17/18).** Rejoin by stored identity; **no** auto‑transfer in 2a, but `meta.moderatorId` is shaped so transfer can be added later. A truly abandoned room goes stale and expires. *Why: keeps scope tight; accepts a stuck room as a known limitation.*
- **D4 — Name uniqueness (→ FR‑3).** Display names need not be unique; identity is the internal `uid`. *Why: simplest, avoids blocking joins on a name clash.*
- **D5 — Room lifecycle / expiry (→ Edge Cases).** No scheduled cleanup (no Functions); lazy staleness — a room expires after N hours of inactivity (exact TTL at build time), joining a stale/expired room is refused, and clients best‑effort delete stale rooms. *Why: works without server cron.*
- **D6 — Moderator post‑start view (→ FR‑15).** Per‑player "has viewed their role" status, no roles shown. *Why: tells the moderator when everyone is ready — exactly where 2a ends.*
- **D7 — Chat lifetime (→ FR‑9, Edge Cases).** Lobby‑only; chat stops mattering after START. *Why: 2a ends at the deal; in‑game chat (dead/alive rules) is 2b.*
- **D8 — Reconnect grace (→ Edge Cases).** Short grace in the lobby (then the slot is freed), but the slot+role are kept for the whole session after the deal. Exact durations at build time. *Why: protects in‑progress games from blips while keeping the lobby count honest.*
- **D9 — Moderator is always non‑playing (→ FR‑12, Security).** The moderator never receives a role; no "moderator also plays" mode. *Why: matches the Phase 2 vision and keeps the deal/secrecy model simple.*

---

*Next step (separate task, not this one): a task breakdown for 2a, and — before any code — proposing the `firebase` dependency and a Firebase project/config per CLAUDE.md. No app code or dependencies until this spec is reviewed.*
