# Constitution — Mafia Wars

## About

A social-deduction (Mafia/Werewolf) game as ONE responsive web app that runs in any browser — phone, tablet, laptop. No native apps, no app stores. Built in two phases:

- Phase 1 (now): offline, single-device role setup and private role reveal. No backend, no network.
- Phase 2 (later): online multiplayer rooms. Do NOT build Phase 2 or add its dependencies yet.

## Principles

- Plain, readable code a newcomer can follow in 5 minutes. Prefer well-known libraries over custom code.
- Every feature ships with its spec in specs/. The spec is the source of truth.
- Build one task at a time and stop for review. Never sprint through the whole task list unsupervised.

## Constraints

- Stack: Next.js (App Router) + TypeScript + Tailwind CSS. Deploy target is Vercel.
- Phase 1 makes zero network calls and has no backend, database, or accounts.
- Don't add new dependencies without proposing them first.
- Never use Math.random for role assignment — any randomness that affects fairness must be cryptographically secure.

## Definition of done

- Behaviour matches the spec, edge cases included.
- Works in both a phone browser and a desktop browser.
- I've reviewed the diff against the spec before it's considered done.
