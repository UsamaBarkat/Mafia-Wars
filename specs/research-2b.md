# research-2b.md — Phase 2, Slice 2b (Night/Day Game Engine) · Research Pass

Status: **research only** — options, trade-offs, recommendations, and unknowns. Not a spec, not a design, no app code. Backend stays **Firebase, Spark (free) plan, Realtime Database (RTDB), Anonymous Auth, no Cloud Functions** (per [research-phase2.md](research-phase2.md) and [spec-2a.md](spec-2a.md)).

2b picks up exactly where 2a ends — after the secret role deal and per-device reveal. It adds the live game: repeated **night → day** rounds until a win condition is met, with eliminated players spectating. Everything here is tagged **[2b]**.

## The one idea that shapes everything: the moderator is the game engine

2a established the pattern: on Spark there are no Cloud Functions, so the **moderator's device is the trusted "server."** It dealt the roles (it held the full mapping) while Security Rules kept players from reading each other's roles. 2b extends this directly — the moderator's device becomes the **resolver**: each night and day it reads the secret inputs (actions, votes), computes the outcome (who dies, detective result, win check), and writes back only the **public** result. Players never see each other's secret inputs; they only see outcomes.

This is still **"secret enough for friends," not bulletproof** — a determined moderator could cheat resolution — but the moderator is a non-playing host, so it doesn't advantage their own play. The rest of this doc is mostly "what can Rules enforce on their own" vs "what has to trust the resolver," and how to store state so the resolver can combine it fairly.

**One rule change 2b needs up front:** in 2a the moderator could *not* read `privateRoles` back (only write). To resolve nights and compute wins, the resolver must know who is Mafia / Detective / etc. So 2b must **grant the moderator read access to `privateRoles`** (they dealt them anyway — no real loss; players still can't read others'). Flagged again in §4 and §6.

---

## 1. Modeling night actions [2b]

**Storage shape (recommended) — per-actor secret nodes, same pattern as `privateRoles`:**

```
/rooms/{code}/rounds/{n}/
  nightActions/{uid}: { role, action, targetUid, submittedAt }   // secret: read own + moderator
  nightResults/{uid}: { targetUid, result }                      // e.g. detective's private finding: read own only
  nightOutcome:       { eliminatedUid | null, savedUid?, ... }   // PUBLIC result, read by all
```

