# Testing the online game with Playwright MCP

Use Microsoft's official Playwright MCP server (`@playwright/mcp`) to let Claude Code
drive several real browsers at once, one per player, so we can play a full online round
locally. **Local only:** the Next.js dev server on `http://localhost:3000` plus the
Firebase Emulator Suite. Never point it at the Vercel site or the `production` Firebase
project (`mafiawarsonline-3756f`).

## What's installed

- `.mcp.json` (project scope, safe to commit, holds no keys) registers the server `playwright`:
  `cmd /c npx -y @playwright/mcp@0.0.83 --config .claude/playwright-mcp.config.json`.
  The version is pinned. `cmd /c` is required for `npx` on Windows; on macOS/Linux, run
  `npx` directly.
- `.claude/playwright-mcp.config.json` sets:
  - `browser.isolated: true`: an in-memory profile, so nothing persists between sessions.
  - `network.allowedOrigins`: the browser may request only `localhost:3000` (the app) and
    `127.0.0.1:9099` / `:9000` / `:4000` (the Auth emulator, the Database emulator and the
    Emulator UI). Any other origin is blocked, including `*.firebaseio.com` and `googleapis.com`.
    Playwright notes that this is **not** a security boundary: it doesn't filter
    WebSockets or redirects. The real guard is the env check below.

The first time you run `claude` in this folder, approve the server (or open `/mcp`).

## Before every session (pre-flight)

1. `.env.local` must contain `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` and
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-mafia-wars`. A `demo-` project can't reach real
   Firebase. If either value is different, **stop**.
2. Start the emulators: `firebase emulators:start --project demo-mafia-wars`.
3. Start the app: `npm run dev`. Then check http://127.0.0.1:4000: the Emulator UI should
   show new anonymous users once players join.

## Several isolated players

One MCP server means **one browser context**. Its tabs (`browser_tabs`) share IndexedDB,
so they also share one Firebase anonymous sign-in, and every tab is **the same player**.
Tabs are not separate players.

For N separate players, add one server per extra player. Each one launches its own
in-memory browser, so each gets its own anonymous user and its own `sessionStorage`:

```
claude mcp add --scope project playwright-p2 -- cmd /c npx -y @playwright/mcp@0.0.83 --config .claude/playwright-mcp.config.json
claude mcp add --scope project playwright-p3 -- cmd /c npx -y @playwright/mcp@0.0.83 --config .claude/playwright-mcp.config.json
```

Then refer to them by name, for example "use `playwright` as the host and `playwright-p2`
to `p4` as the players." Remove the extras when you're done:
`claude mcp remove playwright-p2 -s project`. (Advanced: `browser_run_code_unsafe` can
call `browser.newContext()` from inside one server. The snapshot and click tools can't
see those contexts, though, so you'd have to drive them entirely in code. Prefer the
separate servers.)

## A typical run

1. Host (`playwright`): `browser_navigate` to `http://localhost:3000`, open the online
   mode, create a room, and use `browser_snapshot` to read the room code.
2. Each player server: navigate to the same URL, join with the room code, and pick a name.
3. Host: configure the roles and start the game. On every player, use `browser_snapshot`
   to check that each one sees **only their own** role, and that a Cupid's lovers see
   only their partner line.
4. Step through the night and day phases. After each step, check the host and players
   for consistency, and check `browser_console_messages` for errors.
5. For phone layout, add `--device "iPhone 15"` to one server's args, or call
   `browser_resize` (390×844).
6. Reconnect check: call `browser_navigate` to the same URL again on a player (a refresh).
   They should rejoin the same room through the `sessionStorage` hint.

Reset between runs by restarting the emulators (data is in memory) and calling
`browser_close` on every server.

## Rules

- Allowed URLs: `http://localhost:3000` (or `127.0.0.1:3000`) and the emulator ports only.
- Never add production origins to `allowedOrigins`, never use `--extension` or
  `--cdp-endpoint` against your everyday browser, and never pass `--secrets` or a
  `--storage-state` that holds real accounts.
- No keys belong in `.mcp.json` or the config file. If a key is ever needed, put it in a
  gitignored `.env*` file.
