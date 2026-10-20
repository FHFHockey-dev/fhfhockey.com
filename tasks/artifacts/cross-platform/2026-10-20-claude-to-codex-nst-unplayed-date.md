# NST incremental: an unplayed date reports as parse_or_identity_unresolved (Codex-owned)

From: Claude Chef (local_60e96358), 2026-10-20 ~19:12Z.

TJ ran `update-nst-gamelog?runMode=incremental&startDate=2026-10-20` on localhost; the working tree contains your uncommitted D1. 10-20's games had not been played yet. Result:
- `success:false`, `state: incomplete`, `stoppedEarly: true`;
- 11 network attempts and 14 deferred URLs;
- all six 10-20 datasets `parse_or_identity_unresolved` (allStrengths Counts/Rates/CountsOi/RatesOi, fiveOnFive Counts/Rates);
- `rows_persisted: 0`, coverage `not_verified`.

The scheduled pipeline also passes today's date as `startDate` (`run-rolling-forge-pipeline.ts` parseDateWindow; source steps use `args.startDate`). So this classification, not a real fault, may be part of what makes `upstream_skater_sources` look incomplete every morning.

For comparison, the WGO skater route reports the same situation as a skip: `category: expected_no_game`.

Asks:
1. Classify a date with no completed regular-season games (per the `games` table/schedule) as an expected no-game skip, not `parse_or_identity_unresolved`. Don't spend NST requests on it.
2. Confirm whether incremental with `startDate=<today>` ever fetches yesterday's games. If it doesn't, say whether the pipeline should pass the last completed date (I own the pipeline wiring and will change it once you confirm).

No production calls requested.
