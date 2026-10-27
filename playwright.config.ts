// End-to-end tests (tests/). LOCAL ONLY: the app on http://localhost:3000 talking to the
// Firebase Emulator Suite under the "demo-" project, which Firebase never connects to a
// real backend. tests/global-setup.ts refuses to run if .env.local points anywhere else,
// and tests/fixtures.ts fails any test whose browsers request a non-local host.
//
// Run with `npm run test:e2e`. Playwright starts the emulators and `next dev` for you, or
// reuses ones you already have running.

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  // Each test is a whole game with 6 browser contexts — run them one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        "npx -y firebase-tools@15.34.1 emulators:start --only auth,database --project demo-mafia-wars",
      url: "http://127.0.0.1:9000/.json?ns=demo-mafia-wars-default-rtdb",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 180_000,
      // Shell env beats .env.local in Next.js, so the server we start is always in
      // emulator mode under the demo project, whatever .env.local says.
      env: {
        NEXT_PUBLIC_USE_FIREBASE_EMULATOR: "true",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-mafia-wars",
        NEXT_PUBLIC_FIREBASE_DATABASE_URL:
          "http://127.0.0.1:9000?ns=demo-mafia-wars-default-rtdb",
      },
    },
  ],
});