- `nightActions/{uid}` is readable **only by that uid and the moderator** (the resolver must read all of them). Writable only by that uid — and only while it's night and they're alive and hold a role with a night power. This is the `privateRoles` shape plus moderator-read.
- The moderator/resolver reads every `nightActions/{uid}`, combines them, writes the **public** `nightOutcome` and any **private** `nightResults/{uid}` (e.g. the detective's answer, readable only by the detective), flips the eliminated player's `alive` flag, then advances the phase.

**Options for combining simultaneous actions:**
- **(A) Moderator-client resolver [recommended].** The moderator's device reads all secret actions and applies the rules: Doctor's save cancels Mafia's kill on the same target; the Detective learns their target's team; custom roles apply their power. Ties/ambiguity are broken on-device (e.g. `crypto.getRandomValues`, never `Math.random`). Matches 2a; Spark-compatible.
- **(B) Deterministic client-agreed resolution (no moderator).** Every client independently computes the same outcome from the inputs — but that requires revealing the secret inputs to all clients, which **leaks who did what**. To avoid the leak you'd need a cryptographic **commit-reveal** (each actor commits a hash, reveals later, everyone verifies) — real integrity, but heavy for a friends' game and awkward with private results like the detective's.
- **(C) Cloud Function resolver [Blaze].** Gold standard — server reads secrets, writes outcomes, nobody's device holds everything. Needs the Blaze plan.

**Multi-Mafia coordination** is its own sub-question: if there are 2+ Mafia, whose target wins?
- Each Mafia submits a target; resolver takes the **majority** (ties → resolver picks, e.g. random among tied), OR
- Require **consensus** (all Mafia must pick the same target, else no kill), OR
- A designated **Mafia leader** submits the one kill, with a Mafia-only shared view so they coordinate.

**Trade-offs:** (A) is simple, reuses 2a, but needs the moderator online each night and trusts their device. (B) is trust-minimizing but complex and leak-prone without commit-reveal. Majority-target is forgiving; consensus is stricter but can stall.

**Recommendation:** **(A) moderator-client resolver** with per-actor secret nodes and public outcome nodes. For Mafia coordination, start with **majority target** (simplest, never stalls). Keep the resolver logic pure and testable (a function: inputs → outcome), reused straight from a `lib/` module.

**Still unknown:** multi-Mafia model (majority vs consensus vs leader + Mafia channel); whether a role-holder who doesn't submit = "no action" (recommend yes, auto-skip); night timing (wait for all vs moderator ends night); whether the Doctor may self-save / save the same person twice.

---

## 2. Day voting [2b]

**Storage shape (recommended):**

```
/rooms/{code}/rounds/{n}/votes/{voterUid}: { targetUid | "skip" }   // one entry per living voter
/rooms/{code}/rounds/{n}/dayOutcome:       { eliminatedUid | null }  // PUBLIC
```

**Public vs hidden votes:**
- **(A) Public live votes [recommended].** Everyone (survivors) reads votes as they're cast — a live tally, like hands raised in a room. Rule: readable by room members; writable only by the voter, only if alive and it's the day phase.
- **(B) Hidden until reveal.** Votes are per-uid secret (read own + moderator) until the moderator reveals the tally — a secret ballot. Needs the resolver to reveal, and is more trust-heavy.

**Big security upside of public votes:** the day tally is **auditable** — every client can recompute the elimination from the public votes and would notice a dishonest resolver. So the **day phase needs far less trust than the night phase.** (Night stays trust-heavy because its inputs are necessarily secret.)

**Tie handling** — options: no elimination on a tie (common, safe), a moderator tie-break, a revote, or random among tied. **Skip/no-lynch**: allow a "skip" vote so the town can choose to eliminate nobody.

**How a vote resolves into an elimination:** when the day closes (all survivors voted, or the moderator ends the day, or a timer), the resolver tallies and writes `dayOutcome.eliminatedUid`, flips that player's `alive`, checks win (§4), and advances to night. Because votes are public, the resolver's tally is verifiable.

**Trade-offs:** public = simpler, more social, auditable, less trust — but no secret-ballot drama. Hidden = secret-ballot feel but more machinery and trust. Changeable-before-close votes are friendlier but add churn.

**Recommendation:** **public live votes** among alive survivors, with a **"skip"** option and **no elimination on a tie** as the default (moderator can be given an override later). Votes changeable until the day closes. Rules enforce write-own + alive + day-phase.

**Still unknown:** exact tie policy and whether the moderator can override; whether the moderator ends the day manually vs a timer; whether a majority is required or a plurality suffices; whether the moderator themselves ever votes (no — non-playing).

---

## 3. Round / phase state machine [2b]

**Representation (recommended) — a dedicated `game` node, separate from 2a's `meta.status`:**

```
/rooms/{code}/game: { phase: "night" | "day" | "ended", round: number, winner?: "town" | "mafia" }
/rooms/{code}/players/{uid}/alive: boolean   // set true at deal; resolver sets false on elimination
```

`meta.status` stays `"in_game"` for the whole match; the finer **phase/round** lives in `game`. (Overloading `meta.status` with `night`/`day` was considered but muddies the lobby-lifecycle enum — a separate node is cleaner and the rules stay legible.)

- **Who acts/votes:** night → alive role-holders with a night power; day → all alive survivors. Eliminated players (`alive === false`) are excluded — enforced in Rules by referencing the `alive` flag and `game.phase`.
- **Transitions:** the resolver (moderator) advances `night → day → night …` after each resolution. Classic order is **night first** (round 1 opens on night).
- **Timers:** options — (a) **no timers, moderator advances manually** with "End Night" / "End Day" buttons [recommended]; (b) soft countdown display the moderator can end early; (c) hard auto-advance timers. Manual advance fits the "moderator is the host" model, needs no reliable server clock (hard on Spark), and lets the group set its own pace. A visible countdown can be layered on later, but a *hard* timer would want a server clock/cron (Blaze).

**Trade-offs:** separate `game` node = a couple more nodes but clean rules and easy reconnect-restore; manual advance = flexible and Spark-friendly but leans harder on the moderator being present.

**Recommendation:** a `game` node (`phase`/`round`/`winner`), an `alive` flag per player set at deal time, **night-first**, and **moderator-driven manual phase advance** (no hard timers for v1).

**Still unknown:** whether round 1 skips the first night (some variants open on day); whether the moderator can undo/rewind a phase; how reconnect restores the right in-phase view (extends 2a reconnect — see §7); pruning old `rounds/{n}` data (small at hobby scale, but grows).

---

## 4. Win detection [2b]

**When:** re-check after **every** elimination (night kill or day vote).

**Standard conditions:**
- **Town wins:** Mafia alive count === 0.
- **Mafia wins:** Mafia alive count **≥** town alive count (parity — once Mafia can't be out-voted). (A stricter variant is "Mafia > town"; parity is the common rule.)
- **Custom-role win conditions** (e.g. a Jester who wins if voted out) are per-role and can override/short-circuit the above — genuinely complex. Likely **defer**: v1 supports the standard four roles' win logic; custom roles either have no special win or are handled case-by-case later.

**Who computes it — and the rule change it forces:** counting living Mafia requires knowing who is Mafia. The resolver (moderator's device) must therefore **read the roles.** In 2a the moderator could *not* read `privateRoles` back. So 2b must either:
- **(A) grant the moderator read on `privateRoles/*` [recommended]** — one rule change; the moderator already dealt them, players still can't read others'; the resolver can re-read the full mapping any time (survives a moderator refresh); or
- **(B) at deal time, write a moderator-only team map** (`/rooms/{code}/private/moderator/teams: {uid: "mafia"|"town"}`, readable only by the moderator) — avoids touching `privateRoles` reads but is redundant bookkeeping.

**Ending cleanly:** on a met condition the resolver sets `game.phase = "ended"`, `game.winner`, and (optionally) writes a **public roles reveal** so everyone finally sees who was what; the app shows a game-over screen. Reuse 2a's `meta.status = "ended"` semantics / dead-room handling for teardown.

**Trade-offs:** standard conditions are a trivial pure function; custom-role wins are the hard part. (A) is the least code and most robust (resolver can always recompute); (B) keeps `privateRoles` strictly write-only-by-mod but duplicates data.

**Recommendation:** implement **standard town/Mafia** win checks as a pure `lib/` function (inputs: alive counts by team), run after each elimination; **grant the moderator read on `privateRoles`** (option A) so the resolver has the team knowledge it needs; **defer custom-role win conditions**. Reveal all roles at game end.

**Still unknown:** parity vs strict-majority threshold; simultaneous/edge win cases (e.g. a night kill that empties both sides); whether to reveal roles at end (recommend yes); how custom roles fit win logic.

---

## 5. Eliminated players (spectate, don't act/vote/leak) [2b]

- **Marker:** `players/{uid}/alive = false`, set by the resolver on elimination.
- **Can't act or vote — Rule-enforced:** night-action and vote writes require `players/{auth.uid}/alive === true`. So a dead player literally cannot write an action or vote (not just hidden in the UI). This is one of the strongest *rule-enforceable* properties in 2b.
- **Spectate:** dead players keep reading **public** game state (phase, round, outcomes, live day votes) and continue watching the match. Their own past private info (e.g. a detective's earlier results) stays theirs; they gain **no new secret info** through the app.
- **Leak prevention:** the app can stop in-app leaking (dead can't post to a living channel) but obviously can't stop someone talking out loud — that's a table rule. Keep the surface minimal: dead players see outcomes, not other players' secret inputs.
- **Reveal-dead-roles question:** some variants reveal a player's role publicly when they die; others keep it hidden until game end. Options: reveal-on-death (more info, more drama) vs hide-until-end (more mystery). Flag.
- **In-game chat question (new — 2a chat was lobby-only):** options — **(a) no in-app in-game chat** (players discuss by voice/in person) [simplest]; **(b) living-only chat**; **(c) separate dead chat**. Dead chat + living chat is the most work and the most leak-prone if mis-scoped.

**Recommendation:** `alive` flag gating all action/vote writes via Rules; dead players get a clean **spectator view** (public state only). Start with **no in-game chat** (or lobby-style living-only if wanted) and **defer reveal-on-death** (hide roles until game end) unless play-testing wants otherwise.

**Still unknown:** reveal-on-death vs at-end; in-game chat scope; whether dead players see the *night* proceedings or only day/outcomes; spectator UX detail.

---

## 6. Fairness / security on Spark — the trust model, explicitly [2b]

**What Security Rules CAN enforce on their own (no trust needed):**
- ✅ Each actor writes only **their own** action/vote (`auth.uid === $uid`).
- ✅ Only **alive** players act/vote (`players/{auth.uid}/alive === true`).
- ✅ Actions/votes only in the **right phase** (`game.phase` check in the rule).
- ✅ Secret night actions are **unreadable by other players** (per-uid read + no cascade — the `privateRoles` pattern; moderator additionally readable for resolution).
- ✅ Only the **moderator** writes outcomes — `alive` flips, `nightOutcome`, `dayOutcome`, `game.phase`, `game.winner`.
- ✅ If day **votes are public**, the tally is **auditable** — any client can recompute it and catch a dishonest elimination.

**What Rules CANNOT enforce — must trust the resolver (moderator's device):**
- ❌ Correctly **combining** secret night actions (kill-vs-save, who dies). Rules can't read several secret nodes and compute.
- ❌ Correct **detective result** (needs role knowledge).
- ❌ Correct **win detection** (needs role knowledge).
- ❌ The moderator not **fabricating** outcomes. They're a non-playing host — same acceptance as the 2a deal.

**Net trust model:** players **cannot cheat** (can't read others' secrets, can't act while dead, can't act out of phase, can't vote twice, can't forge someone else's action). The **moderator's device is trusted** to resolve honestly — exactly the 2a posture, now applied every phase instead of once. **Public day votes** shrink the trust surface for the day; the **night** is irreducibly trust-heavy without server-side resolution.

**Blaze upgrade path:** move resolution into a **Cloud Function** — server-authoritative outcomes, no device holds everything, moderator trust eliminated. Same decision that hangs over 2a. Everything here is designed so that swap is a later change, not a rewrite.

**Recommendation:** accept the **moderator-resolver trust model**; push **as much as possible** into Rules (own-writes, alive-gating, phase-gating, secret reads, moderator-only outcomes); make **day votes public** for auditability; keep resolution logic in pure, testable `lib/` functions so it can later move to a Function unchanged. **Document the trust boundary in the spec**, like 2a did.

**Still unknown:** whether to invest in commit-reveal for night integrity (likely overkill); whether votes should be public (recommended) or secret; the Spark-vs-Blaze decision (still the biggest lever).

---

## 7. Reuse from 2a — what carries over vs needs extending [2b]

**Carries over directly:**
- **Identity** — Anonymous Auth + `useAuthUid`, unchanged.
- **Room model & paths** — `lib/room/paths.ts` + `types.ts`; add `game`, `rounds/{n}/…`, and a per-player `alive` field.
- **Subscriptions** — the generic `useDbValue<T>` + typed hooks pattern extends cleanly to `useGamePhase`, `useNightAction`, `useVotes`, `useMyNightResult`, `useNightOutcome`, etc.
- **Presence** — `players.connected` / `lastSeen`; now doubly useful ("is the actor online to submit?").
- **Moderator-as-authority** — moderator-only writes and the moderator-resolver pattern extend from "config + deal" to "resolve every phase."
- **Room lifecycle** — the moderator **heartbeat** + `roomDeadReason` + abandon handling reused as-is; a mid-game moderator abandon ends the match (same teardown).
- **Reconnect-by-identity** — reused; must be **extended** to restore the correct *in-phase* view.
- **The 2a deal & reveal** — stay; `alive=true` is added to each player at deal time; the reveal becomes the on-ramp into round 1.

**Needs extending / new:**
- **Phase/state** — new `game` node (phase/round/winner) and the night/day loop.
- **Security Rules** — new nodes (`nightActions`, `nightResults`, `nightOutcome`, `votes`, `dayOutcome`, `game`); **alive-gating and phase-gating** on writes; and the **moderator-read-`privateRoles`** change (§4).
- **Moderator UI** — 2a's "who has viewed" view grows into a **moderator game console**: see alive/dead, "resolve night", "end day", advance phases, end game.
- **Player UI** — new **night action** screen (role-specific target picker), **day vote** screen (live tally), **dead/spectator** screen, **game-over** screen.
- **Resolver module** — a new pure `lib/` engine: `resolveNight(actions, roles) → outcome`, `resolveDay(votes) → outcome`, `checkWin(aliveByTeam) → winner|null`. Testable offline (like Phase 1's shuffle/validation), then wired to the moderator's device.
- **Bigger reliance on the moderator being present** — 2a's moderator could idle in the lobby; 2b's moderator is a continuous engine resolving each phase. This raises the stakes on abandon handling and reconnect.

**Still unknown:** whether custom roles get night powers in v1 (big scope driver — recommend standard-four first); how much of the round history to retain vs prune; whether the moderator needs an "undo phase" affordance.

---

## Summary: recommendations & the decisions that block a 2b spec

**Recommended shape:** keep the **moderator's device as the resolver** (the 2a pattern, every phase). Store secret inputs per-uid (`nightActions/{uid}`, and votes either public or per-uid), let the resolver read them, combine in **pure `lib/` functions**, and write back **public outcomes** + per-uid private results. A `game` node holds `phase`/`round`/`winner`; a per-player `alive` flag gates action/vote writes via Rules. **Night-first, manual moderator phase advance, public day votes, standard town/Mafia win conditions.** Grant the **moderator read access to `privateRoles`** so the resolver knows teams.

**Open decisions to settle before/at spec time:**
1. **Standard-four roles only for v1, or custom-role night powers too?** (Biggest scope lever — recommend standard four first.)
2. **Multi-Mafia coordination** — majority target vs consensus vs leader-with-Mafia-channel.
3. **Votes public or hidden?** (Recommend public — auditable, less trust.)
4. **Tie policy** (default no-elimination) and a **skip/no-lynch** option.
5. **Reveal roles on death, or only at game end?**
6. **In-game chat** — none / living-only / dead chat.
7. **Moderator read on `privateRoles`** (needed for resolution/wins) — confirm the rule change.
8. **Mafia-win threshold** — parity vs strict majority.
9. **Manual advance vs timers** (recommend manual for v1).
10. **Spark vs Blaze** — still the biggest lever; Blaze would make resolution server-authoritative and remove moderator-device trust for night/win.

**What's still unknown / to verify at build time:**
- Whether the group actually wants in-app in-game chat, or plays over voice (changes §5 a lot).
- How disruptive moderator-abandon-mid-game feels in practice (may motivate the Blaze move or a moderator-transfer feature that 2a deliberately skipped).
- RTDB storage/round growth over a long match (prune old rounds?).
- Whether reconnect-restore into a mid-phase view is smooth enough with the 2a session hint, or needs more state.

*Next step (separate task, not this one): fold the settled decisions above into a `specs/spec-2b.md`, then a task breakdown. No app code, no new dependencies, and no rules changes until that spec is reviewed.*
