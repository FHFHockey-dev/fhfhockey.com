# SS lane G: goalie inventory diary

- Scope: SS 11.0 only. Files per `tasks/artifacts/social-share-expansion-2026-10-31/LANES.md`, lane G.
- Where: octoberBranch, canonical checkout. Receipt: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/g-inventory.md`.
- State: all subtasks built, including TJ's server-only confirmation read through the starter-board resolver. Tests, lint, tsc and pure check pass; spec discovered with `--list`, not run in a browser; no live read through the server credential yet.
- Next: the lead runs the spec and the live read at 13.0, and decides whether v2 adds a conflicting state.
- Blockers: none for this lane. Writer sets `source_account` null, so reporter disagreement cannot be detected live; see the receipt.
- Gotcha: `trendSources.ts` imports the public Supabase client, so `goalieInventory.sources.ts` imports readers lazily inside the loader. Keep it that way, because the Start/Sit card imports search from it.
- Gotcha: the server guard is `typeof window`, so the test file runs in the node environment; jsdom would make it return no client.
- Gotcha: `source_url` and `expires_at` are null on every live observation, so no link or expiry can be shown yet.
