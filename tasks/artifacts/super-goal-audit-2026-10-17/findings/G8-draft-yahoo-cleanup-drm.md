# G8-draft-yahoo-cleanup-drm audit findings

Auditor: Sonnet worker, read-only. Repo HEAD `ceceb407a` (octoberBranch). Production `457435eb` was compared where noted.

## (a) Coverage

- **Completed rows in the group:** 481. That is 473 source ledger rows plus 8 completed master rows.
  - Source rows by file: debug 15, cleanup 158, dead-code 44, DRM 99 of 111 (12 open), draft-dashboard 92, Yahoo 65 of 72 (7 open).
  - Completed master rows: 3.17, 3.18, 4.11, 4.12, 5.7.13, 5.7.14, 5.7.24, 5.7.25.
  - Master rows 4.9 and 4.13 are open parents. Their completed child rows are audited below.
- **Rows audited in depth:** 54 table lines, some covering a cluster of rows.
  - All 8 completed master rows, plus the open parents 4.9 and 4.13 for count and claim drift.
  - All DRM P0 rows (NEW 22, 30, 36, 64) and the DRM P1 rows I could reach in code (NEW 8, 9, 10, 17, 48, 60, 82).
  - Rows whose files changed after the claim date (SHA derivation, CSV retention, adminOnly, Draft Dashboard commits `ec950e760`, `a5ba66196`, `83e3a0bde`, and cleanup rows hit by `7f094c8e6`).
  - A spread sample of cleanup, dead-code and Yahoo rows.
- **Not individually opened:** most P2/P3 DRM NEW rows, the Draft Dashboard UI sub-rows, and most cleanup a11y rows. They rest on unchanged-since-claim files plus Chef's all-pass test run.
- **Method:** code reading, `git log`, `git diff HEAD`, and `git diff 457435eb HEAD`. No tests were run.
- **Production equals HEAD for my group's code.** `git diff 457435eb HEAD` is empty for `shift-charts.ts`, `relationshipPlayerPosition.ts`, `components/DateRangeMatrix`, `lib/draftDashboard`, `components/DraftDashboard`, `hooks/useProcessedProjectionsData.tsx`, and the Yahoo job routes. Only `rosterPlanning` differs.
- **Ledger line formulas:**
  - Debug: 1758 + n
  - Cleanup: 5000 + n
  - Dead-code: 5161 + n
  - DRM: 5208 + n
  - Draft: 5322 + n
  - Yahoo: 5476 + n

## (b) Verdict table

DRM = `tasks-prd-drm-refactor.md`, CLN = `tasks-prd-cleanup-tasks.md`, DEAD = `tasks-prd-dead-code-report.md`, DD = `tasks-prd-draft-dashboard.md`, DBG = `prd-draft-dash-debug.md`, YH = `tasks-prd-yahoo-ingestion-mapping-audit.md`.

