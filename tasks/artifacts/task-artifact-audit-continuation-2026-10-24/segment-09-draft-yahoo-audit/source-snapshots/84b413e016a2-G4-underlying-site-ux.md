# G4-underlying-site-ux findings (read-only audit, 2026-10-17, HEAD ceceb407a + working tree)

## (a) Coverage

- Completed rows in group: 639 ledger rows in the 12 assigned sources (all `[x]`), plus 17 master rows (3.6, 3.7, 3.8, 4.4, 4.10, 5.3, 5.3.1-5.3.6, 5.7.3, 5.7.4, 5.7.5, 5.7.18, 5.7.19).
- Audited in depth: all 17 master rows plus 58 ledger rows (some table lines cover 2-3 adjacent rows), 75+ rows total. Selection order: every master row; then every P0/P1 "NEW" row in the sources (Splits 15.0, public 500 redaction x4, OMT failure, desktop-vertical policy, GameGrid P0/P1 build/TS rows, WiGO 7.0-7.2, mobile 6.x); then rows whose owning code changed after the completion date (Game Grid Oct-2026 commits, `25c89d795`, `f90bb13cd`, `15caa26eac`, `7f094c8e6`, working-tree edits); then a spread sample of doc/CSS/test rows.
- Ledger lines are absolute line numbers in the master list file. Master rows: 3.6=L431, 3.7=L432, 3.8=L433, 4.4=L451, 4.10=L457, 5.3=L484, 5.3.1-5.3.6=L485-490, 5.7.3=L508, 5.7.4=L509, 5.7.5=L510, 5.7.18=L523, 5.7.19=L524.
- Tests run: only `components/HomePage/HomepageStandingsInjuriesSection.test.tsx` (14/14 pass) to resolve a working-tree test/component wording mismatch. Chef's full run is relied on for everything else.
- Production comparison: `25c89d795`, `f90bb13cd`, `15caa26eac`, `fefefe006`, `58cd039b4`, `eb33eda00` are ancestors of production `457435eb`, so they are already live. `4ca92f874` (sticky date header below navbar, Oct 12) is NOT in production.
- `accepted_base_overwritten` in path-ledger.json is empty for every path in this group, and no file in this group is in the 319-path origin/master..octoberBranch list. Risk here comes from already-released Sep/Oct commits and uncommitted working-tree edits. The unreviewed `7f094c8e6` touched only `pages/stats/index.tsx`, `StatsPage/MobileTabInterface.tsx`, `lib/NHL/statsPageFetch.ts` in this group, additively (position filter), and nothing regressed.

### Game Grid working-tree edit (requested note)
Uncommitted `web/components/GameGrid/utils/calcWinOdds.ts` deletes `adjustBackToBackGames`, a no-op stub that has said "no longer needed" since 2024-10-24 (`b8891d6ff8`), and `calcWinOdds.test.js` drops the ~1,280-line block that exercised only that stub. Real back-to-back dilution (x0.75) lives in `convertTeamRowToWinOddsList` and is still asserted in `scheduleSummary.test.ts:109` (50 -> 37.5). No completed claim cites the removed function. Verdict: this edit changes no completed claim.

### Other relevant working-tree edits (not in HEAD)
- `lib/underlying-stats/teamStatsQueries.ts`, `teamStatsLandingApi.ts`, `pages/underlying-stats/teamStats/index.tsx`: add a `coverage` object (completed vs summarized games) and a "Partial season" notice, and only apply official NHL totals when games-played matches. Extends 5.3.2; does not undo it.
- `lib/underlying-stats/teamLandingDashboard.ts` (+test), `components/underlying-stats/UnderlyingStatsDashboard.tsx`, `NavBar`, `pages/underlying-stats/index.tsx` and its tests: prune dead helper code and continue the simplified landing redesign (see LANDING/POWER rows).

## (b) Table

