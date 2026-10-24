# G5b-forge-dashboards-trends: findings

Audited at HEAD `ceceb407a` (octoberBranch), compared with production `457435eb`. Read-only; no tests were run (Chef's full-suite result was relied on).

## (a) Coverage

- **Completed rows in group:** 556 ledger rows across the 9 source files, plus 15 master rows (3.10, 3.11, 3.12, 3.13, 4.7, 4.15, 5.4.3, 5.4.4, 5.4.5, 5.7.7, 5.7.8, 5.7.15, 5.7.16, 5.7.20, 5.7.21). All 571 are `[x]`.
  - Per source: command-center 83, remediation 78, component-health 47, forge-dashboard 49, pass-3 47, pass-4 94, living 66, combo 39, trends 53.
- **Audited:** all 15 master rows, plus 70 ledger rows (85 verdict rows). About 40 had a full code and test read; the rest were a shorter code-and-test spot check.
- **Selection order:**
  1. all master rows;
  2. all `P1` rows: command-center NEW 16, remediation 19.1, forge-dashboard NEW 8.0, pass-4 NEW 25.1, living NEW 29.1, combo NEW 8.0, trends NEW 12;
  3. rows whose owning code changed after 2026-07-29. The main changes are commit `4929392498` (2026-07-30, Command Center promotion), the `5740289cc` CTPI rewrite (2026-08-29), `26f04ef88` and `7f094c8e6` (October), and `fdfbb2764`;
  4. a spread sample of the rest.
- **Repo-level findings behind the verdicts:**
  - The redaction routes (`skater-power`, `team-ctpi`, `sustainability/trends`, `runs/latest`, `ownership-trends`, `ownership-snapshots`) are byte-identical to production `457435eb`.
  - `7f094c8e6` changed `forge/players.ts`, `forge/goalies.ts`, `lib/projections/apiHelpers.ts` and `calibrationEligibility.ts` in this area (the external-fantasy provenance gate).
  - `start-chart.ts` also has an uncommitted working-tree diff (a 4,000,000-byte response cap).
  - I did not use `accepted_base_overwritten` to select rows: every row in `path-ledger.json` carries that key, and I did not filter on its contents.

## (b) Verdict table

Ledger line is the line in `tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md`. Source rows use `SRC::<file>::Cnnnn`; file names are shortened to the basename.

### Master rows

| row | ledger | verdict | evidence | note |
|---|---|---|---|---|
| 3.10 A-FORGE-DASH | 435 | STALE-EVIDENCE | `web/pages/forge/dashboard.tsx` is now a 40-line redirect (commit `4929392498`). The six `forge-dashboard/*Card.tsx` files and `TopAddsRail.tsx` have no non-test importers. `__tests__/pages/forge/dashboard.test.tsx` went from about 2,365 lines to 3 tests. | Outcomes were done, but "rollback" and the 4-green/3-yellow/3-red matrix describe components that are now orphaned. Redaction holds for the APIs (see 5.7.15). |
| 3.11 A-FORGE-CC | 436 | STALE-EVIDENCE | The source file shows 83/83 closed, and NEW 18.0 closed on 2026-07-31. | Master text still says "80/82 … NEW 18 remains open". Redirect, hydration and skater-power code verified (see C0077 and C0082). |
| 3.12 A-FORGE-P4 | 437 | STALE-EVIDENCE | 94/94 rows are checked. The "dynamic eight-file group passes 64/64" figure cannot be reproduced because `dashboard.test.tsx` was gutted. | Redaction covers only 3 routes (see 5.7.7); same-class gaps remain (Top problems 1). |
| 3.13 A-FORGE-LIVE | 438 | VERIFIED | `run-projection-v2.ts:919,1366` (`gameIds`). `lib/projections/stages/skater-stage.ts:376-390` keeps the season-qualified fallback (`.eq("season", seasonId)`). `runs/latest.ts:210-228` with `__tests__/pages/api/v1/runs/latest.test.ts:247-280`. | The preview deployment and run-row facts are not checkable offline (section d). |
| 4.7 B-FORGE-COMBO | 454 | STALE-EVIDENCE | "`/forge/dashboard` remains the named rollback route" is false after `4929392498`; the route now redirects (`pages/forge/dashboard.tsx:35-40`). | The Top Movers wrapper is absent and `/trends` imports `TopMovers` directly (`pages/trends/index.tsx:9,1227`), which still holds. |
| 4.15 B-TRENDS | 466 | CONTRADICTED | `pages/api/v1/trends/goalie-power.ts:110,432-460` (`PAGE_SIZE = 2000`). No route tests for `goalie-power` or `team-sos` under `__tests__`. | The master claim is "canonical contracts/reads … 53/53". Two sub-claims are unsupported (SRC trends C0013 and C0017). The three skater/team/CTPI routes are fine. |
| 5.4.3 | 494 | CONTRADICTED | `lib/dashboard/clientFetchCache.ts:36` throws `Request failed (${status}) for ${url}`. `lib/dashboard/commandCenterData.ts:173-176` returns it as `module.error`. `components/forge-command-center/CommandCenterShell.tsx:155,172` renders it. `__tests__/pages/forge/command-center.test.tsx:420-455` asserts it. | NEW 8.0 was fixed only on the legacy cards, which are now dead code. The canonical surface still renders fetch URLs and HTTP status. |
| 5.4.4 | 495 | STALE-EVIDENCE | The matrix artifact exists (`tasks/artifacts/forge-dashboard-component-health-matrix.md`). The components it grades are orphaned. | Matrix content is unchanged and still describes the retired dashboard. |
| 5.4.5 | 496 | VERIFIED | `pages/api/v1/db/update-team-power-ratings-new.ts:3-24` (HTTP 200, `operationStatus: "warning"`, `retentionReason`). `__tests__/pages/api/v1/db/update-team-power-ratings-new.test.ts` exists. `update-rolling-games.ts` and `update-power-rankings.ts` are 410 stubs with `retentionReason`. | Deleted routes are absent: `update-goalie-projections.ts`, `update-start-chart-projections.ts`, `update-wgo-ly.ts`, `lib/projections/runProjectionV2.ts`. |
| 5.7.7 | 512 | VERIFIED | `trends/skater-power.ts:790` (`SKATER_TRENDS_UNAVAILABLE`), test `skater-power.test.ts:570-593`. `team-ctpi.ts:257` (`TEAM_CTPI_UNAVAILABLE`) with `team-ctpi.test.ts`. `sustainability/trends.ts:294` with `sustainability/trends.test.ts`. | All three are identical to production. Same-class leaks in sibling routes are not covered (Top problems 1). |
| 5.7.8 | 513 | VERIFIED | `runs/latest.ts:208-227`, test `latest.test.ts:247-280` (asserts no `secret` or `private forge_runs` in the body). Zombie-run tests `latest.test.ts:123-246`. | Identical to production. The sibling `runs/[runId].ts:105-109` still returns `error.message`. |
| 5.7.15 | 520 | STALE-EVIDENCE | `ownership-trends.ts:528` (`OWNERSHIP_TRENDS_UNAVAILABLE`), `ownership-snapshots.ts:271`, `start-chart.ts:2195` (`START_CHART_UNAVAILABLE`, test `start-chart.test.ts:2373-2390`), `ownership-trends.test.ts:183-200`. | Redaction is verified. The "48-test route/dashboard cohort" and the unchanged 4/3/3 matrix rely on the deleted dashboard suite and orphaned cards. |
| 5.7.16 | 521 | UNVERIFIABLE-OFFLINE | Code present: the redirect with `dashboard.test.tsx`, `skater-power.ts:143-154,663-688,767` (`metricFetchMs`, Vercel-only), and the pagination order at `skater-power.ts:559-560`. | The latencies and deployment ids are production facts. The telemetry fields have no test assertion. |
| 5.7.20 | 525 | STALE-EVIDENCE | The rollback-route statement is superseded by `4929392498`. | The 39/39 parity and wrapper-absent claims hold. |
| 5.7.21 | 526 | VERIFIED | `hooks/useDashboardData.test.tsx:147-215` (independent section retry; recency `mixed` at a 19-day gap). `__tests__/pages/trends/index.test.tsx:250-283,341-376`. `lib/dashboard/dataFetchers.ts:341-385` (3-day alignment window). `pages/trends/index.tsx:219-233`. | Lazy fanout, recency downgrade and scoped retry are intact. |

### Command Center (`tasks-prd-forge-command-center-rebuild.md`)

| row | ledger | verdict | evidence | note |
|---|---|---|---|---|
| C0007 (1.6) | 1783 | STALE-EVIDENCE | `pages/forge/dashboard.tsx` is now a redirect. | "Rollback/reference route" no longer exists. |
| C0018 (3.3) | 1794 | VERIFIED | `lib/dashboard/commandCenterData.ts:262-300`; tests `commandCenterData.test.ts:32,158`. | |
| C0037 (5.6) | 1813 | VERIFIED | `TopAddsWatchlist.tsx:67-68` (25/75); `command-center.test.tsx:353` asserts the "Own 25-75%" label. | The test checks the label, not the band filtering. |
| C0044 (6.5) | 1820 | VERIFIED | `PlayerInsightCore.tsx:45-46,77-79` (25/50); test `command-center.test.tsx:354`. | Same label-only assertion. |
| C0060 (8.3) | 1836 | VERIFIED | Same two label assertions. | Weak: no test places an out-of-band row. |
| C0074 (9.9) | 1850 | STALE-EVIDENCE | "`/forge/dashboard` remains … `Legacy Dashboard` rollback" is superseded by NEW 17. | |
| C0077 (NEW 12.0) | 1853 | VERIFIED | `pages/forge/command-center.tsx:82,170,197` (`routeStateHydrated`); test `command-center.test.tsx:389`. | |
| C0078 (NEW 13.0) | 1854 | VERIFIED | `commandCenterData.ts:315-318` passes `date` to skater-power. | Start Chart now clamps past dates to today (`start-chart.ts` `requestedDate = request.date < today ? today : request.date`, from `26f04ef88`; test `start-chart.test.ts:2065`). The focused slate for a historical date therefore shows today's slate. Recorded as an observation. |
| C0080 (NEW 15.0) | 1856 | VERIFIED | `pages/FORGE.tsx:216,484`; test `FORGE.test.tsx:46`. | |
| C0081 (NEW 16.0 P1) | 1857 | UNVERIFIABLE-OFFLINE | `skater-power.ts:559-560` orders by `game_date DESC, player_id`. Test `skater-power.test.ts:275-309` pages past 1,000 rows. | The deployment and log facts are production only. |
| C0082 (NEW 17.0) | 1858 | VERIFIED | `pages/forge/dashboard.tsx` uses `permanent: false`. `dashboard.test.tsx` checks the query-key allowlist. | |
| C0083 (NEW 18.0) | 1859 | UNVERIFIABLE-OFFLINE | `skater-power.ts:663-688` runs the 4 categories with `Promise.all`. | Latency numbers are production only. |

### Dashboard remediation (`tasks-forge-dashboard-component-remediation.md`)

| row | ledger | verdict | evidence | note |
|---|---|---|---|---|
| 1.1 | 1864 | VERIFIED | `team-ctpi.ts:59-61,235` and `skater-power.ts:731` stamp `generatedAt` from the source date. | |
| 1.2 | 1865 | STALE-EVIDENCE | `FORGE.tsx:204-206,563` still warns on mixed dates. | The `dashboard.tsx` half is gone. |
| 1.4 | 1867 | UNVERIFIABLE-OFFLINE | `forge/goalies.ts` `@7f094c8e6` (about lines 482-487) now throws 422 when the selected run lacks `metrics.input_provenance.external_fantasy_input_contract`. | Depends on whether production runs carry the new field (section d, check 1). |
| 2.1 | 1870 | VERIFIED | Client joins use mapped IDs. | Caveat: `transactions/ownership-snapshots.ts:100-160` still resolves unmapped players by name. The match is ambiguous for duplicate names (for example two NHL players named Sebastian Aho), and the code takes the most recent timeline row. It is only a secondary path. |
| 2.2 | 1871 | VERIFIED | `ownership-trends.ts:57,75-87` (1,000-row pages). Snapshots use 500-id chunks (`ID_CHUNK_SIZE = 500`) with `range(0,999)`. | Without the `season` filter the snapshot read could exceed 1,000 rows per chunk; that path is only the fallback. |
| 3.2 | 1877 | STALE-EVIDENCE | `team-ctpi.ts` (`5740289cc`, 2026-08-29) now reads only `team_ctpi_daily` and serves only rows whose payload is approved (`isTrustedRecentTeamFormPayload`). | The "daily plus four fallback source tables" description is gone. `update-team-ctpi-daily.ts:293` still writes `payload: c`, where `lib/trends/ctpi.ts:310` sets the legacy status. Served coverage depends on the V2 materializer (section d, check 3). |
| 3.4 | 1879 | UNVERIFIABLE-OFFLINE | Production job 392 and the 52,153-game probe. | |
| 5.1 | 1888 | VERIFIED | `lib/dashboard/freshness.ts:327-340` has the 30h/72h policy; `freshness.test.ts` exists. | `26f04ef88` added a `next_scheduled_date`/`upcoming` status without weakening it. |
| 5.2 | 1889 | VERIFIED | `lib/dashboard/perfBudget.ts:14-38`. | Start Chart budget is 300,000 bytes. Production evidence was an offseason 1,665-byte payload (see combo 7.1). |
| 5.3 | 1890 | STALE-EVIDENCE | `evaluateMixedEffectiveDates` is still used by `FORGE.tsx`. | The dashboard "regressions" no longer exist. |
| 6.0 | 1893 | STALE-EVIDENCE | See 5.4.4. | |
| 8.2 | 1911 | VERIFIED | `skater-power.test.ts:275-309` expects range `[1000, 1999]`. | |
| 10.1 | 1916 | VERIFIED | `update-team-ctpi-daily.ts:74-105` uses `fetchPaginatedRows` (`lib/power-ratings.ts:7-32`). | |
| 18.0 | 1937 | STALE-EVIDENCE | The "retained legacy dashboard rollback" it fixed is gone. | |
| 19.1 | 1939 | VERIFIED | Same evidence as 5.7.15. | |

### Other FORGE dashboard sources

| row | ledger | verdict | evidence | note |
|---|---|---|---|---|
| forge-dashboard C0009 (2.1) | 2002 | REGRESSED | Commit `4929392498` (2026-07-30) replaced the `dashboard.tsx` band composition with a redirect (-578 lines). | Owner-approved. The source row still says "recompose `dashboard.tsx`". |
| forge-dashboard C0044 (7.3) | 2037 | REGRESSED | `4929392498` cut `dashboard.test.tsx` by 2,365 lines. | The cards have no page-level tests now. |
| forge-dashboard C0048 (NEW 8.0 P1) | 2041 | CONTRADICTED | The six legacy cards have the stable copy (`TeamPowerCard.tsx:137`, `GoalieRiskCard.tsx:142`, `SlateStripCard.tsx:176`, and others). The live Command Center does not (see 5.4.3). | |
| forge-dashboard C0049 (NEW 8.1) | 2042 | STALE-EVIDENCE | It records "preview/full-dashboard/Command-Center ownership"; the full dashboard no longer exists. | |
| pass-3 C0003 (1.2) | 2048 | VERIFIED | `start-chart.ts` reads `forge_runs` and `forge_player_projections`; `update-start-chart-projections.ts` is absent; `compatibilityInventory.ts:88,125`. | |
| pass-3 C0009 (2.2) | 2054 | VERIFIED | `projections/players.ts:41-58,95` sets the `Deprecation` header and `deprecated: true`. | |
| pass-3 C0010 (2.3) | 2055 | VERIFIED | `runProjectionV2.ts` is absent; `lib/projections/module-imports.test.ts:122`. | |
| pass-3 C0011 (2.4) | 2056 | VERIFIED | `team_power_ratings_daily__new` appears only in the stub and the generated types. | |
| pass-3 C0018 (3.5) | 2063 | VERIFIED | `players.ts` imports `buildRequestedDateServingState`; `goalies.ts` and `start-chart.ts` import `buildResolvedDataServingContract`. | |
| pass-3 C0026 (5.3) | 2071 | VERIFIED | No `min-width: 1300` in `styles/Home.module.scss`. | |
| pass-3 C0039 (8.2) | 2084 | VERIFIED | Three routes are kept as stubs with a `retentionReason`; the others are deleted. | The AC allows "explicit retention reason". |
| pass-3 C0042 (9.2) | 2087 | VERIFIED | `update-start-chart-projections.ts` is absent. | |
| pass-3 C0047 (NEW 11.0) | 2092 | VERIFIED | See 5.4.5. | |
| pass-4 C0043 (11.1) | 2138 | VERIFIED | `dataFetchers.ts` is the live Trends loader (`hooks/useDashboardData`). | |
| pass-4 C0058 (15.2) | 2153 | STALE-EVIDENCE | `TopAddsRail.tsx` has no consumer. | Only `TopAddsRail.test.tsx` imports it. |
| pass-4 C0060 (15.4) | 2155 | STALE-EVIDENCE | `TeamPowerCard.tsx` has no consumer. | |
| pass-4 C0061 (15.5) | 2156 | STALE-EVIDENCE | `SustainabilityCard.tsx` and `HotColdCard.tsx` have no consumer. | |
| pass-4 C0076 (20.1) | 2171 | VERIFIED | `skater-power.ts:215-253` blocks a fallback of 3 or more days beyond the threshold. | |
| pass-4 C0081 (21.1) | 2176 | VERIFIED | `sustainability/trends.ts:179-236` applies guardrails (`lib/sustainability/guardrails`). | |
| pass-4 C0082 (21.2) | 2177 | VERIFIED | `skater-power.ts:130,303-309` (`MIN_TREND_SAMPLE_GAMES = 10`, shrink to neutral); test `skater-power.test.ts:520`. | |
| pass-4 C0083 (21.3) | 2178 | STALE-EVIDENCE | `GoalieRiskCard.tsx` is orphaned. | |
| pass-4 C0084 (21.4) | 2179 | STALE-EVIDENCE | `TeamPowerCard.tsx` is orphaned. | |
| pass-4 C0091 (24.0) | 2186 | VERIFIED | `lib/dashboard/normalizers.ts:7-11`. | Whitespace-only strings pass `Number()` as 0, but empty strings and null are rejected. |
| pass-4 C0093 (NEW 25.1 P1) | 2188 | VERIFIED | See 5.7.7. | The route list is exactly three. |
| living C0048 (13.0) | 2240 | VERIFIED | `TopMoversCard.tsx` is absent. | |
| living C0050 (15.0) | 2242 | VERIFIED | `update-game-goal-projections/index.ts:26-30` (`LEGACY_GAME_GOAL_MODEL_CONTRACT`). | No test asserts it. |
| living C0057 (22.0) | 2249 | VERIFIED | `runs/latest.ts:165-182` (selection logic); `latest.test.ts:123-246`. | |
| living C0059 (24.0) | 2251 | VERIFIED | `trends/player-trends.ts:366-400`; `player-trends.test.ts:162` ("1-250 valid IDs"). | |
| living C0061 (26.0) | 2253 | VERIFIED | `run-projection-v2.ts:919,1366`. | |
| living C0065 (NEW 29.1 P1) | 2257 | VERIFIED | See 5.7.8. | |
| combo C0028 (6.0) | 2289 | STALE-EVIDENCE | The "one-release rollback route" statement is superseded. | |
| combo C0032 (6.4) | 2293 | REGRESSED | The claim: "every remaining live `forge-dashboard` component consumed". After `4929392498`, seven components in `components/forge-dashboard/` (the 6 cards and `TopAddsRail`) have zero non-test importers. | The wrapper-only removal was correct on 2026-07-29. |
| combo C0034 (7.1) | 2295 | STALE-EVIDENCE | "one movers point" has no consumer left. `placeholder.tsx` and `commandCenterData.ts:315` omit `seriesGames`, so the default of 40 applies (`skater-power.ts:131`). | The 280 KB test uses a full 60 by 82 input. The Start Chart 300 KB budget is evidenced only by an offseason 1.6 KB response. |
| combo C0038 (NEW 8.0 P1) | 2299 | UNVERIFIABLE-OFFLINE | `perfBudget.ts` matches the cited budgets. | The production byte measurements are production facts. |

### Trends (`tasks-prd-trends.md`)

| row | ledger | verdict | evidence | note |
|---|---|---|---|---|
| C0013 (3.1) | 5695 | CONTRADICTED | `trends/goalie-power.ts:110` has `PAGE_SIZE = 2000` and breaks when `data.length < PAGE_SIZE` (line 456). The repo config says `max_rows = 1000` (`supabase/config.toml:18`). | A capped 1,000-row response ends the loop, so goalie rows are silently truncated. Skater-power was fixed for exactly this (remediation 8.1). Conditional on the hosted max-rows setting (section d, check 2). |
| C0017 (3.5) | 5699 | CONTRADICTED | `__tests__/pages/api/v1/trends/` has only `player-trends`, `skater-power`, `team-ctpi` and `team-power` tests. No test imports `goalie-power` or `team-sos`. | The claim is "API tests for full paging … structured errors". |
| C0036 (7.3) | 5718 | VERIFIED | `dataFetchers.ts:341-385`; `hooks/useDashboardData.test.tsx:191-194`; `trends/index.test.tsx:359-376`. | |
| C0040 (8.2) | 5722 | VERIFIED | `useDashboardData.test.tsx:147-215` (and the loading-section assertion at 163-165). | |
| C0041 (8.3) | 5723 | VERIFIED | `trends/index.tsx:797-818`; test `trends/index.test.tsx:341`. | |
| C0043 (8.5) | 5725 | VERIFIED | `trends/index.tsx` `normalizeDashboardDate`; test `trends/index.test.tsx:285`. | |
| C0051 (NEW 11.0) | 5733 | VERIFIED | `useDashboardData.test.tsx:206-215` (only the team group is re-requested). | |
| C0052 (NEW 12.0 P1) | 5734 | VERIFIED | `trends/index.tsx:219-233` (`IntersectionObserver`, rootMargin 300px); test `trends/index.test.tsx:250-283`. | |
| C0053 (NEW 13.0) | 5735 | VERIFIED | Source and master parity noted as 53/53. | Doc-only. |

Verdict counts over the 85 rows: VERIFIED 49, STALE-EVIDENCE 22, UNVERIFIABLE-OFFLINE 6, CONTRADICTED 5, REGRESSED 3, NOT-CHECKED 0.

## (c) Top problems

1. **P2: same-class dependency-detail leaks remain in public FORGE/Trends routes (rows 5.4.3, NEW 25.1 scope).**
   - `GET /api/v1/trends/team-power` (`team-power.ts:245-250`) returns `error: error?.message`.
   - `GET /api/v1/trends/goalie-power` (`goalie-power.ts:621-628`) returns `message: error?.message`.
   - `GET /api/v1/trends/team-sos` (`team-sos.ts:184-190`) returns `error: error?.message`.
   - `GET /api/v1/trends/player-trends` (`player-trends.ts:469-474`) returns `message: error.message`.
   - `GET /api/v1/runs/[runId]` (`runs/[runId].ts:105-109`) returns `error: error?.message`.
   - All five are byte-identical to production `457435eb`.
   - These routes feed the Team Power card and the Trends page. NEW 25.1 and NEW 29.1 each covered only specific routes, so the "dashboard-wide" containment is incomplete.
   - Supabase error text such as relation or column names could reach clients.
2. **P2: goalie-power pagination can truncate (4.15, trends 3.1).** `goalie-power.ts:110,432-460` uses a 2,000-row page against a 1,000-row cap, so the first capped page ends the scan. It is untested, and the claimed API tests for `goalie-power` and `team-sos` do not exist (trends 3.5, P3).
3. **P3: the canonical Command Center renders raw request details (5.4.3, forge-dashboard NEW 8.0).** It shows "Request failed (500) for /api/v1/..." (`clientFetchCache.ts:36`), and the test asserts this (`command-center.test.tsx:453-455`). This exposes internal route and query strings only, and the underlying API 500 bodies are redacted for the three routes above.
4. **P3 (intentional, evidence stale): the legacy dashboard is gone (3.10, 4.7, 5.4.4, 5.7.15, 5.7.20, forge-dashboard 2.1 and 7.3, combo 6.0 and 6.4).**
   - `4929392498` replaced `pages/forge/dashboard.tsx` with a redirect and removed about 2,365 lines of dashboard tests.
   - Seven `components/forge-dashboard/*` files are dead code. Many P4 and living-audit rows (15.x, 21.3, 21.4, 18.0, 19.0) verify behavior that no user can reach.
   - Master text for 4.7 and 5.7.20 still says "`/forge/dashboard` remains the rollback route"; 3.11 says 80/82.
5. **Cross-cutting release risk (not a row contradiction; see section d, check 1).** `7f094c8e6` makes four paths fail closed unless the selected `forge_runs` row carries `metrics.input_provenance.external_fantasy_input_contract = "excluded_from_native_inputs_v1"`. The paths are `/api/v1/forge/players`, `/api/v1/forge/goalies`, the legacy Start Chart slate, and `requireLatestSucceededRunId` (used by `projections/*`).
   - In `forge/players.ts` the run for the requested date throws 422 rather than falling back to an older qualified run (`players.ts` `requireLatestSucceededRunId`, 404-only catch).
   - If production runs predate the field, deploying `HEAD` would blank Command Center Top Adds and Goalie Context and the Trends projection section until a qualifying run exists. Trends degrades to a section notice; Command Center shows module errors.
   - These are the surfaces behind 3.10, 3.11 and 4.7.

## (d) UNVERIFIABLE-OFFLINE checks needed

1. **Provenance gate:** `select run_id, as_of_date, status, metrics->'input_provenance'->>'external_fantasy_input_contract' as c from forge_runs where status='succeeded' order by as_of_date desc, created_at desc limit 10;` Every recent run must show `excluded_from_native_inputs_v1` before `HEAD` is released (risk 5; rows 1.4, 3.10, 3.11).
2. **Goalie trend truncation:**
   - Check the Supabase project API "max rows" setting.
   - Compare `select count(*) from player_trend_metrics where metric_type='goalie' and season_id=<current> group by metric_key` with the number of goalies the live `/api/v1/trends/goalie-power` returns. One request.
   - Rows 4.15 and trends 3.1.
3. **CTPI coverage:** `select date, count(*) filter (where payload->>'publicationStatus'='approved') approved, count(*) total from team_ctpi_daily group by 1 order by 1 desc limit 3;` This tells whether `team-ctpi.ts` serves 32 trusted teams (row 3.2).
4. **Deployments and logs (read-only Vercel):** `dpl_vU1c1yvbDQJMXEzK1rLT373Qndwy`, `dpl_2DyH68oEiUhfsakGfRcHMAFdmumA`, `dpl_4q8GM1wqTbHR3NbnxRxAakdLEvJr` and `dpl_9upPoBLks2mqM2ny6KHpHy8tqaHB` state and runtime-error queries (rows 5.7.16, C0081, C0083, combo NEW 8.0, 3.13).
5. **Cron owners:** `select jobid, schedule, active from cron.job where jobid in (44,275,279,283,329,392,393,308);` (remediation 3.1, 3.4, 13.0, 15.3, 17.0).
6. **Start Chart in-season size:** one GET of `/api/v1/start-chart` for an in-season slate date, to compare bytes against the 300,000-byte budget (`perfBudget.ts:18`). The production byte probe was offseason. Consumers do not paginate (`commandCenterData.ts:272`, `dataFetchers.ts:440`).
