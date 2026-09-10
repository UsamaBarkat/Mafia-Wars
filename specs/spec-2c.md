# spec-2c.md — Mafia Wars · Phase 2, Slice 2c (Chat & Replay)

## Goal

Three post-launch features found through real multi-device playtesting of Slice 2b: a **Mafia-only private chat** at night (so Mafia can coordinate their kill without speaking out loud in front of the group), a **Day voting chat** (so remote players — not all in the same physical room — can actually discuss before voting, not just vote blind), and **Play Again** (so a group can replay several rounds without re-creating a room and re-typing the join code each time).

This builds directly on [spec-2a.md](spec-2a.md) (the lobby chat mechanism, reused for both new channels) and [spec-2b.md](spec-2b.md) (the night/day game engine Play Again resets). No 2a or 2b behavior changes except where explicitly noted below.

### Backend & mechanism (settled)

- **Firebase, Spark (free) plan — no Cloud Functions** (unchanged).
- **Both new chats reuse 2a's chat mechanism exactly** — same `ChatMessage` shape (`{uid, name, text, ts}`), same 300-character cap, same append-only writes (a message can be created but never edited/deleted by a client), same "read a live list, `push()` to append" client pattern (`useRoomChat`/`sendChatMessage`, generalized to take a path instead of being lobby-only). Two **new sibling nodes** next to `chat`: `/rooms/{code}/mafiaChat` and `/rooms/{code}/dayChat`. Not reinvented — extended.
- **One ongoing channel per game, not per round.** Neither new chat resets between Night 1 and Night 2 (or Day 1 and Day 2) — messages accumulate for the whole game, the same way 2a's lobby chat never resets while a room is open. The only reset is **Play Again** (feature 3), which clears both, matching how it clears round data.
- **Mafia-chat membership is checked via `privateRoles/{uid}/role === 'Mafia'`, not via `mafiaTeam` existence.** This matters: a **solo Mafia** (only 1 Mafia in the game) has an empty `mates: []`, which Realtime Database silently drops — `mafiaTeam/{uid}` never gets written at all for a lone Mafia (this exact gotcha was found and documented in Slice 2b, task 4). A membership check keyed on `mafiaTeam/{uid}.exists()` would therefore wrongly lock a solo Mafia out of their own chat. `privateRoles/{uid}/role` always exists for every dealt player, solo Mafia included, and Security Rules can read it via `root.child(...)` regardless of the requester's own read permissions on that path (the same mechanism the existing rules already use to check `moderatorId`, `alive`, etc.).
- **Play Again is a moderator-only room reset**, structurally: flip `meta.status` back to `"lobby"` (the exact field `WaitingRoomScreen.tsx` already branches on — `meta.data?.status === "in_game"` decides whether to render the lobby or hand off to the game; flipping it back live-routes every device to the Waiting Room with no new client routing logic needed) and clear everything that belongs to the finished game (see FR-16). Config (`config/roles`), the player roster, and the moderator identity are left untouched.
- **Play Again needs new Security Rules — this is real, required work for the task breakdown, not optional polish.** Today the moderator has no `.write` grant at the `rounds` parent (only per-round, per-child grants like `nightResults`/`nightOutcome`/`dayOutcome` exist, and `nightActions`/`votes` are writable only by the acting player, not the moderator) and no grant to clear `chat`/`mafiaChat`/`dayChat` in bulk (only the existing per-message append rule). Resetting a room requires adding moderator-write grants at the `rounds`, `chat`, `mafiaChat`, and `dayChat` parents — following the exact precedent already set for `game`, `mafiaTeam`, and `privateRoles`, which already grant the moderator whole-node write access for exactly this kind of room-lifecycle operation. **One more is needed that's easy to miss:** `players/{uid}/viewed` is currently writable only by that player themselves (governed by the parent `players/$uid`'s `auth.uid === $uid` rule, the same way `name`/`connected` are) — unlike `alive`, it has no moderator-write child rule. Clearing `viewed` for every player (FR‑12) requires adding one, mirroring exactly how `alive` already grants the moderator write access via a child rule under `players/$uid`.
- **Granting the moderator bulk-write access to `rounds`/`chat`/`mafiaChat`/`dayChat` is a conscious, accepted trust extension, not a new risk category.** RTDB's rule model can't grant "clear the whole node" without also implicitly permitting the moderator to edit individual entries within it (e.g. a live player's in-progress night action) — there's no primitive for "bulk-delete only." The moderator is already the trusted resolver (reads every secret night action, every private role, writes every outcome); this is the same "secret enough for friends, not bulletproof" trust boundary spec-2b already documents, extended to cover reset, not a new one.

## User Scenarios

- **Mafia chat.** Night 3. Two Mafia players, on opposite sides of a video call, each open a small "Mafia" chat panel that appears only on their Night screen. One types "kill Sam, they're getting suspicious of me"; the other's screen updates instantly. The Doctor and Detective — on the same night, doing their own things — see no such panel and could not read that message even by inspecting the network tab. When the moderator ends the night and Sam is eliminated, Sam's device (now a spectator) shows no Mafia chat at all — they never had access.
- **Mafia chat, a Mafia player dies.** One of the two Mafia is voted out on Day 2. From that moment their Night-3 Mafia chat panel is simply gone — the other living Mafia's Night-3 coordination is invisible to them. Whatever they'd already loaded on screen from before they died may still be sitting in their browser, but nothing new ever arrives.
- **Day chat.** Day 2, five players still alive, one eliminated and spectating. On the Day screen, below the vote panel, everyone sees a chat labeled "Day discussion." The eliminated player and the moderator can both read it live but have no message box to type in — only the five living players can post. Someone posts "I think it's Alex" right before votes lock in.
- **Play Again.** The game ends — "Town wins!" — and the game-over screen shows everyone's roles. Below the reveal, the moderator (and only the moderator) sees a **Play Again** button. They tap it. Every device — including the ones that were just spectating — jumps straight back to the Waiting Room, same code, same six players still listed, same 2 Mafia / 1 Detective / 1 Doctor / 2 Civilian configured from last time. The moderator bumps Mafia to 3 for a harder round, waits for the (already-connected) players to be ready, and taps Start again. Nobody re-enters the room code.

## Functional Requirements

### Mafia private chat (night, living Mafia only)

- FR‑1 — A **Mafia chat panel** is shown on the Night screen (`NightScreen.tsx`), visible **only** to players whose dealt role is Mafia **and** who are currently alive. It renders alongside the existing Mafia target picker and teammates line — not a separate screen.
- FR‑2 — The panel is **active only while `game.phase === "night"`** — it does not appear on the Day screen or the spectator view. (The existing screen split already means Mafia never see a Day screen while alive; this is enforced structurally by where the panel is mounted, not by an extra runtime check.)
- FR‑3 — A living Mafia player can **read and post** messages; messages appear in real time for every other living Mafia player, the same way lobby chat does. Message shape, the 300-character cap, and the append-only write rule are identical to 2a's lobby chat.
- FR‑4 — **The instant a Mafia player is eliminated** (`alive` flips to `false`), they lose **both read and write access** to Mafia chat, enforced by Security Rules (not just the UI) — reading the node is denied from that point on. Whatever messages their client had already loaded before dying may remain visible on their screen (an artifact of already-received data, not a guarantee), but no further messages will ever arrive, and a direct database read attempt after death is denied. **This block is permanent** — it does not lift when the game ends and roles become public (FR‑15/spec-2b FR‑15); a dead Mafia never regains Mafia-chat access, even after the reveal.
- FR‑5 — **No one who isn't a currently-alive Mafia** — not Doctor, Detective, Civilian, a spectating (eliminated) player, or the moderator — can read Mafia chat at any point, enforced by Security Rules.
- FR‑5a — For everyone in FR‑5, Mafia chat is **completely absent from their UI** — no locked/greyed panel, no "Mafia chat" label, no indication it exists at all. This matches how a non-Mafia player already sees no "fellow Mafia" line and the moderator's console never hints at role information it can't display.

### Day voting chat (day, all room members, living can post)

- FR‑6 — A **Day chat panel** is shown on the Day screen (`DayScreen.tsx`), below the vote panel, visible to **every room member** — every living player, every eliminated/spectating player, and the moderator.
- FR‑7 — The panel is **active only while `game.phase === "day"`** — mounted on the Day screen only, same structural approach as FR‑2.
- FR‑8 — **Living players can read and post.** Message shape, cap, and write rule mirror 2a's lobby chat and FR‑3.
- FR‑9 — **Eliminated (spectating) players can read but not post** — the same read-only relationship the vote panel already gives them (`VotePanel`'s `canVote={false}` read-only mode), applied to chat instead of votes.
- FR‑10 — **The moderator can read but not post** — consistent with FR‑16 of spec-2b ("the moderator does not act or vote"); chat participation in the vote discussion is treated the same way.

### Play Again (moderator only, post-game)

- FR‑11 — On the **game-over screen** (`GameOverScreen.tsx`), once `game.phase === "ended"`, the **moderator only** sees a **Play Again** button. Players and spectators see no such control. **The button has no connection-count gate** — unlike Start, it's always available regardless of who's currently connected, since Play Again only returns the room to the lobby; the lobby's own Start button re-validates connected count before a new game can begin.
- FR‑11a — Tapping **Play Again** first shows a **confirmation dialog** (reusing the existing `ConfirmDialog` component, the same one already used elsewhere for irreversible actions) — e.g. "Start a new game? This clears all chat and round data from this game." Only on confirming does the reset (FR‑12) actually run; canceling leaves the game-over screen untouched.
- FR‑12 — Once confirmed, tapping **Play Again**:
  - Sets `meta.status` back to `"lobby"` — every connected device (moderator and players alike) is live-routed back to the Waiting Room, exactly as if the room had just been created, with no manual navigation needed.
  - **Retains unchanged:** the room code, the full joined-player roster (including anyone currently disconnected — nobody is kicked), the moderator identity, and the **existing role configuration** (`config/roles`) — so the moderator can start again immediately or adjust counts first.
  - **Clears:** `game` (phase/round/winner), `mafiaTeam`, all of `rounds` (every round's night actions, night results, night outcome, votes, day outcome — the whole subtree, not just the most recent round), `publicRoles`, `privateRoles`, and all three chat channels (`chat`, `mafiaChat`, `dayChat`).
  - **Resets per player:** `alive` and `viewed` are cleared for every player in the roster (both must be gone/false before the next deal — `viewed`, if left over from the previous game, would falsely satisfy the moderator's "everyone has seen their role" gate before anyone has looked at their new one).
- FR‑13 — **Play Again is repeatable indefinitely** — a group can play any number of rounds in the same room without ever leaving it.
- FR‑14 — After Play Again, the room behaves exactly like a freshly-created 2a lobby: role configuration can be edited, START re-validates Total Players Needed against currently-joined (connected) players, and a new deal runs a fresh, independent secure shuffle — nothing about the previous game's outcome influences it.
- FR‑15 — **Clearing `publicRoles` is a secrecy requirement, not cosmetic.** `publicRoles` is readable by any room member with no phase gate once written; if a stale `publicRoles` map from the *previous* game were left in place, the *new* game's roles could be inferable or directly visible (if any player keeps the same role between games) from the moment the new deal happens, defeating the entire secrecy model. It must be cleared before or as part of the same reset that returns the room to `lobby`.
- FR‑16 — **Clearing `rounds` and `mafiaTeam` is a correctness requirement, not cosmetic.** If a previous game's `rounds/1/nightActions/{uid}` were left in place, a player who doesn't resubmit an action in the new game's round 1 could have their *old* action from the finished game silently counted by the resolver. If a previous game's `mafiaTeam/{uid}` were left for a player who is *not* Mafia in the new deal, they would retain a stale "fellow Mafia" list from last time. Both must be cleared.

## Edge Cases & Rules

- **Solo Mafia is not a special case.** Mafia-chat access is checked via `privateRoles/{uid}/role`, which exists for every dealt player regardless of team size — a lone Mafia has full read/write access to their (empty-of-teammates, but that's fine) chat like any other Mafia.
- **Death cuts off chat access immediately, not retroactively.** The rule reads *current* `alive`; there is no per-message timestamp bookkeeping and no attempt to reconstruct "what this player could see at the moment each message was sent." A dead Mafia's already-rendered messages may linger client-side as a caching artifact; this is accepted, not engineered around.
- **Phase gates the write, not necessarily the read** — following the exact precedent already set by `nightActions`/`votes` (write requires `alive === true` and the matching phase; read requires alive + role/membership only, no phase check). A living Mafia can still read *past* Mafia-chat history during the Day (the panel just isn't mounted then, so there's no surface to view it from) — this matches how a Mafia's `mafiaTeam` teammates list is readable any time, not just at night.
- **Moderator access is asymmetric by design:** read-only on Day chat (matches lobby chat's precedent of moderator read access), zero access to Mafia chat (chat content is never consumed by the resolver, unlike `privateRoles`/`mafiaTeam`, so there is no functional reason to grant it, and doing so would weaken Mafia's actual privacy).
- **Chat is not reset between rounds within one game** — only Play Again resets it. A long game (many nights/days) keeps one continuous Mafia-chat history and one continuous Day-chat history for its whole duration.
- **Play Again clears *all three* chat channels**, including the original 2a lobby chat, for a genuinely clean restart — no stale pre-game-1 chat history bleeding into the game-2 lobby.
- **Disconnected players are not pruned by Play Again.** The roster is left exactly as it stood at game end; a disconnected player still occupies their slot (consistent with 2a's "no kick" stance) and can reconnect and rejoin the new lobby normally.
- **The moderator heartbeat / dead-room detection is unaffected by Play Again** — it's keyed off `meta.moderatorId`/`meta.lastActivity`, neither of which Play Again touches.
- **No mid-game reset.** Play Again only appears once `game.phase === "ended"` — there is no "abort and restart" control during an active night/day.
- **No rate limiting or profanity filter** on either new chat, same accepted 2a stance (would need Cloud Functions).
- **Randomness.** Play Again's new deal reuses the existing `secureShuffle` deal path unchanged — never `Math.random`, per CLAUDE.md.

## Out of Scope (Slice 2c v1 — later or never)

- Rich chat features of any kind: reactions, edits, deletes, images, typing indicators, read receipts, @mentions.
- The moderator posting in — or reading — Mafia chat.
- The moderator posting in Day chat.
- Any chat history surviving Play Again (all three channels are cleared, not archived).
- A mid-game reset/abort control (Play Again is strictly post-game-end).
- Match history, win/loss stats, or a running scoreboard across multiple Play Again rounds.
- Per-round chat resets (a fresh channel each night/day) — chat is one continuous stream per game.
- Rate limiting, profanity filtering, moderation tools (same 2a limitation — would need Cloud Functions / Blaze).
- Changing the moderator, the room code, or the joined-player roster as part of Play Again (all three are explicitly retained, not editable through this feature).
- **Changing what "Back to Home" does.** It stays exactly as it is in 2b — local navigation only, does not end the room. Play Again is purely an additional button alongside it; a stale, un-replayed room still only goes away via the existing abandon-timeout (spec-2b FR‑19). Revisiting that lifecycle is out of scope for this slice.

## Acceptance Criteria

- [ ] During the night, a living Mafia player sees a Mafia chat panel; a living Doctor/Detective/Civilian does not, and cannot read Mafia chat messages from the database directly (Security Rules verified).
- [ ] Two living Mafia players can chat with each other in real time during the night.
- [ ] The moment a Mafia player is eliminated, they lose both read and write access to Mafia chat — verified at the database level, not just hidden in the UI.
- [ ] A solo Mafia (only 1 Mafia in the game) has full Mafia-chat access despite having no `mafiaTeam` entry.
- [ ] During the day, every room member (living, eliminated, and the moderator) can see the Day chat; only living players have a way to post, and a post attempt from an eliminated player or the moderator is denied at the database level.
- [ ] Neither chat panel appears (or is postable) outside its phase — no Mafia chat visible during the day, no Day chat visible during the night.
- [ ] On the game-over screen, only the moderator sees Play Again; a player's or spectator's screen shows no such control.
- [ ] Tapping Play Again returns every connected device to the Waiting Room live, with the same room code, the same joined players, the same moderator, and the same role configuration intact.
- [ ] After Play Again, `game`, `mafiaTeam`, all of `rounds`, `publicRoles`, `privateRoles`, and all three chat channels are empty; every player's `alive` and `viewed` fields are cleared.
- [ ] A second Start after Play Again deals a fresh, independent shuffle and the game plays through night/day/win exactly as the first time, with no leftover data from the previous game observable anywhere.
- [ ] Play Again can be used more than once in the same room without issue.

## Settled Decisions (from this review)

- **D1 — Moderator can read Day chat, cannot post.** *(→ FR‑10)* *Why: matches 2a's lobby-chat read precedent for the moderator; posting is withheld to match FR‑16 of spec-2b ("the moderator does not act or vote").*
- **D2 — Moderator has zero access (read or write) to Mafia chat.** *(→ FR‑5, Edge Cases)* *Why: chat content is never consumed by resolver logic, unlike `privateRoles`/`mafiaTeam`, so there's no functional need — and withholding it keeps Mafia's privacy genuinely stronger than "hidden from other players but not the moderator."*
- **D3 — Play Again clears the original 2a lobby chat too, not just the two new channels.** *(→ FR‑12, Edge Cases)* *Why: a genuinely clean restart; avoids stale pre-game-1 chat reappearing in the game-2 lobby.*
- **D4 — Mafia-chat membership is checked via `privateRoles/{uid}/role === 'Mafia'`, not `mafiaTeam` existence.** *(→ Backend, Edge Cases)* *Why: a solo Mafia has no `mafiaTeam` entry (RTDB drops the empty `mates: []`, per Slice 2b task 4's finding) — checking `mafiaTeam` existence would incorrectly lock a lone Mafia out of their own chat.*
- **D5 — Both new chats are one continuous channel per game, not reset per round.** *(→ Backend, Edge Cases)* *Why: matches 2a lobby chat's own "doesn't reset while the room is open" behavior; the only reset boundary that makes sense is Play Again, which already resets everything else about the finished game.*
- **D6 — Chat write is phase-gated by Security Rules; chat read is not (for Mafia chat).** *(→ Edge Cases)* *Why: matches the exact precedent already set by `nightActions`/`votes` (write is alive+phase gated, read is alive/ownership gated only) — simpler and consistent rather than inventing a new pattern.*
- **D7 — A dead Mafia's chat block is permanent — it does not lift at game end.** *(→ FR‑4)* *Why: simplest rule (the `alive` check never carries a phase exception); matches how every other death-based restriction in this app works — nothing is retroactively reopened once revoked.*
- **D8 — Play Again shows a confirmation dialog before resetting.** *(→ FR‑11a)* *Why: reuses the existing `ConfirmDialog` component, already reserved for exactly this class of action (irreversible, affects everyone in the room) — Play Again clears far more than a routine button would.*
- **D9 — Mafia chat is completely absent from a non-Mafia's UI, not shown-but-locked.** *(→ FR‑5a)* *Why: matches this app's existing philosophy that secret structure isn't hinted at — a locked panel would itself leak "someone here is Mafia, chatting, and it isn't you."*
- **D10 — Play Again has no connection-count gate.** *(→ FR‑11)* *Why: it only returns the room to the lobby, not into a new game — Start already re-validates connected count before anything actually begins, so gating Play Again too would be a redundant blocker.*

---

*Next step (separate task, not this one): a task breakdown for 2c, then — before any code — the specific new Security Rules (mafiaChat/dayChat read+write grants, the moderator's new bulk-write grants on `rounds`/`chat`/`mafiaChat`/`dayChat`/`players/{uid}/viewed` needed for Play Again). No app code or rules changes until this spec is reviewed.*
