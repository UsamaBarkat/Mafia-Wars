# spec-2b.md — Mafia Wars · Phase 2, Slice 2b (Night/Day Game Engine)

## Goal

Turn the online room from Slice 2a into a playable game. After roles are dealt and each player has secretly seen their own role (where 2a ends), the game runs live **night → day** rounds: at night the special roles act in secret (Mafia eliminate, Doctor protects, Detective investigates); by day every living player discusses out loud and casts a **public** vote to eliminate someone. Rounds repeat until a win condition is met — **Town wins** when all Mafia are gone, **Mafia win** at parity. Eliminated players spectate but can't act or vote. Roles stay secret until the game ends.

This builds directly on [spec-2a.md](spec-2a.md) and the research in [research-2b.md](research-2b.md). The 2a lobby, deal, and reveal are unchanged; 2b is what happens *after* the reveal.

### Backend & trust model (settled)

- **Firebase, Spark (free) plan — no Cloud Functions** (unchanged from 2a).
- **The moderator's device is the "resolver."** Just as it dealt the roles in 2a, in 2b it reads the secret inputs each phase (night actions, votes), computes the outcome, and writes back only the **public** result. Players never see each other's secret inputs. This is **"secret enough for friends," not bulletproof** — a determined non-playing moderator could cheat resolution — the same trade-off accepted in 2a, now applied every phase.
- **The moderator is granted read access to `privateRoles`** (new for 2b) so the resolver can apply night powers and detect wins. The moderator already dealt the roles; **players still cannot read each other's roles.**
- **Public day votes are auditable** — every client can recompute the day tally, so a dishonest day-elimination would be visible. The night is irreducibly trust-heavy because its inputs are secret.

## User Scenarios

- Six friends have joined, roles are dealt (2 Mafia / 1 Detective / 1 Doctor / 2 Civilian), everyone has seen their role. The moderator taps **Begin Night 1**.
- **Night 1.** Each Mafia's phone shows their fellow Mafia and a target picker; they both tap "Priya." The Doctor protects "Sam." The Detective investigates "Alex" and privately learns "Alex is not Mafia." Civilians wait. The moderator taps **End Night**.
- The app announces to everyone: **"Priya was eliminated last night."** (Her role is not shown.) The game moves to **Day 1**.
- **Day 1.** The five survivors argue out loud. On their phones they vote publicly; the tally updates live. "Alex" gets 3 votes, "Sam" 2. The moderator taps **End Day** → **"Alex was eliminated."**
- Nights and days continue. Eventually the last Mafia is voted out; the app declares **"Town wins!"** and reveals everyone's role. Priya (eliminated on night 1) watched the whole thing as a spectator.

## Functional Requirements

### Game start (on-ramp from 2a)

- FR‑1 — After the 2a deal and reveal (all players have viewed their role), the **moderator begins the game**. All players are marked **alive**, the game enters **Night 1**, and each player's device transitions from the reveal to the game.
- FR‑2 — Each **Mafia** is privately shown who their **fellow Mafia** are (readable only by them). No other role learns anyone's role. A player can **re‑view their own role** at any time during the game (their own private role only, per the 2a rules).

### Night phase (secret actions)

- FR‑3 — During the night, each **alive** role‑holder with a night power acts **secretly**:
  - **Mafia** — choose a living player to eliminate.
  - **Doctor** — choose a living player to protect (may protect themselves).
  - **Detective** — choose a living player to investigate.
  - **Civilians and custom roles** — no night action; they wait.
  Each choice is written to a **per‑player secret location** readable only by that player and the moderator (the `privateRoles` pattern).
- FR‑4 — Night choices are **hidden from other players** by Security Rules (not just the UI): a player cannot read another player's action or target from the database or dev tools.
- FR‑5 — A role‑holder who does not submit before the night ends is treated as **taking no action** that night.
- FR‑6 — Only the **moderator** ends the night. Ending it triggers the moderator's device to resolve the night.

### Night resolution

