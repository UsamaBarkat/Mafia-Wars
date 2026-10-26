# spec-2d.md — Mafia Wars · Phase 2, Slice 2d (Jester, Cupid & Granny)

## Goal

Three new **online-only** roles. Unlike the four standard ones, each changes **who dies** or **who wins**:

- **Jester** (neutral): wins only if the town votes them out during the day.
- **Cupid** (Town): on Night 1 only, links two other players as **lovers**. If either lover dies, the other dies in the same moment.
- **Granny** (Town): if the Mafia's agreed night kill lands on her and the Doctor didn't save her, the Mafia player who locked in that kill first dies with her.

This builds directly on [spec-2b.md](spec-2b.md) (night/day resolver, `checkWin`, Security Rules model) and [spec-2c.md](spec-2c.md) (Play Again, `privateRoles`-based membership checks). No 2a/2b/2c behavior changes except where noted below. **Cutie is deferred**, so it isn't in this slice.

### Backend & mechanism (settled)

- **Firebase, Spark (free) plan, no Cloud Functions** (unchanged). The moderator's device is still the resolver (spec-2b D5).
- **One death can now cause more deaths.** Before 2d, a phase eliminated at most one player. Now Granny's retaliation and the lover link can add more. Both resolvers change from "one eliminated uid" to **"compute the complete set of deaths, then write it once"**:
  - Every `alive:false` flip, the public outcome and the phase/winner change go into **one atomic multi-path update**, as they already do today.
  - `checkWin` runs once, against the roster *after* every linked death.
  - No intermediate state, such as one lover dead and the other alive, is ever written or win-checked.
- **Lover pairing lives at a new per-player private path: `/rooms/{code}/lovers/{loverUid}/{partnerUid} = true`.** It is a map rather than a single `partnerUid` because the role config allows several Cupids (cap 20, D13). With more than one Cupid, a player can end up with more than one partner. Each lover reads **only their own** `lovers/{theirUid}` entry.
- **Cupid writes the pairing himself, in one atomic update.** That update contains:
  - his round‑1 night action `{role:"Cupid", action:"link", targetUid, secondTargetUid, submittedAt}`, and
  - both reciprocal `lovers` entries.

  The Security Rules tie each `lovers` entry to Cupid's own `link` action in that same write. Cupid can therefore only ever create entries for the exact pair he committed to. **Cupid's link can't be changed once confirmed** (D3). That keeps the rules simple and means stale `lovers` entries never need deleting mid-night.
- **The moderator gets no read on `lovers`.** The resolver still has to know the pairs to apply a heartbreak death. It derives them from **Cupid's round‑1 night action**, which it reads through the moderator read on `rounds/{n}/nightActions` that spec-2b already granted. So no new moderator read is added anywhere.

  Be honest about what this means: the moderator's *device* necessarily knows the pairing. That is the same trust boundary spec-2b D3 already accepts for every role and every secret night action ("secret enough for friends"). The moderator *console UI* never displays a pairing, at any point.
- **Roles are matched by name** (`"Jester"`, `"Cupid"`, `"Granny"`), exactly as the resolver already matches `"Mafia"`/`"Doctor"`/`"Detective"`. A custom role may not take any built-in role name (FR‑26).
- **Night-action `submittedAt` becomes a server timestamp** (`serverTimestamp()`), replacing the device's `Date.now()`. Granny's "first" rule compares timestamps from *different* Mafia phones, so device clock drift must not decide who dies. The rules don't add a `submittedAt === now` check (D10).

## User Scenarios

