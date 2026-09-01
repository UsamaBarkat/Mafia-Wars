# Mafia Wars

A social-deduction party game (Mafia / Werewolf) that runs entirely in the browser — phone, tablet, or laptop, no native app or install. It replaces the fiddly manual steps of an in-person game: a host configures the roles, the app deals them randomly and securely, and each player sees only their own secret role. It's built in phases — first offline pass-and-play on a single device, then online multiplayer where everyone joins from their own phone.

## Status

- **Phase 1 — offline pass-and-play** ✅ shipped & live. Configure roles (Mafia / Detective / Doctor / Civilian + custom roles), deal them with a cryptographically secure shuffle, then reveal each role privately by passing one phone around. No backend, no accounts. → **[live demo](https://mafia-wars-olive.vercel.app)**
- **Slice 2a — online multiplayer** ✅ complete. A non-playing moderator creates a room with a shareable 6-digit code; players join by code into a live waiting room (real-time roster + presence + lobby chat); the moderator configures roles and starts; roles are dealt securely and **each player sees only their own role on their own device**, enforced by Firebase Security Rules. Ends once everyone has seen their role.
- **Slice 2b — in-app night/day game engine** ⬜ not started. No in-app night actions (kill/save/investigate), day voting, eliminations, or win detection yet — that's the next slice.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · Firebase Realtime Database + Anonymous Auth (Slice 2a only) · deployed on Vercel.

Phase 1 makes zero network calls and needs no backend. Firebase powers the Slice 2a online features only.

## Running locally

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# The defaults point at the local Firebase emulator with a demo project —
# no real Firebase credentials are needed for local development.

# 3. Start the Firebase emulator (Auth + Realtime Database) — required for the
#    online multiplayer features. Needs Java installed.
npx firebase-tools emulators:start

# 4. In a second terminal, start the app
npm run dev
```

Open http://localhost:3000. The offline Phase 1 flow works without the emulator; the online (Slice 2a) features need the emulator running (or a real Firebase project configured in `.env.local`).

To play online across two devices/windows, use two different browsers or profiles so each gets its own anonymous identity.

## Known limitations

- **Lobby roster tampering (Slice 2a).** From the security review: during the lobby phase, any signed-in client can write the shared player-roster node (a side effect of the atomic join transaction), so a malicious client could add/remove/alter roster entries. This is a griefing concern, **not** a role-secrecy issue — dealt roles live in a separate, per-player locked location that no other player can read. Acceptable for a play-with-friends game; tightening it would require reworking the join to per-child writes.
- **Secret roles are "secret enough for friends," not bulletproof.** On the Firebase free (Spark) plan there are no Cloud Functions, so the deal runs on the moderator's device — that device briefly holds the full mapping. Players cannot read each other's roles (Security Rules), which is the property that matters here.
- **Room cleanup is best-effort.** No scheduled server job (Spark plan) — abandoned/stale rooms are detected via a moderator heartbeat and treated as expired, but their data isn't actively deleted.

## License

MIT — see [LICENSE](LICENSE).
