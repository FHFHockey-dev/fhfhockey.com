# SS lane G: goalie inventory diary

- Scope: SS 11.0 only. Files per `tasks/artifacts/social-share-expansion-2026-10-31/LANES.md`, lane G.
- Where: octoberBranch, canonical checkout. Receipt: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/g-inventory.md`.
- State: all subtasks built, including TJ's server-only confirmation read through the starter-board resolver. Tests, lint, tsc and pure check pass; spec discovered with `--list`, not run in a browser; no live read through the server credential yet.
- Next: the lead runs the spec and the live read at 13.0, and decides whether v2 adds a conflicting state.
- Blockers: none for this lane. Writer sets `source_account` null, so reporter disagreement cannot be detected live; see the receipt.
- Gotcha: `trendSources.ts` imports the public Supabase client, so `goalieInventory.sources.ts` imports readers lazily inside the loader. Keep it that way, because the Start/Sit card imports search from it.
- Gotcha: the server guard is `typeof window`, so the test file runs in the node environment; jsdom would make it return no client.
- Gotcha: `source_url` and `expires_at` are null on every live observation, so no link or expiry can be shown yet.

## Visual rework
Bars on Risky Starts and rank chips plus status colours on Start/Sit, one-hue thirds scale shared through `rankBand`. Fit still needs the lead's real-data render; adjust `RISKY_TILE_LIMIT` or `START_SIT_ROW_LIMIT` if it clips.

## TJ review rework
Shared winner rule, Risky Starts to the mockup (`~/Desktop/Untitled-1.png`), Start/Sit green and red chips with logos and triangle. Removed the blue `RANK_BANDS`. Fit needs the lead's real-data render.

## Market lines
Stored DraftKings first, NHL `/now` fallback, in `riskyStarts.sources.ts`. Dated NHL paths 404. Expect "No line yet" for most of a 7-day window. Fit is tight on a 4-pairing tile with wrapped goalies; check the lead's render.

## Audit F2, F3, F8
Tied ranks, puck-drop expiry and DraftKings-only stored lines. Gotcha: a high-first competition rank can't be reversed across a tie, so `lowFirstRanks` sits on the detail, outside v1. Full `tsc` reports one error in `goalieRescue.sources.ts`, not this lane's file; reported to the lead.