- **Jester.** Seven players, one of them a Jester who plays suspicious all of Day 2. The town votes them out 4–2. Every device jumps to the game-over screen: **"The Jester wins!"**, with every role revealed.
- **Jester killed at night.** The Mafia kill the Jester on Night 3. They just die and spectate. Later the last Mafia is voted out and **Town wins**. The Jester loses.
- **Cupid.** On Night 1, Cupid's screen asks for two players. He taps Priya and Sam, taps **Link lovers**, and confirms. From then on Priya's screen shows "💘 Your partner is **Sam**" and Sam's shows "💘 Your partner is **Priya**". No one else sees anything: not other players, not spectators, not the moderator console. On Night 3 the Mafia kill Sam, and the outcome reads "**Priya** and **Sam** were eliminated".
- **Lover saved.** The Mafia target Priya, but the Doctor protected Priya. No one dies, Sam is unaffected, and the link remains.
- **Granny.** Mafia Alex taps Granny at 23:01:05 and Mafia Jordan at 23:01:40. The picks agree and the Doctor protected someone else. "**Alex** and **Granny** were eliminated."
- **Granny, changed pick.** Alex picks Granny, switches to Sam, then switches back to Granny at 23:02:00. Jordan picked Granny at 23:01:40 and never changed. Jordan's final pick is the earlier one, so **Jordan** dies with Granny.
- **Granny and lovers.** Jordan (the Mafia who dies with Granny) is Cupid's lover with Sam. Granny, Jordan and Sam all die in one atomic write. The win check sees all three deaths at once.

## Functional Requirements

### Jester (neutral)

- FR‑1 — The Jester has **no night action**. At night they see the same "No action tonight" wait state as a Civilian.
- FR‑2 — **The Jester wins if, and only if, they are the player eliminated by the day vote** (the single most-voted living player, spec-2b FR‑12). None of these is a Jester win: being killed at night, dying as a lover (a heartbreak death), or a tie or Skip.
- FR‑3 — **A Jester win ends the game immediately for everyone.** `game.winner = "jester"`, the game-over screen shows **"The Jester wins!"**, and every role is revealed as usual (spec-2b FR‑15).
- FR‑4 — **A Jester win overrides every other win check.** Suppose the vote eliminates the Jester and their lover dies with them, and that would also leave Town or Mafia winning. The Jester alone still wins.
- FR‑5 — **For parity, a living Jester counts as a non-Mafia player.** Mafia win when living Mafia ≥ everyone else alive, Jester included. Town wins when living Mafia = 0. The Jester never shares a Town win.
- FR‑6 — A Detective who investigates the Jester learns **"not Mafia"**.

### Cupid (Town)

- FR‑7 — **Cupid acts on Night 1 only.** A living Cupid sees a picker of **every other living player**: he can't pick himself. He taps two different players, taps **Link lovers**, and confirms in a `ConfirmDialog` ("This can't be changed"). From Night 2 onward Cupid behaves exactly like a Civilian: no action, the wait state.
- FR‑8 — **Once confirmed, the link is final** (D3). Cupid's screen then shows "💘 You linked **A** and **B**" for the rest of the game, read from his own round‑1 action.
- FR‑9 — **If Cupid picks nobody before Night 1 ends, there are no lovers** for the whole game, and the night resolves normally.
- FR‑10 — **Each lover is privately told who their partner is.** "💘 Your partner is **X**" appears on that lover's own game screen, alive or spectating. It shows the partner's name only, never their role and never who Cupid is.
- FR‑11 — **Lovers are ordinary players.** They keep their own role, team, night action, vote and win condition. They have no shared win condition.
- FR‑12 — **If either lover dies in any way, the partner dies in the same atomic update.** "Any way" means a Mafia kill, a day vote, or being the Mafia taken down by Granny. Links chain: with several Cupids, the whole connected group dies together, and loops are handled.
- FR‑13 — **The link applies from Night 1's own resolution** (D7). A lover killed on Night 1 takes their partner with them that same night.
- FR‑14 — **Doctor and lovers:** a Doctor save cancels that lover's night death, so the partner is unaffected and the link stays. Protection only cancels the Mafia's kill on the protected player. It doesn't stop a heartbreak death (D8).
- FR‑15 — Cupid's own death doesn't break the link.

