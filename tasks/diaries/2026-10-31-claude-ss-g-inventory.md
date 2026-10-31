# SS lane G: goalie inventory diary

- Scope: SS 11.0 only. Files per `tasks/artifacts/social-share-expansion-2026-10-31/LANES.md`, lane G.
- Where: octoberBranch, canonical checkout. Receipt: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/g-inventory.md`.
- State: all fixture subtasks built, tests, lint, tsc and pure check pass; spec discovered with `--list`, not run in a browser.
- Next: the lead runs the spec at 13.0 and decides how live confirmation and forecast get wired.
- Blockers: live confirmation. The Chef diary records TJ's server-only decision as relayed, but no message reached this lane. Conflict states need a §5 change.
- Gotcha: `trendSources.ts` imports the public Supabase client, so `goalieInventory.sources.ts` imports readers lazily inside the loader. Keep it that way, because the Start/Sit card imports search from it.
- Gotcha: `source_url` and `expires_at` are null on every live observation, so no link or expiry can be shown yet.