| row id | ledger line | verdict | evidence | note |
|---|---|---|---|---|
| 3.6 A-US-SOS | 431 | UNVERIFIABLE-OFFLINE | code: `lib/underlying-stats/teamScheduleStrength.ts:233-236` ((2*direct+indirect)/3), test `teamScheduleStrength.test.ts:19`; freshness gate is prod data | (d) #1; also see LANDING/POWER regressions under it |
| 3.7 A-SITE | 432 | REGRESSED (partial) | Game Grid and WiGO workflow links removed; see SITE C0052/C0069 | other site rows hold; "47/47" count is stale |
| 3.8 A-STYLE | 433 | VERIFIED | modal lifecycle `DraftSummaryModal.tsx:66-117`, `ComparePlayersModal.tsx:52-70`, `ImportCsvModal.tsx:484-507`; guide `fhfh-styles.md:1301`; `playerUnderlyingCoverage.ts` | live Martone evidence is prod-only |
| 4.4 B-GAMEGRID | 451 | STALE-EVIDENCE | order, sorts, 1023/1024, Legacy Vertical all hold (`DesktopMasterTable.tsx:590-775`, `GameGrid.tsx:84-95,1417`, `SortableHeaders.test.tsx:62-71,346-423`) | 4WK cells gained favorability shading on 2026-10-09 (`fefefe006`, prod); "Score-only" emphasis no longer the whole story |
| 4.10 B-DRAFT-STYLE | 457 | REGRESSED | `PlayerPickupTable.module.scss:1748-1763` raw rgba/hex added by `f90bb13cd` (2026-09-17, prod) | scan-clean claim false now; see DRAFT C0023/C0041 |
| 5.3 C-US | 484 | REGRESSED (partial) | roll-up; 5.3.2 and 5.3.4 carry findings | |
| 5.3.1 Player landing | 485 | VERIFIED | `pages/api/v1/underlying-stats/players.ts:41-66`, `players/[playerId].ts:39-64`, `playerStatsLandingServer.ts:2155-2175` (chunked + paged identity); API tests under `__tests__/pages/api/v1/underlying-stats/` | caveat: REST shift read lacks `shift_id` tie-break (Top problems #7) |
| 5.3.2 Team landing | 486 | CONTRADICTED (P2) | `teamStatsQueries.ts:838-839` league-wide read orders only `(game_date desc, game_id desc)`; PK is `(game_id, team_id, strength, score_state)` so the two rows per game tie across 1000-row pages | claim says "complete paginated summary reads"; sibling items enforced total order. Freshness note: (d) #2 |
| 5.3.3 Goalie landing | 487 | VERIFIED | `goalies.ts:48-72`, `goalies/[playerId].ts:44-70`; tests `goalies.test.ts`, `goalies/[playerId].test.ts` | |
| 5.3.4 Landing + power-rankings roadmaps | 488 | CONTRADICTED (P2) | `pages/underlying-stats/index.tsx:346` default view `"advanced"` (since `25c89d795`); trust/context/inefficiency modules removed (same commit); no test covers `MetricPopover` (`index.tsx:292-318`) | numeric sort (`index.test.tsx:481`), narrative pagination (`teamLandingRatings.ts:116-143`, test `:82`), BCS SoS do hold |
| 5.3.5 Mobile Stats | 489 | VERIFIED | `pages/stats/index.tsx:251-297`, `lib/NHL/statsPageFetch.ts:46-258`, `MobileTabInterface.tsx` role=tab, `MobileTeamList.module.scss:129,321,342` | master row has no evidence text (doc gap) |
| 5.3.6 WiGO | 490 | VERIFIED | `components/WiGO/errorMessages.ts`; no `.message` rendered in `components/WiGO/*`; `utils/fetchWigoPlayerStats.ts:671-692` | |
| 5.7.3 C-DYNAMIC-A-US-SOS | 508 | VERIFIED | `teamScheduleStrength.ts:233-236`; `teamScheduleStrength.test.ts:19,88,128` | |
| 5.7.4 C-DYNAMIC-A-SITE | 509 | REGRESSED (partial) | `/splits` pagination holds (`lib/splits/splitsServer.ts:236-238,273-274,319-323,344-347,362-365,384-386`; `pages/api/v1/splits/index.ts:49-57`); Game Grid/WiGO cross-links regressed | see C0052/C0069 |
| 5.7.5 C-DYNAMIC-A-STYLE | 510 | VERIFIED | `DraftSummaryModal.tsx:66-117`; test `__tests__/components/DraftDashboard/DraftSummaryModal.test.tsx:182-224` | |
| 5.7.18 C-DYNAMIC-B-GAMEGRID | 523 | STALE-EVIDENCE | same as 4.4; "six-file/19-test" cohort stale (`SortableHeaders.test.tsx` alone has 11 `it`s) | |
| 5.7.19 C-DYNAMIC-B-DRAFT-STYLE | 524 | REGRESSED | raw-color clause broken at `PlayerPickupTable.module.scss:1748-1763` | season identity + `aria-sort` still hold (`PlayerPickupTable.tsx:283-290,1066`; `PlayerPickupTable.test.ts:12-24`) |
| SITE::C0008 (2.1 live period/clock) | 3424 | VERIFIED | `HomepageGamesSection.tsx:1235-1249`; `HomepageGamesSection.test.tsx:100-119` | |
| SITE::C0028 (4.7 splits hooks) | 3444 | VERIFIED | `siteSurfaceLinks.ts:49,83,108,218,248`; consumers `pages/trends/index.tsx:858`, `pages/stats/team/[teamAbbreviation].tsx:334`, `pages/lines/[abbreviation].tsx:305` | |
| SITE::C0033 (5.3 opponent tiers) | 3449 | VERIFIED | `TeamScheduleCalendar.tsx:205-243` ordered pagination; `lib/teamOpponentStrength.test.ts` | pagination loop itself untested |
| SITE::C0040 (6.1 goalie bands) | 3456 | VERIFIED | `goalieCalculations.ts:39-56,191-195`; `goalieCalculations.test.ts` | |
| SITE::C0043 (6.4 goalie route ownership) | 3459 | VERIFIED | `pages/goalies.js:1317-1325` redirect; `pages/variance/goalies.js:1` re-exports default only | no redirect test |
| SITE::C0051 (7.5 WGO driver cards) | 3467 | VERIFIED | `teamPerformanceDriverModel.ts:1` (24-team gate); `teamPerformanceDrivers.test.ts` | |
| SITE::C0052 (7.6 grid/WGO link to deep dives) | 3468 | REGRESSED | `SurfaceWorkflowLinks` + `GAME_GRID_SURFACE_LINKS` deleted from `pages/game-grid/[mode].tsx` by `f90bb13cd` (2026-09-17, prod); `getWigoSurfaceLinks` deleted from `pages/wigoCharts.tsx` by `15caa26eac` (2026-08-01, prod); exports now dead (`siteSurfaceLinks.ts:134,157`) | Team HQ row links on grid survive |
| SITE::C0066 (NEW 10.0) | 3482 | VERIFIED | `TeamScheduleCalendar.tsx:337-348` | |
| SITE::C0068 (NEW 12.0 ordinals) | 3484 | VERIFIED | `teamPerformanceDrivers.test.ts:74-79` | |
| SITE::C0069 (NEW 13.0 mount grid/WGO links) | 3485 | REGRESSED | same removals as C0052 | |
| SITE::C0070 (NEW 14.0 Team HQ links) | 3486 | VERIFIED | `DesktopMasterTable.tsx:1191,1313`, `TeamRow.tsx:166`, `TransposedGrid.tsx:198`, `FourWeekGrid.tsx:382,438`; `SortableHeaders.test.tsx:425-449` | |
| SITE::C0071 (NEW 15.0 Splits P1) | 3487 | VERIFIED | `splitsServer.ts` ordered `fetchAllSupabasePages`/`fetchAllSupabaseFilterChunks`; API 400/503 split; `__tests__/pages/api/v1/splits/index.test.ts:152-190` | |
| STYLE::C0055 (8.1 shared modal shell) | 3545 | VERIFIED | all three import `ModalShell.module.scss` | |
| STYLE::C0067 (10.6 coverage classifier) | 3557 | VERIFIED | `playerUnderlyingCoverage.ts:23-103`; `playerUnderlyingCoverage.test.ts` | |
| STYLE::C0072/C0074 (first 100 + load more) | 3562/3564 | VERIFIED | `pages/underlying-stats/playerStats/index.tsx:56,172-178`; `PlayerStatsTable.test.tsx` | |
| STYLE::C0088 (NEW 13.0 P1 modal focus) | 3578 | VERIFIED | see 5.7.5 | |
| MOBILE::C0016 (44px targets) | 3597 | VERIFIED | `MobileTeamList.module.scss:129,321,342`; `styles/vars.scss:37-41` | |
| MOBILE::C0035 (tabs not swipe) | 3616 | VERIFIED | `MobileTabInterface.tsx` `role="tab"`; `MobileTabInterface.test.tsx:75-115` | `7f094c8e6` `playerType` prop is additive |
| MOBILE::C0041 (single passive rAF listener) | 3622 | VERIFIED | `pages/stats/index.tsx:251-297` | |
| MOBILE::C0042 (full pagination) | 3623 | VERIFIED | `statsPageFetch.ts:46-70,95-103,155-187,222-230,251-258`; `statsPageFetch.test.ts` | |
| GAMEGRID::C0015 (3.2 exact order) | 4003 | VERIFIED | `DesktopMasterTable.tsx:593-775`; test `SortableHeaders.test.tsx:346-423` | |
| GAMEGRID::C0017 (3.4 sorts incl 4WK) | 4005 | VERIFIED | `DesktopMasterTable.tsx:316-345` (missing-last, alpha tie); test `:425-449` | |
| GAMEGRID::C0024 (4.4 4WK expanded + collapse) | 4012 | VERIFIED | `DesktopMasterTable.tsx:258`; test `:411-422` | |
| GAMEGRID::C0025 (4.5 emphasis Score-only) | 4013 | STALE-EVIDENCE | top/bottom-ten is still Score cell + team-cell edge (`DesktopMasterTable.tsx:1133-1139`, `GameGrid.module.scss:1905-1924`), but all four 4WK columns carry `data-favorability` thirds (`DesktopMasterTable.tsx:1275-1300`, `fourWeekMetricBands.ts`) since `fefefe006` | deliberate later design |
| GAMEGRID::C0033 (NEW 1.0 OMT failure) | 4021 | VERIFIED | `DesktopMasterTable.tsx:1000,1044,1162`; test `SortableHeaders.test.tsx:451-512` | cells show `-` plus status; no provider text |
| GAMEGRID::C0034 (NEW 2.0 1023/1024) | 4022 | VERIFIED | `GameGrid.tsx:84-95,1417`; test `:62-70` | |
| GAMEGRID::C0036/C0037 (P0 tab id, P1 TS order) | 4024/4025 | UNVERIFIABLE-OFFLINE | no `validTabs` identifier remains in `components/GameGrid` or `pages/game-grid`; TS cleanliness not rerun | (d) #4 |
| GOALIE::C0045 (NEW 7.0 P1) | 4074 | VERIFIED | goalie API files above | |
| PLAYER::C0082 / C0083 | 4160/4161 | VERIFIED | `players.ts:52-66`; `playerStatsLandingServer.ts:2155-2175` | |
| TEAM::C0002 (1.1 delete 20260408 migration) | 4167 | VERIFIED | `migrations/20260408_create_team_underlying_stats_tables.sql` absent; 20260407 present | evidence.json "missing path" is the intended outcome |
| TEAM::C0050 (NEW 12.1 zero-sample filter) | 4215 | VERIFIED | `teamStatsQueries.ts` `hasSampledTeamSummaryRow`; test `teamStatsQueries.test.ts:417` | |
| TEAM::C0055 (NEW 13.3 scan order) | 4220 | VERIFIED | `teamStatsSummaryRefresh.ts:1140-1142` | |
| TEAM::C0057 (NEW 14.1 goalie on ice) | 4222 | VERIFIED | `lib/supabase/Upserts/nhlShotFeatureBuilder.ts:385-406`; test `nhlShotFeatureBuilder.test.ts:383-418` | |
| TEAM::C0067 (NEW 15.0 P1) | 4232 | VERIFIED | `teams.ts:65-87` | |
| SOS::C0014 (NEW 7.0 standings refresh) | 4250 | UNVERIFIABLE-OFFLINE | prod `nhl_standings_details` | (d) #1 |
| SOS::C0033 (NEW 6.0 backfill snapshots) | 4269 | UNVERIFIABLE-OFFLINE | prod `team_power_ratings_daily` | (d) #3 |
| SOS::C0034 (NEW 8.0 reconcile 50/50) | 4270 | VERIFIED | `teamScheduleStrength.ts:233-236`; test `:19` | |
| LANDING::C0011/C0012/C0013 (2.4-2.6 sustainability, schedule-context, inefficiency summaries) | 4284-4286 | REGRESSED | UI removed by `25c89d795` (prod); helpers (`context`, `inefficiency`, `sustainability` in `teamLandingDashboard.ts`) deleted in uncommitted working tree; `teamLandingDashboard.test.ts` now asserts keys are only `fallers, quadrant, risers` | owner-superseded: new banner in `tasks-underlying-stats-landing-page.md` ("do not restore") |
| LANDING::C0023/C0024/C0025 (4.2-4.4 trust, what-matters-next, inefficiency modules) | 4296-4298 | REGRESSED | `__tests__/pages/underlying-stats/index.test.tsx:308-310` asserts "What looks real?", "Schedule texture", "Under the radar" absent | same supersession |
| POWER::C0015 (3.4 opens in approachable mode) | 4331 | REGRESSED | `index.tsx:346` default `"advanced"`; production `457435eb` line 343 identical (changed by `25c89d795`) | simple mode still reachable and tested |
| POWER::C0021 (4.4 schedule chips) | 4337 | VERIFIED | `index.tsx:259-289,758-770` | |
| POWER::C0026 (5.4 popover test coverage) | 4342 | CONTRADICTED (P2) | `MetricPopover` at `index.tsx:292-318`; no test/spec mentions it in `__tests__/pages/underlying-stats`, `e2e/underlying-stats.spec.ts`, `components/underlying-stats`, `lib/underlying-stats`; `git grep popover HEAD` finds nothing relevant | row claims focused interaction coverage |
| WIGO::C0037 (NEW 7.0 query contract) | 4611 | VERIFIED | `utils/fetchWigoPlayerStats.test.ts:291-300` | `2d38d1da5` made `fetchPlayerGameLogForStat` throw instead of returning `[]`; callers show stable text |
| WIGO::C0038 (NEW 7.1 P1 containment) | 4612 | VERIFIED | `errorMessages.ts`; 8 components import `WIGO_ERROR_MESSAGES`; no `.message` in `components/WiGO` | |
| WIGO::C0039 (NEW 7.2 P2 pagination) | 4613 | VERIFIED | `fetchWigoPlayerStats.ts:676-692` | |
| DRAFT::C0023 (4.4 raw-color scan empty) | 5440 | REGRESSED | `PlayerPickupTable.module.scss:1748,1752,1756,1758,1761,1763` (`rgba(255,255,255,..)`, `#77cfff`, `#20252d`, `#10384e`) from `f90bb13cd`; `DateRangeTeamGrid.module.scss:85-102` still has webkit-scrollbar rules (outside the three named modules) | `.yahooContext` is new Yahoo context UI |
| DRAFT::C0041 (8.1 zero white/black RGBA) | 5458 | REGRESSED | same lines | |
| DRAFT::C0053 (NEW 11.0 PDHC modal) | 5470 | VERIFIED | `PDHC/Tooltip.tsx:29-60,115-116`; `Tooltip.test.tsx:10,45` | |
| DRAFT::C0054 (NEW 12.0 rails) | 5471 | VERIFIED | `GameGrid.module.scss:62` `320px 1320px 280px` | |
| DRAFT::C0055 (NEW 13.0 season identity) | 5472 | VERIFIED | `PlayerPickupTable.tsx:283-290,1739`; `PlayerPickupTable.test.ts:12-24` | |

## (c) Top problems (severity order)

1. **P2, user-facing links lost (REGRESSED): SITE C0052 / C0069, 3.7, 5.7.4.** The "Keep exploring" workflow links on Game Grid and the WiGO workflow links were mounted on 2026-07-11, then removed: `pages/wigoCharts.tsx` in `15caa26eac` (2026-08-01) and `pages/game-grid/[mode].tsx` in `f90bb13cd` (2026-09-17). Both commits are in production. `GAME_GRID_SURFACE_LINKS` and `getWigoSurfaceLinks` (`lib/navigation/siteSurfaceLinks.ts:134,157`) now have zero consumers. Team HQ row links on the grid survive, so grid-to-team works, but grid-to-trends/splits/lines and WGO-to-anything links are gone while the master rows still say "mounted and live-verified".
2. **P2, determinism gap (CONTRADICTED): 5.3.2 Team landing.** `teamStatsQueries.ts:838-839` pages `team_underlying_stats_summary` with `ORDER BY game_date DESC, game_id DESC` for league-wide queries. The table PK is `(game_id, team_id, strength, score_state)`, so the two team rows for a game tie and can be skipped or duplicated at a 1000-row page boundary (about 2,600 rows per season). Splits, narrative history, WiGO and coverage scans in the same audit all got total orders. Fix: append `.order("team_id")`.
3. **P2, missing test (CONTRADICTED): POWER C0026 and the "accessible native popovers" clause of 5.3.4.** No unit or e2e test exercises `MetricPopover` (a `<details>/<summary>`), though the checkbox says focused coverage was added.
4. **P3 to P2, superseded features (REGRESSED, owner-acknowledged): LANDING C0011-C0013, C0023-C0025, POWER C0015.** The `/underlying-stats` landing page no longer renders the sustainability/trust, what-matters-next, or market-inefficiency modules (`25c89d795`, in prod; helper code deleted in the uncommitted working tree), and the table defaults to Advanced instead of Simple (`index.tsx:346`). The source file `tasks-underlying-stats-landing-page.md` now carries an uncommitted 2026-10-17 "superseded, do not restore" banner, but the rows remain `[x]` and master 5.3.4 / 5.7.3 still say the dashboard-first composition "remains intact". Chef should reclassify these rows as superseded by `tasks/tasks-underlying-stats-lineupexperts-alignment.md` rather than delivered.
5. **P3, style claim broken (REGRESSED): DRAFT C0023 / C0041, 4.10, 5.7.19.** `PlayerPickupTable.module.scss:1745-1765` (`.yahooContext`, from `f90bb13cd`) uses `rgba(255,255,255,0.16/0.25)` and hex colors, so "exact scoped scan finds zero literal white/black RGBA" is false for Player Pickup.
6. **P3, stale emphasis wording (STALE-EVIDENCE): GAMEGRID C0025, 4.4, 5.7.18.** `fefefe006` (2026-10-09, prod) added thirds-based favorability shading on all four 4WK columns on top of Score top/bottom-ten emphasis; "Score-only emphasis" now describes only the rank emphasis.
7. **P3, secondary determinism note (5.3.1 / 5.3.3 shared landing server).** `playerStatsLandingServer.ts:1219-1221` (REST fallback for `nhl_api_shift_rows`) orders `game_id, period, start_seconds` and omits `shift_id`; many shifts share a start second, so a page boundary could drop or repeat a shift. The direct-PG path (`:1353`) includes `shift_id`. Left VERIFIED for the specific P1/P2 claims.
8. **Documentation gaps:** master 5.3.5 has no evidence text. Counts in 3.7 ("47/47", "12 files/47 tests") and 5.7.18 ("six-file/19-test") are historical.

## (d) UNVERIFIABLE-OFFLINE checks needed

1. `nhl_standings_details`: final 2025-26 snapshot has 32 teams at 82 GP with goal differential and home/road split fields populated, e.g. `select count(*), min(games_played), max(games_played) from nhl_standings_details where date = (select max(date) from nhl_standings_details);` (3.6, SOS C0014).
2. Team landing freshness (5.3.2): `select max(game_date), count(distinct game_id) from team_underlying_stats_summary where strength='allStrengths' and score_state='allScores';`. An uncommitted note in `tasks-prd-team-underlying-stats-landing-page.md` says no scheduled job wrote this table until 2026-10-17 (data stopped at 2026-04-07) and a one-time catch-up was run; confirm production reflects it and that the `update-player-underlying-stats` team rebuild is deployed. The 2026-07-29 "verified" status for 5.3.2 did not mention this staleness.
3. `team_power_ratings_daily` trend repair (SOS C0033): `select date, count(*), count(*) filter (where trend10 <> 0) from team_power_ratings_daily where date >= current_date - 30 group by 1 order by 1;`.
4. Typecheck state for the GameGrid P0/P1 rows (C0036/C0037): `cd web && npx tsc --noEmit`, plus a read-only Vercel deployment-status read for `457435eb` (no new deploy).
5. Live Martone coverage and live smoke claims (3.7, 3.8): read-only production fetch of `/api/v1/underlying-stats/players?...` and a manual browser smoke; not checkable from the repo.
6. Player Pickup 528-result / 1,494-row figures (DRAFT C0055): `select season, count(*) from yahoo_players group by 1;` in Production.