### Granny (Town)

- FR‑16 — Granny has **no night action**. She sees the same wait state as a Civilian.
- FR‑17 — **When the Mafia's agreed kill (spec-2b FR‑7) lands on Granny and the Doctor didn't protect her**, she dies, and one Mafia dies with her. That Mafia is chosen like this:
  - Among the **real Mafia** (by `privateRoles`) whose **final** night action that round is `kill` → Granny, pick the one with the **earliest `submittedAt`**.
  - Each change of pick overwrites the whole action with a new `submittedAt`, so "final pick" and "earliest" are unambiguous.
  - An exact tie is broken with the existing cryptographically secure `secureShuffle`, never `Math.random` (D9).
  - A Mafia who didn't submit is never chosen.
- FR‑18 — **If that Mafia is a lover, their partner dies too** (FR‑12). So does Granny's own partner, if she has one.
- FR‑19 — **If the Mafia disagree, there's no kill and nothing happens. If the Doctor saves Granny, nothing happens to anyone.** Granny's power triggers only on a Mafia night kill. Being voted out or dying as a lover takes no one with her. Doctor protection on the chosen Mafia doesn't save them (D8).
- FR‑20 — **Re-tapping your current night pick does nothing**: no re-save and no new `submittedAt`. Only switching to a different target re-saves. This way an accidental second tap can't cost a Mafia their "first" position.

### Resolver & win check

