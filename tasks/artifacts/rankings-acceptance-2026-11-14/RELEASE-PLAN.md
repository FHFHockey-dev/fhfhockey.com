# Rankings-only release — plan and receipts (2026-11-15)

## Candidate
- `546d0a58085ab5c0ebaecd01975d156b0472d282`, parent origin/master `89da739cb` (#446, live).
- Tree = master + the 22 blobs of octoberBranch `228f345e6`. All paths are under `web/lib/rankings/`.
- No FORGE, pregame-capture or other octoberBranch work. No schema, cron, flag or data change.
- Import closure: 31 transitively imported files, all identical to master. Each of the 22 files equalled master before `228f345e6`.

## Gate (clean `git archive` export of the candidate; node_modules symlinked)
- Vitest: 86 files, 851 passed, 1 skipped. Covers Rankings libs, Rankings components, the page, the contextual-rankings routes, the writer routes, the cron-audit wrappers, lib/teams and lib/player-cards.
- ESLint on `lib/rankings`: exit 0.
- Full `npm run typecheck -- --incremental false`: exit 0.
- CSS-module pure check: not applicable (no `.module.scss` changed).

## Vercel footprint (6 projects; #446 pattern)
A merge to master gives exactly 1 build (`fhfhockey`). `fhfhockey.com`, `cms-fhfhockey` and `functions-fhfhockey` are CANCELED by their ignored-build step; `web` and `functions` get no entry. Previews are disabled, so a `chef/*` branch push creates no deployment.

## Publish steps (each needs TJ's pop-up)
1. Push branch `chef/release-2026-11-15-rankings-acceptance` at `546d0a58085ab5c0ebaecd01975d156b0472d282`, then confirm no deployment appears.
2. Open a PR to master and squash-merge it. Watch for 1 build and 3 cancels, then READY.

## Smoke (≤5 sequential GETs on https://fhfhockey.com; stop on 5xx or >20 s)
| # | URL | Pass |
|---|---|---|
| S1 | skater matrix, page default | 200; durable 11-11; 740; deployment rank scope filled |
| S2 | same + team=EDM | durable 11-11; derived-pool warning; composites present |
| S3 | snapshot selected_player=8473533 | "not in the published cohort"; under 5 s |
| S4 | teams season=20252026 | 200, 32 teams (was 500) |
| S5 | goalies current | 200, 76 |

## Republish (separate TJ pop-up after smoke)
- Current season 20262027 only: 4 windows, 5v5, all_skaters.
- Route `/api/v1/db/update-entity-metric-rankings`, called on the isolated local server, which runs code identical to the release. Dry run first, then `dryRun=false`.
- Out of scope: historical seasons and any recurring schedule.
- Verify:
  - SQL: distinct entities at the new snapshot ≥764, with all 24 ids present;
  - deployed matrix `totalRankedRows`;
  - deployed snapshot of 8473533 is available.

## Release receipt
- TJ approved by pop-up. Pushed `chef/release-2026-11-15-rankings-acceptance` at 546d0a580; the push created no deployment.
- PR #447 was squash-merged as **`baeb5df7f`**. The tree equals the candidate.
- Vercel: `fhfhockey` `dpl_2cSuAxpANphLcWSU3VPzvYu7EGhg` reached READY. `fhfhockey.com`, `cms-fhfhockey` and `functions-fhfhockey` were CANCELED; `web` and `functions` got no entry. That is 1 build, as planned.

## Smoke receipt (2026-11-15 02:46:51–02:47:01 UTC; 5 sequential GETs; raw `packet2/out/SMOKE-*`)
| # | HTTP | s | Result |
|---|---|---|---|
| S1 | 200 | 0.73 | **Wrong URL (Chef error):** an id-prefix collision sent Metric Explorer instead of the page-default matrix. Explorer: durable 11-11, 100 rows, 582 qualified |
| S2 team=EDM matrix | 200 | 3.13 | durable 11-11, derived-pool warning, 0 null composites; **byte-identical to local fixed-code B1** apart from `generatedAt` |
| S3 snapshot 8473533 | 200 | 0.52 | "Selected skater is not in the published cohort for this context." |
| S4 teams 2025-26 | 200 | 5.69 | 32 teams (was a 500); unit usage present (82 games; snapshot 2026-11-08); style still has the source gap (66/82) |
| S5 goalies | 200 | 0.87 | 76; byte-identical to pre-release d3 |

The page-default skater matrix was not smoked directly. It moves into the republish verification.

## Paired-snapshot guard releases (2026-11-15)
**#448, merged as `b5a580c45`** (candidate 8cace0302: reader plus its test).
- Gate: 854 tests, typecheck 0, ESLint 0.
- Vercel: `dpl_Ewmj6oUW3vgtJ3YEHgdoDUh6gcYp` READY; 3 companions CANCELED.
- Smoke (18:04 UTC, 2 GETs): page-default matrix and team=EDM. Both 200, rankings 11-13, 769 / 23 rows, 0 null composites.
- Gap TJ found: #448 capped at the latest composite date without requiring an exact match.

**#449, merged as `e74770217`** (candidate fe3076d77: exact rankings + composites date match).
- Gate: 856 tests, typecheck 0, ESLint 0.
- Vercel: `dpl_4BZZs7u7GBxxXgsaxeDqNLDCsB7c` READY; 3 companions CANCELED.
- Smoke (18:14 UTC, 2 GETs): both 200, 769 / 23 rows, 0 null composites. The page-default matrix is byte-identical to the #448 smoke apart from `generatedAt`.

## Completion-marker release (2026-11-15)
**Migration 152** (`ranking_publications`) was applied at 20:16:50Z with TJ's pop-up. Readback exact; smoke 2/2. Receipt: `migration-152/RECEIPT.md`.

**#450, merged as `089a6a771`.**
- **Candidate** `0238da70b`: origin/master plus 15 Rankings files (reader, writers, routes, tests, types). It carries no register, migration or FORGE files.
- **Gate** on a clean export:
  - Vitest: 65 files, 714 tests;
  - ESLint: exit 0;
  - typecheck: exit 0.
- **Local check** (1 request, :3110 against production): 200, 769 at 11-13, 0 null composites.
- **Vercel:** `dpl_5UeLX773UmvQHFzG3dGVzo2sGpjP` READY (about 4.6 min). `fhfhockey.com`, `cms-fhfhockey` and `functions-fhfhockey` were CANCELED.
- **Smoke** (2 GETs):
  - S1, page-default matrix: 200 in 4.24 s, 769 ranked at 11-13, 0 null composites. Byte-identical to the local check apart from `generatedAt`.
  - S2, team=EDM: 200 in 2.22 s, 23 rows, derived-pool warning, 0 null composites.
- **Live result:** output is unchanged, as expected. No markers exist yet, so the reader uses the #449 date match.