| row id | ledger line | verdict | evidence | note |
|---|---|---|---|---|
| DRM NEW 48.0 (`SRC::...drm-refactor.md::C0074`) | 5282 | **CONTRADICTED** | `web/lib/projections/relationshipPlayerPosition.ts` resolve fn (prod and HEAD) throws `Conflicting relationship position` on a Yahoo/roster type conflict. `shift-charts.ts:742` at HEAD and prod used `playerPositions.find(full_name === playerName)`, which returns the first row by ascending `player_key`. The fix is uncommitted in `git diff HEAD` (`selectRelationshipYahooPosition`). | See Top problems #1. The "fail closed / roster fallback" claim does not hold for same-name Yahoo collisions. No HEAD test covered it. |
| 4.13 `B-DRM` (open parent, master line 460) | 460 | **CONTRADICTED** (part) and STALE-EVIDENCE | The relationship-position checkpoint `4f8ba12ae` is cited as a closure, but the same-name path aborts the whole game (#1). The text says "complete (95/111)" but source and ledger show 99/111 done, 12 open. The text also keeps "270-second default" while code says `PROJECTION_ROUTE_DEFAULT_BUDGET_MS = 210_000` (`web/lib/rollingPlayerOperationalPolicy.ts:8`). | Master text is internally inconsistent (NEW 50 says 210 s). |
| DRM NEW 55.0 / NEW 38-era scheduler text ("64 active pg_cron plus 20 Vercel") | in 460 text | STALE-EVIDENCE | `web/lib/cron/combinedCronInventory.test.ts:265-272` (uncommitted) asserts 55 pg_cron + 27 Vercel = 82 jobs. The old test said 56/27/83. | Counts drifted. Job 234 was disabled and a Vercel `cron-report` was added. |
| DRM NEW 47.0 (C0073) | 5281 | STALE-EVIDENCE | The three routes are still admin-or-cron: `ingest-projection-inputs.ts:796`, `update-PbP.ts:194`, `build-projection-derived-v2.ts:535`. The "20/1/31 split" is gone. `cron-audit-wrappers.test.ts:72-80` now freezes 47 admin-or-cron findings and gets 46 (Chef's failing test). | The outcome holds. The frozen split is stale and its guard test is failing. |
| DRM NEW 30.0 P0 (C0056) | 5264 | VERIFIED (code) / UNVERIFIABLE-OFFLINE (deployment) | All three routes use `withCronJobAudit(adminOnly(...))`. `adminOnlyMiddleware.ts` at prod is identical to HEAD. The HEAD working tree adds hardening: bound role lookup and forwarded-header checks, tested in `__tests__/utils/adminOnlyMiddleware.test.ts`. `projection-materialization-auth.test.ts` asserts the wrapper shape. | Production 401/401/405 and the READY SHA need a Vercel deployment read and 3 unauthenticated GETs. |
| DRM NEW 22.0 P0 (C0048) | 5256 | VERIFIED | `git ls-tree 457435eb` has no `supabaseShifts.js`. `projection-materialization-auth.test.ts` asserts `existsSync(...)` is false. A repo-wide `rg supabaseShifts` finds only that test. | Deleted from prod too. |
| DRM NEW 36.0 / 64.0 / 73.0 / 74.0 P0 (C0062, C0090, C0099, C0100) | 5270, 5298, 5307, 5308 | VERIFIED (static) / UNVERIFIABLE-OFFLINE (apply) | `supabase/migrations/20260720105524_...sql` has 8 `on conflict on constraint` targets and no positional targets. `projectionMaterializationMigration.test.ts` and `gamecenterNormalizationMigration.test.ts` exist. `git diff 457435eb HEAD` for the migrations is empty. | The "applied on a disposable branch" part is not re-checkable offline. |
| DRM NEW 52.0 (C0078) | 5286 | VERIFIED | `update-PbP.ts:107-115` returns 400 on any array-valued control before delegation. `update-PbP.test.ts:222` is parameterized over each control. | |
| DRM NEW 53.0 (C0079) | 5287 | VERIFIED | `ingest-projection-inputs.ts:145` round-trips the ISO date. `ingest-projection-inputs.test.ts:529` tests `2026-02-30`. | |
| DRM NEW 54.0 (C0080) | 5288 | VERIFIED | `combinedCronInventory.test.ts:94-108` covers raw whitespace, `../` and `%2e%2e` aliases. | |
| DRM NEW 50.0 (C0076) | 5284 | VERIFIED (code) | `rollingPlayerOperationalPolicy.ts:8,43,52` = 210000; `run-projection-v2.ts:28` doc. `vercel.json` schedules `mode=daily_incremental`. | Job 104 timing and deployment are UNVERIFIABLE-OFFLINE. |
| DRM NEW 51.0 / 41.0 (C0077, C0067) | 5285, 5275 | VERIFIED | `update-shifts.ts` wraps `adminOnly` and `withCronJobAudit` and calls `delegatedShiftChartsHandler`. `shift-charts.ts:1327` defines the delegate and the direct export is `adminOnly(direct...)`. `shift-charts.audit.test.ts` covers it. | |
| DRM NEW 42.0 / 44.0 / 45.0 / 46.0 (C0068, C0070-72) | 5276-5280 | VERIFIED (static) / UNVERIFIABLE-OFFLINE | Static migration guards exist (above). ACL, RLS and production history need a catalog query. | See (d). |
| DRM NEW 49.0 (C0075) | 5283 | UNVERIFIABLE-OFFLINE | Claims jobs 308/393 states from `cron.job`. The `20260730091500_consolidate_scheduler_ownership.sql` file exists. | |
| DRM NEW 8.0, 9.0, 10.0, 11.0, 17.0, 19.0, 60.0 (readers) | 5242-5253, 5293 | VERIFIED (unchanged) | No commit and no working-tree change under `components/DateRangeMatrix` or its imports (`TeamSelect`, `useUrlQueryState`, `lib/supabase/pagination`, `teamsInfo`, `fetchCurrentSeason`) since 2026-07-21. `fetchAggregatedData.ts:450,506-511,1319` use ordered id-based short pages. Tests: `fetchAggregatedData.test.ts`, `useDateRangeMatrixData.test.tsx`, `useTOIData.test.ts`, `utilities.test.ts`. | See minor note #6 on ATOI and goalie tie sorting. |
| DRM NEW 14/15/56-59, 61-63 (UI) | 5248-5249, 5290-5297 | VERIFIED (unchanged) | Same unchanged-code basis. `index.accessibility.test.tsx:261` asserts `N/A ATOI`. `LinePairGrid.tsx:57,106` sort a copy (`.slice()`/`.filter()`). | |
| DRM NEW 20, 23-27, 29, 32-33, 37-39 | n/a (open `[ ]`) | not audited | Open rows. | |
| DRM 5.x quarantine (C0024-C0027) | 5232-5235 | VERIFIED | `DateRangeMatrixForGames.tsx` remains. `useTOIData.tsx` is the raw reader. | |
| 4.13 evidence-only: shifts ingest changed after DRM claims | n/a | STALE-EVIDENCE | `85d0006de` (2026-09-25) changed `fetchAllNhleShiftChartsSnapshotForGame` from throwing `Duplicate NHL shift source row` to counting duplicate intervals once. `shifts.test.ts` was updated to match. | Intentional, tested, and no DRM row claims the old throw. |
| 3.17 `A-DRAFT` (master 442) | 442 | STALE-EVIDENCE | Evidence "91/91 rows, 36 files/114 tests" is from 2026-07-13. Source has 92 rows. About 20 commits since touched `useProcessedProjectionsData.tsx` and `DraftDashboard.tsx` (for example `ec950e760`, `a5ba66196`, `83e3a0bde`, `db9c93535`). Matching tests were added: `DraftDashboardRecovery.test.tsx`, `KeeperWorkflow.test.tsx`, `draftWorkflow.integration.test.tsx`, `forwardGrouping.test.ts`. | The outcome holds. The counts are stale. |
| 3.17 session-local multi-CSV (DD C0010; DBG C0001/C0004) | 5332; 1759, 1762 | STALE-EVIDENCE | The bookmark/summary path still excludes rows (`summaryConfiguration.ts`; its test passes). But `web/lib/draft-pro/savedDrafts.ts:77-127,182` now serializes `entry.rows` as server-side "NormalizedPrivateImport" for Draft Pro saved drafts. | CSV rows are no longer strictly session-local. This is a later, opt-in feature. The claim needs a caveat. |
| DBG C0005/C0008/C0009/C0010 (SHA derivation) | 1763, 1766-1768 | STALE-EVIDENCE | `derivedProjectionStats.ts` still does `max(0, SHP-SHG)` with null-safety, and `derivedProjectionStats.test.ts` asserts it. Since `83e3a0bde` (2026-09-04), `SKATER_STAT_MAPPINGS` has `SH_ASSISTS` for every official source, so `hasDirectShaMapping` is true. The hook then uses the provider value for projected SHA (`useProcessedProjectionsData.tsx:1331-1342`). The derivation applies only to actual SHA and to custom sources. | The projected path in the claim is superseded. The hook branch has no test (`rg hasDirectShaMapping` in tests is empty). |
| 3.18 `A-DRAFT-DEBUG` (master 443); DBG C0012/C0014/C0015 | 443; 1769, 1771, 1772 | VERIFIED (benchmarks) | `sourceWeights.test.ts:60-94` has a 2,000-player < 150 ms assertion. `projectionVisibility.test.ts:132-157` has a 10,000-player < 150 ms assertion. | Synthetic benchmarks, but the asserted thresholds match the claim. |
| 5.7.13 / DD C0073 / C0092 (debug logging removed) | 520; 5395, 5414 | VERIFIED | No `console.log/debug` in `components/DraftDashboard/*.tsx` or `lib/draftDashboard/*.ts` except dev-gated `ImportCsvModal.tsx:1118`. `useProcessedProjectionsData.tsx` logs are `DEV` or non-production gated. | The "36 files/112 tests" count is stale. |
| 5.7.14 | 519 | VERIFIED | Same benchmarks. "7 files/25 tests" not re-counted. | |
| DD C0065 / NEW 11.1 (collision-safe Yahoo mapping) | 5387 | VERIFIED | `lib/draftDashboard/yahooMapping.ts` `resolveYahooMappings`/`candidateScore`: ties of equal score stay unresolved, and `currentGameMissing` is reported. `yahooMapping.test.ts` exists. Unchanged since 2026-09. | |
| DD C0028/C0029 (FWD grouping) | 5350-5351 | STALE-EVIDENCE | `forwardGrouping.ts` was changed by `a5ba66196` and `ec950e760` (2026-10-09), with new tests in `forwardGrouping.test.ts` and `DraftDashboardRecovery.test.tsx`. The current logic is coherent. | Behaviour likely better. The 07-12 test counts are obsolete. |
| 4.9 `B-YAHOO` (open parent, master 456) | 456 | STALE-EVIDENCE | Master text says "60/72 with 12 open". Source and ledger say 65/72 done, 7 open (YH C0039, C0043, C0052, C0055, C0056, C0057, C0063). | Count drift in the master row. |
| YH C0059 / NEW 9.1 P0 (unauthenticated global routes) | 5535 | VERIFIED (code) / UNVERIFIABLE-OFFLINE (prod) | `update-yahoo-players.ts:468`, `update-yahoo-weeks.ts:114`, `manual-refresh-yahoo-token.ts:79` are all `withCronJobAudit(adminOnly(...))`. Static route tests are in `globalCredentials.test.ts`. | Prod 401/401/405 needs a live probe. |
| YH C0060 / NEW 9.2 P0 (public-key fallback) | 5536 | VERIFIED | `populate_yahoo_nhl_mapping.py:36-37` uses only `SUPABASE_SERVICE_ROLE_KEY`. Write is gated by `YAHOO_MAPPING_WRITE_ENABLED` (L544). `test_player_name_matcher.py:171` asserts no public key. | |
| YH C0067 / NEW 9.9 (sheet sync) | 5543 | VERIFIED | `pages/api/internal/sync-yahoo-players-to-sheet.ts`: exact `CRON_SECRET` compare, fixed error string. Test at `globalCredentials.test.ts:187`. | Static source-string tests only. |
| YH C0008 (`token.json` absent) | 5484 | VERIFIED | `git ls-files` has no `token.json`. It is gitignored (`.gitignore:47`). | |
| YH C0015-C0018, C0041/C0042 (weeks/keys/retry) | 5491-5494, 5517-5518 | VERIFIED | `update-yahoo-weeks.ts` uses the snapshot RPC, receipt validation and a retry wrapper. `discovery.test.ts` covers complete pagination, retry, malformed pages and receipts. | |
| YH C0044 (alerts) | 5520 | VERIFIED | `lifecycleHealth.ts` has all six alert codes. `discovery.test.ts:252` classifies each. | |
| YH C0017 (no hard-coded IDs in canonical jobs) | 5493 | UNVERIFIABLE-OFFLINE | Code defaults to `"nhl"`. `cron-report.test.ts:526-538` shows historical pg_cron SQL with `gameId=465`. | Needs `cron.job` for job 106. |
| YH C0025/C0066/C0070/C0072 (prod atomic RPC, ACL, migrations) | 5501, 5542, 5546, 5548 | UNVERIFIABLE-OFFLINE | Depends on production catalog and migration history. | See (d). |
| CLN C0036 / C0037 (SHAs `357d69c78`, `92cfab267`) | 5036, 5037 | STALE-EVIDENCE | Neither SHA exists locally (`git cat-file -t` fails). C0042 says `92cfab267 -> 0ed825fb3`, and `0ed825fb3` exists. | Superseded by the owner-run rewrite. These rows cite dead SHAs. |
| CLN C0032 / C0039 / C0042 (cache and generated artifacts not in history; "13,264,504-byte maximum blob") | 5032, 5039, 5042 | **REGRESSED** | Commit `7f094c8e6` (2026-10-17) adds 482 tracked files / ~79 MB of an npm `_cacache` under `tasks/artifacts/security-audit-sprint-2026-10-15-0512/approved-dependency-audit/cache/`. The largest blob is now 25,647,967 bytes (was 13,264,504). | A recurrence of the P1 "dependency-cache contamination" class. This commit is not in production. |
| CLN C0046-C0048 (Playwright `.last-run.json`, `.temp`, logs untracked) | 5046-5048 | STALE-EVIDENCE | The original paths are untracked and ignored. But 6 `.last-run.json` / `error-context.md` files are tracked under `output/ui-acceptance-20261002/` (`26f04ef88`) and `tasks/artifacts/forge-rso-completion-2026-10-15/`. Eight `supabase/.temp/cli-latest` files are tracked under `tasks/ifttt-integration-2026-10-16/` (`7f094c8e6`). `git check-ignore` shows `output/**/.last-run.json` is not ignored. | Same class recurs in new locations. Low severity. |
| CLN C0051 / C0052 (flat ESLint, npm authority) | 5051, 5052 | VERIFIED | `web/eslint.config.mjs` exists. `web/.nvmrc` = 22.11.0, `packageManager npm@10.9.0`, `next` and `eslint-config-next` = 15.5.22. No `pnpm-lock` or `yarn.lock`. | `web/package-lock.json` is the only lock outside an artifact copy. |
| CLN C0010-C0015 / C0058 (hook-dependency debt zero), C0031 / C0076 (lint counts) | 5010-5015, 5058, 5031, 5076 | UNVERIFIABLE-OFFLINE | Counts (52/127 warnings) predate `7f094c8e6` and about 20 later commits. Re-confirm with `npm run lint`. | Not run (heavy). |
| CLN C0016-C0020, C0054, C0055 (OptimizedImage) | 5016-5020, 5054-5055 | VERIFIED | `web/components/common/OptimizedImage.tsx` and its test are untouched since 2026-07-22. | |
| CLN C0066-C0071 (day-switch, sort a11y) | 5066-5071 | VERIFIED | `Header.tsx:223,350`, `TransposedGrid.tsx:230`, `DesktopMasterTable.tsx:715` keep the `Include <day> games` and `Hide preseason games` names. `SortableHeaders.test.tsx` and `SwitchToggle.test.tsx` exist. Header and TransposedGrid were edited on 10-05 and 10-07 but kept the contract. | |
| CLN C0095 / C0098 (trueGoalieValue lifecycle) | 5095, 5098 | VERIFIED | `pages/trueGoalieValue.tsx` still exists with `__tests__/pages/trueGoalieValue.test.tsx`. It was edited on 07-29 for the quarantine notice. | |
| CLN C0081-C0100 TeamDashboard, TeamLeaders, `useTeamSchedule`, `PowerPlayCombos` | 5081-5100 | VERIFIED (unchanged) | `git log --since=2026-07-23` is empty for these paths. | Tests pass in Chef's run. |
| 4.11 `B-CLEAN` (master 458) | 458 | STALE-EVIDENCE and REGRESSED (part) | The text says "158/158" and "zero-critical production/full audit". The "history contamination" part regressed (`7f094c8e6`, above). Lint counts are stale. | Source count 158/158 does match. |
| DEAD C0021 / C0024 (20 files deleted and consumer-free) | 5182, 5185 | VERIFIED | The deletions are in `f1ba2ec9d`, `90d5c0770`, `6e7918150`, `0af2e8d2d`. Basename scans over `web/`, `functions/` and `cms/` for all 20 find zero importers. The five deleted pages are absent. | |
| DEAD C0027 / C0036 / C0038 / C0044 (webhooks, /db, adminOnly) | 5188, 5197, 5199, 5205 | VERIFIED (code) / UNVERIFIABLE-OFFLINE (prod) | The standalone `webhooks/` root is gone, deleted in `5bad4445a`. Canonical `pages/api/v1/webhooks/on-new-line-combo.ts:25` is `adminOnly`. `adminOnlyMiddleware.ts` returns a fixed 401 with no parser detail. `adminOnlyMiddleware.test.ts:374` tests it. | The "2/2 direct auth tests" for the old webhook service no longer exist (STALE-EVIDENCE). `AGENTS.md` still lists `webhooks/`. |
| DEAD C0016-C0020, C0042 (quarantine, trendsDebug) | 5177-5181, 5203 | VERIFIED | `trendsDebug.tsx:2640` gates on `user?.role !== "admin"`. `LegacySurfaceNotice` sets `noindex,nofollow`. `__tests__/components/LegacySurfaceNotice.test.tsx` exists. | |
| DEAD C0041 / C0039 (deps and `dateUtils`) | 5202, 5200 | VERIFIED | `web/package.json:87,108,137` declare `@sanity/client`, `domhandler` and `progress`. `utils/dateUtils.ts` is used by `usePlayerWeeklyStats.ts`. | |
| DEAD C0031 / C0005 (knip counts) | 5192, 5166 | UNVERIFIABLE-OFFLINE | Needs a rerun of `knip`. | |
| 4.12 `B-DEAD` (master 459) | 459 | VERIFIED (code) | 44/44 matches source. Production receipts are UNVERIFIABLE-OFFLINE. | |
| 5.7.24 (`C-DYNAMIC-B-CLEAN`, master 529) | 529 | STALE-EVIDENCE | "Zero lint errors, diff integrity" dates from 2026-08-01. The 7f094c8e6 cache commit contradicts the history-hygiene part. | |
| 5.7.25 (`C-DYNAMIC-B-DEAD`, master 530) | 530 | VERIFIED | The matrix file exists: `tasks/TASKS/dead-code-cleanup/hidden-product-surface-ownership-matrix.md`. Deleted paths are still absent. | |

## (c) Top problems

1. **P1 (data correctness / availability), CONTRADICTED: DRM NEW 48.0 and the 4.13 closure.**
   - The task claims relationship publication "fails closed … when Yahoo name matching cannot supply a complete player position", with a roster fallback.
   - At HEAD and at production `457435eb`, `shift-charts.ts:742` takes the first `yahoo_positions` row with a matching `full_name`. Rows are ordered by ascending `player_key` (`fetchAllPlayerPositions`, L632-650).
   - Two different Yahoo players with one name (the Elias Pettersson C/D case) make `resolveRelationshipPlayerPosition` throw `Conflicting relationship position` when the picked row's type differs from the roster. That aborts the whole game and run, which is the 2026-10-17 bug.
   - The same lookup could also silently pick a stale or wrong-player display position when both rows are skaters. It could also pick an old season's key for a multi-season player.
   - The fix (`selectRelationshipYahooPosition`, 33 lines in `relationshipPlayerPosition.ts`, plus `shift-charts.ts` changes and tests in `relationshipPlayerPosition.test.ts` and `shift-charts.audit.test.ts:165`) exists only as uncommitted working-tree changes.
   - The Production canary evidence ("three complete fallbacks") only covered one date window with no namesake collisions. No pre-fix test covered the collision, so the closure was over-claimed.
   - One related residual: a single same-name Yahoo candidate of a different type still throws (`relationshipPlayerPosition.ts` resolve function and its existing test "rejects a coarse Yahoo/roster type conflict"). This is deliberate fail-closed behaviour, but it still halts the batch.

2. **P2, REGRESSED: B-CLEAN history and generated-artifact hygiene (CLN C0032, C0039, C0042).**
   - `7f094c8e6` committed ~79 MB of an npm `_cacache` (482 files) under `tasks/artifacts/security-audit-sprint-2026-10-15-0512/approved-dependency-audit/cache/`.
   - This is the class that NEW 8.0/10.0 closed. The max blob size went from 13.26 MB to 25.6 MB, contradicting the C0042 numbers.
   - Further tracked generated files: Playwright `.last-run.json` / `error-context.md` in `output/ui-acceptance-20261002/` and `tasks/artifacts/forge-rso-completion-2026-10-15/`, and `supabase/.temp/cli-latest` in `tasks/ifttt-integration-2026-10-16/*` (8 files). `output/**` is not git-ignored.
   - This is on `octoberBranch` only, not in production.

3. **P2, STALE and failing guard: DRM NEW 47.0.** The frozen route-auth split (20/1/31) is stale. `cron-audit-wrappers.test.ts:72-80` expects 47 findings and gets 46 (the known failing test). The three DRM routes are still correctly admin-or-cron.

4. **P3, STALE: draft SHA and CSV claims (DBG C0005, C0008-C0010; DD C0010/C0055).**
   - Since 2026-09-04, official sources map `SH_Assists` directly (`projectionSourcesConfig.ts:36`), so projected SHA now comes from the provider and not from `SHP - SHG`. `useProcessedProjectionsData.tsx:1331-1342` has no test.
   - Draft Pro saved drafts persist private CSV rows server-side (`savedDrafts.ts:77-127`). That qualifies the "session-local, rows never stored" statement.

5. **P3, STALE counts in master rows:**
   - 4.9 says 60/72, but 65/72 are done.
   - 4.13 says 95/111, but 99/111 are done.
   - 3.17 and 3.18 say 91 and 14 rows, but the source has 92 and 15.
   - 4.13 says a "270-second" budget, but the code is 210 s.
   - The cron inventory is now 55 + 27 = 82 jobs, not 64 + 20.
   - Cleanup C0036 and C0037 cite SHAs `357d69c78` and `92cfab267`, which do not exist locally. They were superseded by `0ed825fb3` per C0042.
   - Dead-code C0036 cites "2/2 direct auth tests" for a webhook service that was retired.

6. **P3, minor code note (no verdict change):**
   - `LinePairGrid.tsx:57-63` parses ATOI with `split(":")`, so malformed text gives NaN comparator results.
   - `LinePairGrid.tsx:106` sorts goalies by GP with no tie-break (input-order dependent), although NEW 61 claims input-order invariance for grouping only.

7. **Note: `AGENTS.md` lists `webhooks/` as an active root.** It was deleted in `5bad4445a`.

## (d) UNVERIFIABLE-OFFLINE checks needed

- **Production deployments and routes:**
  - Vercel deployment read for the production SHA and project domains on NEW 30, 41, 46, 50 and YH NEW 9.1/9.6/9.14.
  - Three unauthenticated GETs each to `/api/v1/db/ingest-projection-inputs`, `/api/v1/db/build-projection-derived-v2` and `/api/v1/db/update-PbP` (expect 401/401/405 or 401 per method). The same for `update-yahoo-players`, `update-yahoo-weeks` and `manual-refresh-yahoo-token`.
- **Production catalog, ACLs and migrations:**
  - `select version from supabase_migrations.schema_migrations` for 20260720105524, 20260721013821, 20260722010355, 20260730091500, 20260723040553 and 20260725200808.
  - `information_schema.routine_privileges` for the Yahoo writer RPCs: anon and authenticated must not have EXECUTE, service_role must have it.
  - `pg_class.relrowsecurity` and `pg_policies` for the projection-materialization state tables.
- **Scheduler state:** `select jobid, jobname, schedule, active, command from cron.job where jobid in (16, 104, 106, 234, 308, 393)`. This checks job 308 inactive and 393 active, job 106 without a hard-coded `gameId=465`, job 234 disabled, and job 104 timeout versus the 210 s budget.
- **Production data checks:**
  - Count `shift_charts` rows with invalid `primary_position`/`player_type` (claimed 32,397 legacy-invalid rows unchanged). The count of `projection_game_materialization_status` completed rows for the audited date.
  - Whether any production games failed on `Conflicting relationship position`: `cron_job_audit` rows for `update-shift-charts` with errors containing that text.
- **Lint and knip:** `cd web && npm run lint` for the zero-error and warning-count claims (CLN C0027, C0031, C0076, 5.7.24) and `knip --production` for DEAD C0031.
- **Git history:** `git rev-list --objects HEAD | rg _cacache | wc -l` plus the largest-blob check to confirm problem #2. Decide whether to rewrite or untrack the cache before release.