- FR‑21 — **Night resolution** (pure `resolveNight`, moderator's device):
  1. Compute the Mafia kill exactly as today: unanimous target, cancelled by Doctor protection.
  2. Apply Granny (FR‑17).
  3. Get the lover pairs from round‑1 `link` actions. Only a real Cupid's action counts, with two distinct players, neither of them Cupid.
  4. Close the death set over the lover links.
  5. Detective results: unchanged.
- FR‑22 — **Day resolution** (pure `resolveDay`): the tally is unchanged. Close the voted-out player over the lover links, and report whether the voted-out player was the Jester.
- FR‑23 — **`checkWin(aliveRoles, jesterVotedOut)`**: if a Jester was voted out, `"jester"`, which overrides everything. Otherwise living Mafia = 0 → `"town"`, and living Mafia ≥ everyone else alive → `"mafia"`. Otherwise `null`. It always runs on the roster after **all** linked deaths. If everyone is dead, the result is `"town"` (Mafia = 0 is checked first).
- FR‑24 — **Outcomes**: `nightOutcome`/`dayOutcome` gain `eliminatedUids` (a `uid → true` map, absent when no one died). Roles and causes never appear in them.
  - The night outcome lists the dead **sorted by name**. Resolution order would hint at who the Mafia target was.
  - The day outcome keeps `eliminatedUid` (the voted-out player, already public through the tally) and shows any extra deaths as "also eliminated".
  - For one release, the night outcome keeps writing `eliminatedUid` when exactly one player died, and the UI falls back to it when `eliminatedUids` is missing. That keeps old cached clients readable during deploy (D11).

### Security Rules

- FR‑25 — The rules changes are **additive**. No existing grant is widened.
  - **`nightActions/$uid`**:
    - A `link` action is valid only in these conditions:
      - `$n === '1'` and `game.round === 1` (the existing rule already requires `game.phase === 'night'`);
      - the writer's `privateRoles` role is `'Cupid'` and the action's `role === 'Cupid'`;
      - both targets are strings, distinct, not the writer, and alive.
    - A `link` can never be overwritten or deleted once written.
    - The existing kill/protect/investigate rules are untouched.
  - **`lovers`**:
    - **Parent**: moderator `.write` only, for the Play Again clear. **No `.read` for anyone, the moderator included.**
    - **`lovers/$uid` `.read`**: `auth.uid === $uid` only.
    - **`lovers/$uid/$partner` `.write`**: only a living Cupid (by `privateRoles`), only while `game.phase === 'night'` and `game.round === 1`, and only the value `true`. Cupid can never delete an entry.
    - **Validate**: both players are alive and distinct, neither is the writer, the reciprocal entry exists in the same write, and the pair matches the writer's own round‑1 `link` action in the same write.
  - **`game/winner`** also accepts `'jester'`.
  - **`nightOutcome`/`dayOutcome`** accept `eliminatedUids/$uid === true`.

### Role configuration & reveal

- FR‑26 — The **online** role config seeds **Jester, Cupid and Granny** as standard (non-removable) rows at **count 0, cap 20**.
  - A room seeded before 2d gets the missing rows backfilled at count 0 the next time its moderator opens the config.
  - A custom role named like any built-in role is blocked (case-insensitive), even if that role's row is missing.
  - **Phase 1 offline is unchanged**: its defaults stay the four standard roles.
- FR‑27 — The online reveal screen, both the big first reveal and the in-game "View my role", shows the role's **icon and one-line description**:
  - Jester 🃏: "Get voted out to win."
  - Cupid 💘: "Pick two lovers on the first night."
  - Granny 👵: "If the Mafia kill you, one of them dies with you."
  - The four standard roles reuse their Phase 1 icons and descriptions, and custom roles get the custom default.
- FR‑28 — The game-over screen shows **"The Jester wins!"** for `winner === "jester"`.
- FR‑29 — The moderator console never shows roles or pairings. Its night "X of Y role-holders have acted" counter counts a living Cupid **on Night 1 only**.

### Play Again

- FR‑30 — Play Again also clears `lovers`, as a **correctness requirement**: a stale entry would show a player a partner from the previous game. Round data (Cupid's `link` action, which the resolver reads) is already cleared with `rounds`.

## Edge Cases & Rules

- **Lovers on opposite teams are allowed** (Mafia + Town, Jester + anyone). Each keeps their own win condition.
- **Mafia may kill their own lover**, and the Mafia lover dies too.
- **Granny is a lover**: her partner dies with her. If the partner is the chosen Mafia, they die anyway; the death set has no duplicates.
- **A solo Mafia kills Granny**: that Mafia dies. If none remain, Town wins that same night.
- **Several Cupids** may pick overlapping pairs. The links form a graph, and the closure handles chains and loops (A–B, B–C, C–A all die together).
- **Several Grannies or Jesters**: there is only one Mafia kill per night, so at most one Granny triggers. The first Jester voted out wins.
- **Cupid killed on Night 1** still links. His action counts, just as an action from any player killed that night already counts.
- **Everyone dies at once** → Town wins (Mafia = 0).
- **Inference is part of the game.** `config/roles` is public, so a two-death night hints at Granny or lovers. The app never states a cause.
- **Randomness**: only the Granny exact-tie break, via `secureShuffle`. The deal is unchanged.

## Out of Scope (Slice 2d v1)

- **Cutie** (deferred).
- **Timers or countdowns** of any kind; phases stay moderator-advanced.
- **Custom-role night powers** (still powerless townsfolk, spec-2b D1).
- A lovers win condition. Revealing the pairing at game end. Telling a lover their partner's role or who Cupid is.
- Changing a Cupid link after confirming. Cupid acting after Night 1.
- Stating a cause of death. Doctor protection against heartbreak or Granny's retaliation.
- Adding these roles to Phase 1 offline mode.

## Acceptance Criteria

- [ ] Online config shows Jester/Cupid/Granny (count 0, cap 20, non-removable). A custom role can't use any built-in name. Phase 1 config is unchanged.
- [ ] The reveal shows each new role's icon and description.
- [ ] The Jester is voted out → the game ends with "The Jester wins!" and a full reveal, even when Town or Mafia would also win at that moment.
- [ ] The Jester killed at night, or dying as a lover, doesn't win. The Jester counts as non-Mafia for parity.
- [ ] Cupid (Night 1 only, alive) can link two distinct other living players exactly once. Each of these is **denied by rules**: linking himself, changing or deleting the link, linking on Night 2+, a non-Cupid writing `link` or `lovers`, and a dead Cupid acting.
- [ ] Each lover can read only their own `lovers` entry. Other players, spectators, Cupid and the moderator are denied (rules-verified).
- [ ] No Cupid pick → no lovers, and the night resolves.
- [ ] A lover dies by night kill, by day vote, or as Granny's Mafia → the partner dies in the same atomic write, and the win check sees all deaths.
- [ ] The Doctor saves a lover → no deaths, and the link persists.
- [ ] Granny killed → the Mafia with the earliest final `submittedAt` also dies. A changed pick re-times it. A tie is broken securely. A Doctor save or a disagreement → nothing happens.
- [ ] Night outcomes name every dead player (sorted, no role, no cause). The day outcome shows the voted-out player plus "also eliminated".
- [ ] Play Again clears `lovers`.
- [ ] 2b/2c regressions still pass: role secrecy, Mafia unanimous kill, Doctor cancel, Detective result, day tie/Skip, Town/Mafia wins, chats, Play Again.
- [ ] `tsc --noEmit` and `next build` are clean, with no `Math.random`.

## Settled Decisions

From the user's 2d brief, plus the "safest simple option" calls (marked ★) for anything unspecified.

- **D1 — The Jester counts as non-Mafia for parity, and a Jester win overrides every other win check.** *(→ FR‑4/5/23)*
- **D2 — A Jester win ends the game immediately for everyone.** *(→ FR‑3)*
- **D3 ★ — A Cupid link is confirmed once and then final.** *(→ FR‑7/8, FR‑25)* *Why: the rules can tie `lovers` entries to an immutable `link` action, so Cupid never has to delete stale entries and can never write extra pairs.*
- **D4 — Cupid can't pick himself.** *(→ FR‑7)*
- **D5 ★ — `lovers/{lover}/{partner} = true` map.** *(→ Backend)* *Why: cap 20 allows several Cupids, so a player may have more than one partner.*
- **D6 — No moderator read on `lovers`.** The resolver derives the pairs from Cupid's round‑1 action through the existing 2b moderator read on `nightActions`, and the console never displays them. *(→ Backend)* *Why: the moderator's device must know the pairs to kill a partner atomically on Spark. This adds no new read and keeps the spec-2b D3 trust boundary.*
- **D7 ★ — The link applies during Night 1's own resolution.** *(→ FR‑13)*
- **D8 ★ — Doctor protection only cancels the Mafia's kill on the protected player.** It doesn't stop heartbreak deaths or Granny's retaliation. *(→ FR‑14/19)*
- **D9 ★ — A Granny exact-tie is broken by `secureShuffle`.** *(→ FR‑17)* *Why: CLAUDE.md requires fairness randomness to be cryptographically secure.*
- **D10 ★ — `submittedAt` uses `serverTimestamp()`, and re-tapping the current pick is a no-op.** *(→ Backend, FR‑20)* The rules don't enforce `=== now`. If they did, any not-yet-refreshed old client (which writes `Date.now()`) would be locked out of night actions as soon as the rules deploy. This stays inside the existing "trusted-friends" model.
- **D11 ★ — Outcomes carry `eliminatedUids`.** The night outcome keeps `eliminatedUid` only for a single death, as a compatibility fallback. *(→ FR‑24)*
- **D12 ★ — The pairing isn't revealed at game end.** *(→ Out of Scope)* *Why: the brief says no one else may see the pairing, and a game-end reveal would need a new public node.*
- **D13 — Cap 20 for each new role; online-only; built-in names reserved; old rooms backfilled.** *(→ FR‑26)*
- **D14 ★ — Cupid counts in the moderator's "acted" counter on Night 1 only.** *(→ FR‑29)*

---

*Task breakdown: [tasks-2d.md](tasks-2d.md).*
