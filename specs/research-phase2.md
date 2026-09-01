# research-phase2.md — Phase 2 (Online Multiplayer) · Research Pass

Status: **research only** — options, trade-offs, recommendations, and unknowns. This is **not** a spec or a design, and no app code is written yet. Backend decision is already made: **Firebase**. Stack stays Next.js (App Router) + TypeScript + Tailwind on Vercel (per [../CLAUDE.md](../CLAUDE.md)).

Phase 1 ([spec.md](spec.md)) gives us reusable pieces: the role model (Mafia / Detective / Doctor / Civilian + custom), the cryptographically secure `secureShuffle` (`lib/shuffle.ts`), and the setup validation (`lib/validation.ts`). Phase 2 keeps the "moderator deals roles, each player sees only their own" idea but moves it across the network with many devices instead of passing one phone.

---

## Scope: what's in slice 2a vs 2b

| Capability | Slice |
| --- | --- |
| Create room → shareable 6-digit code | **2a** |
| Join room by code | **2a** |
| Waiting room: live player list + count | **2a** |
| Waiting-room chat | **2a** |
| Moderator role configuration (reuse Phase 1 config/validation) | **2a** |
| Game start | **2a** |
| Deal each player their own secret role, visible only to them | **2a** |
| Presence (who's connected) + reconnect | **2a** |
| In-app night actions (Mafia kill / Doctor save / Detective investigate / custom) | 2b |
| Day voting + eliminations | 2b |
| Multi-round win logic (game ends when all Mafia eliminated) | 2b |

Everything below tags findings **[2a]**, **[2b]**, or **[foundation]** (needed for 2a, underpins both).

---

## 0. Cross-cutting foundations [foundation, needed for 2a]

Before the seven areas, four decisions touch everything.

- **Identity — Firebase Anonymous Auth.** Every browser silently gets a stable `auth.uid` (no login, preserves the "no accounts" feel) that the server can verify. This `uid` is the backbone of every security rule ("you may read only *your* role", "only the moderator may start"). Without server-verified identity, the anti-cheat rules in §3 are not possible. **Recommendation: use Anonymous Auth from the start of 2a.** The uid persists in browser storage, which also powers reconnect (§6).
- **Firebase web config is not a secret.** The `apiKey` / project config shipped to the browser is *public by design*; security comes from Auth + Security Rules, never from hiding config. So it goes in `NEXT_PUBLIC_FIREBASE_*` env vars and is safe to expose. (This matters for our `.gitignore`/secret hygiene: there is no real secret here — but service-account keys, if we ever add Functions, are secret.)
- **New dependency — `firebase` (modular JS SDK).** This is the one significant new dep; per CLAUDE.md it must be proposed before adding. It's well-known and tree-shakeable (import only `auth` + `database`). Flag bundle-size review.
- **Local dev — Firebase Emulator Suite.** Run Auth + Realtime DB (+ Functions later) locally so we develop and test rules without touching production or burning free-tier quota. Strongly recommended for 2a.

**Still unknown:** whether one Firebase project is shared between Phase-1-style local dev and prod, or separate projects per environment.

---

## 1. Real-time room model [2a]

**The shape (recommended, Realtime Database / RTDB):**

```
/rooms/{code}
  meta:        { status, moderatorId, createdAt, lastActivity }   // status: lobby|configuring|dealing|in_game|ended
  config:      { roles: { mafia: n, detective: n, ... custom } }   // moderator-written (reuses Phase 1 model)
  players/{uid}: { name, joinedAt, connected, lastSeen }           // public-ish roster
  privateRoles/{uid}: { role }                                     // locked to that uid (see §3)
  chat/{pushId}: { uid, name, text, ts }                           // §4
```

**Short codes — options:**
- **6-digit numeric (recommended for 2a):** 1,000,000 combinations. Easy to read aloud / type on a phone. Generate with `crypto.getRandomValues` (consistent with the CLAUDE.md "no Math.random for fairness" spirit, though codes aren't a fairness concern), then **claim via a transaction** on `/rooms/{code}/meta` that only writes if the node doesn't exist; on collision, regenerate and retry. Collisions are negligible at hobby scale but must be handled, not assumed away.
- Alphanumeric (e.g. base32, 5 chars) — larger space, fewer collisions, but easier to mistype/confuse (O/0, I/1). Overkill for hobby scale.

**Presence (who's in) — RTDB's strength:** the canonical pattern is `.info/connected` + `onDisconnect()`. When a client connects it writes `players/{uid}/connected = true` and registers an `onDisconnect` that sets it `false` (and stamps `lastSeen`). The server runs the onDisconnect even if the tab is closed or the network drops. This is the single biggest reason to lean RTDB for 2a (see §2). The roster shows connected/disconnected state rather than hard-removing players.

**Trade-offs:** RTDB's tree is simple and fast but has no rich queries — fine here because we always read a known room by code. Storing roster + chat + private roles under one `/rooms/{code}` keeps a room self-contained and easy to clean up.

**Recommendation:** RTDB tree as above; 6-digit numeric codes claimed by transaction; presence via `onDisconnect`.

**Still unknown:** room TTL/cleanup mechanism (lazy on read vs scheduled — scheduled needs Functions/Blaze, see §6); whether codes are reused after a room ends.

---

## 2. Realtime Database vs Firestore on the free tier [2a, decision underpins both slices]

**Firebase Realtime Database (RTDB):**
- Built for exactly this: low-latency, high-frequency small updates to a shared JSON tree; native `onDisconnect` presence.
- Billed by **storage + bandwidth**, not per-operation — chatty game state doesn't rack up per-read charges.
- **Free (Spark) limits to watch:** ~**100 simultaneous connections**, 1 GB stored, 10 GB/month download. The 100-connection cap is the headline number — but a hobby game (a handful of rooms, ≤ ~20 players each) stays well under it.
- Weaknesses: primitive querying, cascading security rules (a `.read` higher in the tree grants everything beneath — easy to over-share if careless), no per-field filtering on a list read.

**Cloud Firestore:**
- Richer queries, per-document listeners, scales further.
- Billed **per read / write / delete** with daily free caps (~**50K reads, 20K writes, 20K deletes/day**, 1 GiB stored). Every delivered document change on a listener counts as a read — a fast-changing game with several listeners per player can burn the daily read quota fast.
- **No native presence/onDisconnect** — you'd bolt on heartbeats or run RTDB alongside it just for presence.

**Trade-offs in our context:** Our data is ephemeral, small, fast-changing, and read by everyone in the room in real time — RTDB's bandwidth-based billing and onDisconnect fit cleanly; Firestore's per-read model and missing presence fight us.

**Recommendation:** **RTDB for all live game state, presence, and chat in 2a and 2b.** Reach for Firestore only if we later need durable history or complex queries (not required for 2a/2b). Watch the **100-connection** and **10 GB/month** ceilings; cap room size and prune chat to stay comfortable.

**Still unknown:** exact current free-tier numbers (Google changes them — verify on the pricing page at build time); realistic peak concurrent connections we expect.

---

## 3. Keeping roles (and later actions/votes) secret from cheaters [2a for roles; 2b extends]

**The hard truth up front:** anything the browser receives, a determined player can read in the Network tab or via the SDK — UI hiding is *not* security. The only real defense is to **never send a player data they shouldn't have.** That is enforced server-side by **Security Rules**, not by client code.

**Mechanism (recommended):** store each role at `/rooms/{code}/privateRoles/{uid}` and write a rule so that node is readable **only** by that uid:

```
// conceptual, not final
"privateRoles": { "$uid": { ".read": "auth.uid === $uid" } }
```

Because RTDB rules can't *filter* a list, clients must read **only their own path** (`privateRoles/{myUid}`), never the parent. Others' roles are never transmitted to a player's device — safe even with dev tools open.

**Who assigns the roles? Two real options:**

- **(A) Moderator's browser deals them [free-tier path].** On "start", the moderator client runs the Phase 1 `secureShuffle` and writes each `privateRoles/{uid}`. Rules let the moderator write all role nodes; players read only their own.
  - *Pros:* works on the **free Spark plan** (no Functions); reuses Phase 1 code directly.
  - *Cons / residual risk:* the moderator's device necessarily computes and holds the **full mapping**. That's acceptable *because the moderator is a non-playing, trusted person* — but it means a compromised/curious moderator device could see everything, and a custom client could in principle write a biased assignment. Players still cannot see each other's roles (rules prevent it).
- **(B) Cloud Function deals them [strongest, needs Blaze].** "Start" calls a callable Function that does the secure shuffle server-side with admin privileges and writes `privateRoles`; **no client ever computes or sees the full mapping**, and fairness is guaranteed off-device.
  - *Pros:* the gold standard for anti-cheat; works even if the moderator is untrusted.
  - **Critical cons:** **Cloud Functions require the Blaze (pay-as-you-go) plan** — i.e. a billing account / credit card — even though Blaze's free monthly allowance would cover this hobby usage essentially for free. This breaks the strict "free tier, no card" assumption.

**Recommendation for 2a:** go with **(A) moderator-client dealing + per-uid read rules**, which is secure *against players* (the actual requirement) and stays on the free plan, and **document the residual trust in the moderator's device** plus a clear upgrade path to **(B)** if we ever move to Blaze or untrusted moderators. Keep using `crypto.getRandomValues` (never `Math.random`) wherever the shuffle runs.

**What is / isn't safe — be explicit:**
- ✅ Safe: per-uid nodes + rules that prevent other players' data from ever reaching a client; rules keyed on `auth.uid`; validating writes (shape, length, allowed state) in rules.
- ❌ Not safe: putting all roles in a shared node and hiding them in the UI; trusting a client's claim ("I am the moderator", "my vote is X") without a rule that checks it; assuming obfuscation/minification hides anything.

**[2b] extension:** night actions and votes follow the **same pattern** — each actor writes to a node only they (and the resolver) can read; resolution (who died, vote tally, win check) is the sensitive step. Ideally resolved in a **Function** (Blaze) to prevent tampering; the free-tier compromise is **moderator-client resolution** with rules restricting who can write outcomes. We will revisit this when 2b is specced.

**Still unknown:** whether the project will move to Blaze (decides A vs B); whether moderators are always trusted humans; exact rule set for moderator write access without leaking reads.

---

## 4. Waiting-room chat [2a]

**Approach (recommended):** RTDB list at `/rooms/{code}/chat/{pushId}` using `push()` (keys sort chronologically). Each message `{ uid, name, text, ts }` with `ts` a **server timestamp**. Clients subscribe with **`limitToLast(N)`** (e.g. last 50) so a room only ever pulls a bounded window — caps bandwidth and render cost.

**Abuse / spam — realistic for a hobby app:**
- **Rule-level guards (the only server-enforced layer without Functions):** require `auth != null`; cap `text` length (e.g. ≤ 300 chars); require the expected fields and `ts == now`; only allow writes while `meta.status` permits chat. These run server-side and can't be bypassed by a custom client.
- **Client-side throttle:** simple "1 message / second" debounce — convenience only, not security.
- **Moderator tools:** moderator can clear chat / mute a player (a rule check on a `muted` flag).
- **Storage hygiene:** auto-prune to the last N messages (or delete chat when the room ends) to stay under RTDB storage limits.
- **Out of scope for 2a:** profanity filtering, server-side rate limiting (would need a Function), persistent moderation logs.

**Trade-offs:** RTDB chat is trivial and cheap; the limitation is that *robust* rate-limiting/anti-flood really wants a Function, which we're avoiding on the free tier. Length caps + `limitToLast` + moderator mute is a reasonable hobby posture.

**Recommendation:** RTDB `push()` chat, `limitToLast(50)`, rule-enforced length/auth/state + a client throttle + moderator clear/mute. Waiting-room chat only for 2a; **in-game chat is a 2b/later question** (it interacts with secrecy — dead players, night silence, etc.).

**Still unknown:** message retention policy; whether names need to be unique to avoid impersonation in chat.

---

## 5. Moderator authority & transfer [2a basics; 2b drives game flow]

**Model:** the room creator is the **moderator**, stored as `meta.moderatorId = their uid`. The room is a **state machine** (`lobby → configuring → dealing → in_game → ended`) that **only the moderator may advance**. Security rules gate moderator-only writes:
- only `meta.moderatorId` may write `config`, change `meta.status`, trigger dealing, and (2b) resolve night/day.
- a player may write only their own `players/{uid}` node, their own chat, and (2b) their own actions/votes.

This keeps "non-playing moderator controls everything" enforceable server-side, not just by convention.

**Host/moderator transfer — options:**
- **Explicit hand-off (recommended baseline):** current moderator sets `meta.moderatorId` to another player's uid; a rule permits the change *only if* the requester is the current moderator. Clean and unambiguous.
- **Claim-after-timeout (for moderator-disconnect):** if the moderator goes offline (presence shows disconnected) for more than X seconds, allow a player to **claim** moderator via a transaction (first claim wins; rule checks the old moderator is actually stale). Needed because a non-playing moderator vanishing would otherwise freeze the room.
- **Auto-promote:** automatically promote, e.g., the longest-connected player. Simplest UX but least intentional; risk of promoting someone unwanted.

**Trade-offs:** explicit transfer is safe but useless if the moderator simply vanishes; claim-after-timeout covers that but needs careful transaction rules to avoid two simultaneous claims. A scheduled "reap stale moderator" job would want a Function (Blaze).

**Recommendation for 2a:** implement **explicit hand-off** now, and design `meta` so a **claim-after-timeout** can be added without restructuring (since moderator loss is a top failure mode, §6). Full game-flow authority (night/day phases) is **2b**.

**Still unknown:** desired policy when the moderator disconnects mid-lobby vs mid-game; whether the moderator can also be a player in some modes (vision says non-playing, so assume not).

---

## 6. Main failure modes for 2a [2a]

| Failure | Handling (recommended) | Notes / unknowns |
| --- | --- | --- |
| **Player disconnects** | `onDisconnect` marks `connected=false`; roster shows "reconnecting", does **not** remove them; stable `auth.uid` lets them rejoin and keep their slot/role. | Decide how long a disconnected player holds their slot; whether a dealt role survives a rejoin (recommend: yes). |
| **Moderator leaves** | Biggest risk (non-playing mod = single point of failure). Explicit transfer (§5) + planned claim-after-timeout. | Policy differs lobby vs in-game; may need to pause the game. |
| **Duplicate codes** | Transaction-claim on create; regenerate on collision. | Negligible at scale but must be coded, not assumed. |
| **Expired / dead / wrong codes** | Joining a non-existent / `ended` / expired room → friendly error. Rooms carry `createdAt`/`lastActivity` for TTL. | Cleanup mechanism undecided: lazy-on-read (free) vs scheduled Function (Blaze). |
| **Two people join at once** | Each writes their **own** `players/{uid}` path → no write collision. Capacity limit (if any) enforced via a transaction on the count. | Name collisions: allow duplicates, or enforce uniqueness via transaction — undecided. |
| **Very small room** | Reuse Phase 1 validation before start (≥3 players, ≥1 Mafia, ≥1 non-Mafia) — but **count excludes the non-playing moderator**. | Confirm min-player rule for online (mod doesn't count toward roles). |
| **Very large room** | Cap room size; mind the **100-connection** RTDB ceiling and roster/chat render cost. | Pick a sensible max (hobby: ~20–30). |

**Recommendation:** treat **moderator-loss** and **reconnect-by-uid** as first-class in the 2a design; the rest are mostly transaction-and-validation hygiene.

---

## 7. Supabase as an alternative — brief [context only; staying with Firebase]

Supabase (hosted Postgres + Realtime + Row-Level Security + Edge Functions) is a credible alternative. Its **RLS** is arguably a *cleaner* mental model for "a player may read only their own role" than Firebase's cascading rules, its Realtime gives presence and broadcast, and crucially its **Edge Functions don't require a billing-plan upgrade** the way Firebase Functions need Blaze — so the §3 "gold-standard server-side dealing" could stay genuinely free. Against it: it's relational, so ephemeral game state needs more schema/setup than dropping JSON into RTDB; its presence/onDisconnect story is newer and less battle-tested than RTDB's; and we've **already committed to Firebase**. Net: reasonable, not clearly better for this small real-time use case — **stay with Firebase**, but note Supabase's free server-side functions as the one feature we genuinely give up.

---

## Summary: recommendations & the decisions that block design

**Recommended stack for 2a:** Firebase **Anonymous Auth** + **Realtime Database** + **Security Rules**, `firebase` modular SDK, developed against the **Emulator Suite**. Reuse Phase 1 `secureShuffle` + validation. RTDB tree per §1; 6-digit transaction-claimed codes; `onDisconnect` presence; per-uid private role nodes; `push()` + `limitToLast` chat; moderator-as-state-machine with explicit transfer.

**The one decision that most shapes 2a — role dealing:**
- **Free (Spark):** moderator-client dealing (option 3A). Secure against players; trusts the moderator's device.
- **Blaze:** Cloud Function dealing (option 3B). Fully secure; needs a credit card (still ~free at this scale).
- *Recommendation:* start 3A, design so 3B can drop in later.

**Open decisions to settle before/at spec time:**
1. **Spark vs Blaze** — gates Functions, and therefore secure server-side dealing (§3), scheduled room cleanup (§6), and server-side 2b resolution.
2. **Moderator-disconnect policy** (transfer vs claim-timeout vs pause) (§5/§6).
3. **Room lifecycle** — max size, TTL, cleanup mechanism, code reuse (§1/§6).
4. **Reconnect semantics** — slot/role persistence window; name uniqueness (§6).
5. **Min-players rule online** — confirm the moderator is excluded from counts (§6).
6. **One Firebase project vs per-environment**, and confirming `firebase` as an approved dependency (§0).

**What's still unknown / to verify at build time:**
- Exact current Firebase free-tier numbers (they change) — verify connection/read/write/storage limits on the live pricing page.
- Whether moderators are always trusted humans (decides how hard we push on §3).
- Real expected concurrency (rooms × players) vs the 100-connection RTDB cap.
- Whether 2b will require Functions for fair night/win resolution (likely yes for true anti-cheat) — which would force the Blaze decision then if not now.

*Next step (separate task, not this one): turn the settled decisions above into a 2a spec in `specs/`, then a task breakdown. No app code or dependencies until that spec is reviewed.*
