// `openPage()` gives each player their own browser context: separate IndexedDB, so a
// separate Firebase anonymous user, and separate sessionStorage. Every context blocks any
// request that isn't to localhost / 127.0.0.1, and the test fails if one was attempted
// (WebSockets can't be blocked, only detected, so those fail the test too).

import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

const LOCAL = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

export const test = base.extend<{ openPage: () => Promise<Page> }>({
  openPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    const nonLocal: string[] = [];

    await use(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      await context.route(
        (url) => !LOCAL.test(url.href),
        (route) => {
          nonLocal.push(route.request().url());
          return route.abort();
        },
      );
      const page = await context.newPage();
      page.on("websocket", (ws) => {
        if (!LOCAL.test(ws.url())) nonLocal.push(ws.url());
      });
      return page;
    });

    await Promise.all(contexts.map((c) => c.close()));
    expect(nonLocal, "browsers must only talk to localhost and the emulator").toEqual([]);
  },
});

export { expect };