- FR‑7 — The **Mafia kill succeeds only if every submitted Mafia pick names the same target** *(revised — see D6)*. If two or more Mafia submit **different** targets and the night ends before they converge, **no one dies** — the same outcome as a Doctor-saved kill, not a random pick. (A Mafia who never submits doesn't count as disagreeing — see D6/FR‑5.) If the Mafia agree on a target and the **Doctor protected that same player**, **no one dies**; otherwise the agreed target is **eliminated** (marked not‑alive).
- FR‑8 — The **Detective** privately learns **whether their investigated target is Mafia** (a private result readable only by the Detective). No other player sees it.
- FR‑9 — After resolution, a **public night outcome** is shown to everyone — **who was eliminated, or "no one died"** — **without revealing any role**. The game advances to **Day** (unless a win condition is met — FR‑14/15).

### Day phase (public voting)

- FR‑10 — During the day, every **alive** player casts a **public** vote for a living player to eliminate, or votes **"Skip"** (eliminate no one). The tally is **visible to everyone in real time**. A player may **change their vote** until the day ends. **Eliminated players cannot vote** (enforced by rules).
- FR‑11 — Only the **moderator** ends the day. Ending it triggers the tally on the moderator's device.
- FR‑12 — The eliminated player is the living player with the **most votes**. A **tie**, or **"Skip" winning or tying** the top spot, eliminates **no one**. The result (who was eliminated, or "no one") is **public**; **roles are not revealed**.
- FR‑13 — After the day, the game advances to the **next night** (unless a win condition is met).

### Win detection & game end

- FR‑14 — After **every** elimination (night or day), the resolver checks the win. **Mafia team** = players whose role is Mafia; **Town** = everyone else (Detective, Doctor, Civilian, and any custom roles). **Town wins** when living Mafia = 0. **Mafia win** when living Mafia **≥** living Town (parity). Otherwise the game continues.
- FR‑15 — When a win condition is met, the **game ends**: the **winner (Town or Mafia) is announced** and **all players' roles are revealed publicly** on a game‑over screen. **This is the only point roles become public.**

### Moderator game console

- FR‑16 — During the game the moderator sees a **console**: the current phase (**Night N / Day N**), the **living and eliminated** players, and controls to **End Night** / **End Day** (advance phases) and, at the start, **Begin Night 1**. The moderator's *device* reads roles and secret actions to resolve, but the moderator's **UI never displays any player's role until game end** (consistent with 2a). The moderator does **not** act or vote.

### Eliminated players (spectate)

- FR‑17 — An eliminated player sees a **spectator view**: the current phase, who is alive/eliminated, the **public day‑vote tally**, and the night/day outcomes. They **cannot** submit night actions or vote (enforced by rules) and **cannot** see other players' roles or secret actions. At game end they see the full reveal.

### Reconnect & moderator presence

- FR‑18 — Refresh/reconnect returns a device to the **correct current view** for the phase and the player's status: their night action (if pending), the day vote, the spectator view (if eliminated), or the game‑over screen; the moderator reconnects to the console. (Extends the 2a reconnect‑by‑identity.)
- FR‑19 — The game **requires the moderator present** to resolve phases (they are the engine). If the moderator **abandons/leaves mid‑game**, the game **cannot continue and is ended/abandoned for everyone**, reusing the 2a moderator‑heartbeat / dead‑room handling. **No auto‑transfer** of the moderator.

## Edge Cases & Rules

- **Night first.** Round 1 opens on the **night** phase.
- **Mafia know each other; nobody else knows any role.** Each Mafia privately sees their teammates (needed to agree on a shared kill target — D6); all other roles see only their own role.
- **Doctor.** May protect anyone including **themselves**; repeated protection of the same player across nights is **allowed** (no restriction in v1).
- **Detective.** Learns only **Mafia / not‑Mafia** for the target, not the exact role.
- **Custom roles** (added in the 2a config) are treated as **power‑less townsfolk** in 2b: no night action, and they **count as Town** for win detection.
- **Death is public, role is not.** When a player is eliminated, everyone sees **who** died (they leave voting/acting), but **not their role** — roles stay hidden until game end.
- **Ties / Skip / disagreement → no elimination.** At night: the Doctor cancels the agreed target, or the Mafia simply never converge on one target (D6). At day: a vote tie or a Skip win.
- **Rule‑enforced integrity (no trust needed):** each player writes only their **own** action/vote; only **alive** players may act/vote; actions only in **night**, votes only in **day** (phase‑gated); secret night actions are unreadable by other players (per‑uid read + no cascade); only the **moderator** writes outcomes (eliminations, alive flips, phase/round, winner). Public day votes make the day tally **auditable**.
- **Trust‑dependent (moderator's device):** correctly combining secret night actions, the detective's result, and win detection. Same acceptance as the 2a deal.
- **Moderator sees no roles in‑game.** The moderator's device reads roles to resolve, but the moderator UI does not display them until the end.
- **All players eliminated / degenerate counts** can't really occur: at most one player is eliminated per phase, so a Mafia kill that empties the town simply triggers Mafia parity → Mafia win.
- **No in‑game chat.** Day discussion happens out loud (in person or over a voice call), like real Mafia.

## Out of Scope (Slice 2b v1 — later or never)

- **Custom‑role night powers / special abilities** — custom roles are power‑less townsfolk in v1.
- **Additional standard roles/powers** beyond Mafia / Detective / Doctor / Civilian (e.g. Vigilante, Jester win conditions, role‑blockers).
- **Automatic phase timers / countdowns** — the moderator advances phases manually.
- **In‑game chat of any kind** — living chat, dead chat, spectator chat.
- **Reveal‑on‑death** — roles are hidden until the game ends.
- **Moderator transfer / claim mid‑game** — abandonment ends the game (no auto‑transfer).
- **Secret/anonymous ballots** — day votes are public.
- **Server‑side (Cloud Function) resolution** — stays on the moderator's device (Spark).
- **Accounts, match history, spectator‑only joiners, rejoining after full app close, matchmaking.**

## Acceptance Criteria

- [x] After the 2a deal, the moderator can **Begin Night 1**; players enter the game and all start **alive**. *(task 4 — 12/12 emulator checks; re-confirmed in task 13's end-to-end pass)*
- [x] Each **Mafia** is privately shown their fellow Mafia; no non‑Mafia can see anyone's role. *(task 4; re-confirmed in task 13's end-to-end pass — Detective denied reading M1's mafiaTeam, Civilian denied reading M1's privateRole)*
- [x] At night, Mafia / Doctor / Detective each submit a **secret** target; another player **cannot** read that choice from the database or UI. *(task 5 — 7/7 emulator checks; re-confirmed in task 13)*
- [x] With 2 Mafia, the kill target is the **majority** of their picks; a **Doctor protecting that target cancels the kill** (no death). *(task 3 pure logic + task 6 client resolver — 14/14 emulator checks incl. self-save; task 13 re-ran BOTH the majority-kill-executes and the Doctor-cancels-the-actual-target cases fresh)* — **superseded by D6's revision** (post-2c playtesting): with 2+ Mafia, the kill now requires all submitted picks to name the same target; disagreement ⇒ no death, same as a Doctor save. Re-verification pending.
- [x] The Detective **privately** learns whether their target is Mafia; no one else sees the result. *(task 6; re-confirmed in task 13 — Civilian denied reading the Detective's private nightResults)*
- [x] Ending the night shows a **public** outcome ("X was eliminated" / "no one died") **without revealing roles**, then advances to Day. *(task 6; re-confirmed in task 13 — outcome object has only `eliminatedUid`+`resolvedAt`, no role field)*
- [x] At day, all **alive** players vote **publicly** (or Skip), see the **live tally**, and can **change** their vote; **eliminated players cannot vote**. *(task 7 — 6/6 emulator checks; task 13 re-ran a live vote CHANGE plus the dead-vote-denied case fresh)*
- [x] Ending the day eliminates the **most‑voted** living player; a **tie or Skip‑win eliminates no one**; the result is public and roles stay hidden. *(task 8 — 12/12 emulator checks; task 13 re-ran majority-elimination in the main narrative plus tie/Skip-win in a supplementary check)*
- [x] **Town wins** when all Mafia are eliminated; **Mafia win at parity** (Mafia ≥ Town); the game ends and **all roles are revealed**. *(task 9 — 11/11 emulator checks; task 13 re-ran BOTH win conditions fresh, each confirming `publicRoles` reveals every dealt player)*
- [x] Eliminated players can **spectate** (phase, tally, outcomes) but **cannot act or vote**, and cannot see others' roles until game end. *(task 10 — user-verified with a real 5-player game; task 13 re-confirmed the eliminated player can read the roster/outcomes, is denied voting, and is denied reading others' privateRoles)*
- [x] A player who **refreshes mid‑game** returns to the **correct phase view** (night action / day vote / spectator / game over). *(task 11 — 10/10 logic checks + user-verified all 4 cases; unchanged by task 13, not re-run)*
- [x] The **moderator console never shows player roles** until game end; the moderator does not act or vote. *(task 13 — code-reviewed line-by-line: `ModeratorStarted.tsx` never reads role data pre-`ended`, never renders `NightAction`/`VotePanel`; the moderator's own `privateRoles` READ access is confirmed live but is resolver-only, never displayed)*
- [x] If the moderator **abandons mid‑game**, the game **ends/abandons cleanly** for everyone (2a dead‑room handling). *(task 12 — 7/7 logic checks + user-verified; unchanged by task 13, not re-run)*

**Task 13 (2026‑09‑09) ran a fresh, integrated end-to-end pass — not just citations to old per-task runs:** one continuous 6-player + moderator game played through the REAL exported functions (`beginNight1`, `resolveNightOnClient`, `resolveDayOnClient`) against the live Auth+RTDB emulator with 7 real signed-in identities (mirroring 7 browser tabs), plus supplementary scratch-room checks for the Doctor-cancel, day-tie/Skip, and both win-condition cases the main narrative doesn't naturally reach in one line — **31/31 checks passed**. `tsc --noEmit` and `next build` both clean; no `Math.random` anywhere in the codebase (grepped); no debug scaffolding (`console.log`, `TEMP(...)`, stray `__tmp_*` files) in any shipped file. Two real polish fixes applied and re-verified: the moderator's **End Night**/**End Day** buttons were red (miscategorized as destructive) and are now green, matching **Begin Night 1** and the "green = online/moderator action" convention; the compact post-reveal **"View my role"** toggle was green and is now red, matching **Hide** and the "red = role reveal" convention used everywhere else in the app (Phase 1's reveal screen included). A stray spacing inconsistency (the in-game wrapper's `gap-4` vs. the app-wide `gap-6` convention used by every other screen with this exact layout) was also corrected.

## Settled Decisions (from the 2b research review)

Recorded for traceability; all fold into the requirements above.

- **D1 — Roles in v1:** standard four only (Mafia, Detective, Doctor, Civilian). No custom‑role night powers; custom roles are power‑less townsfolk that count as Town. *(→ FR‑3, Edge Cases)*
- **D2 — Votes are public** and live (auditable, less trust). *(→ FR‑10/12)*
- **D3 — Moderator gets read access to `privateRoles`** for resolution and win detection; player‑to‑player secrecy is unchanged. *(→ Backend, FR‑7/8/14)*
- **D4 — No in‑game chat** in v1; day discussion is out loud. *(→ Out of Scope)*
- **D5 — Stay on Spark**, moderator's device is the resolver (same trust model as the 2a deal). *(→ Backend)*
- **D6 — Multi‑Mafia kill requires unanimous agreement on one target; disagreement means no death, not a random tie-break.** *(→ FR‑7)* *(Revised — original v1 decision was "majority target, ties broken randomly (crypto‑secure) on the resolver." Changed after real playtesting once Mafia chat ([spec-2c.md](spec-2c.md)) gave Mafia an actual channel to coordinate on a shared target during the night; with that coordination possible, letting the resolver silently override a genuine disagreement with a random pick felt like the app deciding the kill instead of the Mafia team. The `secureShuffle`-based tie-break code itself was not deleted — it's the same general-purpose shuffle `lib/assignment.ts` already uses for the role deal — only `resolveNight.ts`'s kill-target logic stopped calling it for this case.)*
- **D7 — Day: no elimination on a tie; a "Skip" vote is allowed.** *(→ FR‑10/12)*
- **D8 — Roles revealed only at game end**, not on death. *(→ FR‑15, Edge Cases)* **Mechanism (resolved at task 9):** a moderator‑written public `publicRoles` map (uid→role), gated so it's writable only once `game.phase === 'ended'` — not opening `privateRoles` reads, to avoid touching the core secrecy rule and to keep an explicit, auditable "reveal" write (matching `nightOutcome`/`dayOutcome`/`mafiaTeam`'s pattern).
- **D9 — Mafia win at parity** (Mafia ≥ Town); Town wins when Mafia = 0. *(→ FR‑14)*
- **D10 — Manual phase advance** by the moderator (no timers). *(→ FR‑6/11/16)*
- **Derived — Mafia know each other** (privately shown teammates), required by the unanimous-target model (D6). *(→ FR‑2, Edge Cases)* — flag for review.
- **Derived — Night first;** Doctor may self‑save and repeat‑save; Detective learns team (Mafia / not) only. *(→ Edge Cases)* — sensible defaults, adjustable.

---

*Next step (separate task, not this one): a task breakdown for 2b, then — before any code — the specific Security Rules changes (new night/vote/game nodes, alive‑ and phase‑gating, moderator read on `privateRoles`). No app code or rules changes until this spec is reviewed.*
