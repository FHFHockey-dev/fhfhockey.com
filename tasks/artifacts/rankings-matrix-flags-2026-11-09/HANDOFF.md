# Rankings matrix flags and goalie N/A: root causes, Codex hand-over, pending approvals

2026-11-09. Claude side session (child of local_ed7b4c08). Diagnosis only: no code edited, nothing run except bounded read-only SELECTs on prod. TJ's decisions (pop-up): **hand the three code fixes to the Codex lane**, **keep the Codex complete-window policy and backfill the data**, **write the NST backfill up for later; run nothing now**.

Baseline: octoberBranch HEAD `483205af5` plus the Codex lane's uncommitted patch in `web/lib/rankings/goalieMatrix.ts`, `goalieMatrix.test.ts`, `teamMatrix.ts` and `teamMatrix.test.ts` (diary `tasks/diaries/2026-11-09-codex-rankings-matrix-integration.md`).

## Root causes

### Shared: the page defaults to last season
`DEFAULT_RANKINGS_FILTERS.season` in `web/lib/rankings/rankingUrlState.ts` is `"20252026"`; 2026-27 has been live since 2026-09-29. Every symptom below is mostly a 2025-26 effect. That file belongs to the superstyle session (local_ed7b4c08's lane), so it is not part of this hand-over. TJ should decide whether the default moves to 20262027.

### Symptom 1: goalie "!" on every cell (real data gap, plus a UI rule that is too broad)
`goalie_stats_unified` is a view over the matview `internal_stats.goalie_stats_unified`, last materialized 2026-11-08 09:05 UTC. For season 20252026 it has 2,940 rows, and 281 of them have no NST 5v5 data:

| Cause | Rows | Goalies | Real? |
|---|---|---|---|
| 2026-04-11..04-16, the last six regular-season days: NST has **no gamelog rows** on those dates in any of the 10 goalie tables | 108 | 63 | Real NST writer gap |
| 2026-12-09 (one row) | 1 | 1 | Real, minor |
| Playoff games 2026-04-18..06-11: WGO stores playoff games under `season_id = 20252026`, and NST gamelogs cover the regular season only | 172 | 25 | Scope bug: playoffs should not be in a regular-season ranking |

Before the Codex patch, any missing row added `partial_nst_5v5_*` to the row's warnings. `GoalieMatrixTable` marks **every** metric cell "!" whenever `row.warnings` is non-empty, even when the warning concerns another metric, and the matrix notice unions all `partial_*` warnings. So the gap reached 63 of the 98 2025-26 goalies, and every one of their cells showed "!". Within the regular-season window, 2026-27 has a single gap row: Matt Murray, 2026-10-10 (see the data defects below).

"Source-pending goalie contracts: Under Pressure" is a static metadata notice (`GOALIE_SOURCE_PENDING_METRIC_CONTRACTS`), not a data fault.

### Symptom 2: goalie N/A from about 00:12 on 11-09 (the Codex patch, intended, applied to the gappy data)
The Codex patch was applied at 00:11:37 UTC (see its diary). It makes a metric `null` for the whole window if **any** selected row lacks the source (`unavailableMetrics`, "complete_window_sources"). The diary says this is intentional. With the April gap and the playoff rows, nearly every 2025-26 goalie loses GSAx, GSAA/60, Rel SV%, HD SV%, xGA/Shot and Value Signal. Really-bad-start rate and steal rate go too, because they need GSAx for each start. SV% survives because WGO is complete. **This is not a regression: the policy is doing what it was written to do, and the data is incomplete.** TJ chose to keep the policy and backfill.

### Symptom 3: team "!" and "~" on every cell (flag rules that fire every time) and a 113 s API
- **"!" Raw context:** every team row's `warnings` always ends with `"raw_contextual_team_style"` (`teamMatrix.ts`, the end of the row `warnings` array). It is a methodology descriptor, already present in `meta.sourceQualityFlags` and `style.descriptorType`, so as a per-row warning it puts "!" on every cell.
- **"~" Stale source:** `TeamMatrixTable` marks style metrics stale when `record.styleSnapshotDate !== record.latestPowerDate`. `styleSnapshotDate` is the team's last game date. The power snapshot for day D is built from games through D-1 (power 2026-11-08 vs style 2026-11-07; at season end, 2026-04-17 vs 2026-04-16), so the two always differ by at least a day. Before the patch the power date was not even season-bounded (2026-11-08 against 2025-26 style data from 2026-04-16, which is the notice TJ saw). The Codex patch fixes the cross-season part, but the "differs by one day" rule still fires on every row.
- **113 s:** `fetchTeamUnitToiRows` reads the latest `team_unit_toi` snapshot. For 2025-26 that snapshot is 2026-11-08, from the full rebuild, and holds **183,484 rows**, fetched in 184 sequential `.range()` pages ordered by `game_date, id`. No index matches that order (`(season_id, snapshot_date, game_id, team_id, unit_type, unit_number)` exists), so each page re-sorts and re-skips the set. 2026-27 holds 34,630 rows (35 pages).

## Hand-over to the Codex lane (TJ: "Hand to Codex lane")
Edit on top of your uncommitted patch. Tests go in the existing `goalieMatrix.test.ts` and `teamMatrix.test.ts`.

1. **Goalie regular-season window.** In `fetchAllGoalieGameRows`, bound `goalie_stats_unified.date` to `seasons.startDate .. seasons.regularSeasonEndDate` for `request.season`, clamped by `asOfDate`. Reuse the validation in `fetchTeamSeasonWindow`, possibly by sharing it. Seasons rows: 20252026 = 2025-10-07..2026-04-17; 20262027 = 2026-09-29..2027-04-10. This drops the 2025-26 playoff rows and the two Stanley Cup Final rows dated 2026-06-14 that are mislabelled `season_id = 20262027` (Carter Hart and Brandon Bussi). `latestAvailableSnapshotDate` should come from the bounded rows. Test: a fixture with a playoff-dated row missing NST keeps the NST metrics non-null and adds no `partial_*` warning.
2. **Team row warnings.** Remove the always-on `"raw_contextual_team_style"` from each row's `warnings`; keep it in `meta.sourceQualityFlags`. Test: a fully sourced team row has `warnings: []`.
3. **Team style staleness.** Flag style as stale only when the team has a regular-season game (from the `gamesById` map you already fetch) dated after its latest style row and before `latestPowerDate`. The UI compares `record.styleSnapshotDate` with `record.latestPowerDate`, and that file belongs to the superstyle lane. Two ways to do it:
   - (a) When style coverage is complete, set `record.styleSnapshotDate = latestPowerDate`, meaning "style current as of the power snapshot". This needs no UI change.
   - (b) Add `record.styleSourceStale: boolean`, and have the superstyle lane switch `TeamMatrixTable` to it.
   Apply the same rule to the meta `sourceWarnings` line `team style source snapshot … differs from team power snapshot …`. Tests: a team whose last game was the day before the power date is not stale; a team missing one played game is stale.
4. **Optional, performance:** page `team_unit_toi` in the index's order (`game_id, team_id, unit_type, unit_number`) or by keyset, or move the aggregation into SQL. That last option needs a migration and TJ's approval.

## Data defects and pending approvals (nothing has been run)

### P1. NST goalie gamelog backfill for 2026-04-11..04-16 (season 20252026) — TJ APPROVED 11-09, BLOCKED: no route mode can do it
**Checked 11-09:** `update-nst-goalies` always takes `fetchCurrentSeason()` (2026-27). A `startDate` before 2026-09-29 is clamped to the season start, `runMode=reverse` only logs a warning and sweeps forward, and the catchup path (`prepareCatchup`/`catchupScope`) is current-season only too. So no query string fills 2025-26 dates. It needs an NST-lane change, for example a bounded past-season `season=` parameter on the route, reviewed and tested, before the approved 60-URL fill can run.
- **Gap:** all 10 `nst_gamelog_goalie_*` tables have no rows on 04-11..04-16, while WGO has 108 goalie-games (31/12/20/19/13/13) from 63 goalies.
- **Bounds:** 6 dates × 10 datasets = **60 NST URLs**. That is over 40, so no burst: space requests at least 21 s apart, about 21 minutes in total, within 40/1m, 80/5m, 100/15m and 180/h. It writes about 1,080 rows (108 × 10) and touches only those 6 dates. One call at a time, `maxUrls` ≤ 6 per call, then a fixed stop.
- **Route:** `GET /api/v1/db/update-nst-goalies`. **Open question for the NST lane (Claude owns NST since TJ's decision of 11-07):** `runMode=incremental` resolves the *current* season (`fetchCurrentSeason`), so `startDate=2026-04-11&maxDays=6` would build 2026-27 URLs. A 2025-26 fill needs `runMode=reverse&startDate=2026-04-16&overwrite=yes&maxDays=6` (to confirm: that it stops after 6 dates and walks backward from 04-16) or a catchup scope. Confirm against the code before any run. The 11-07 data-checks backfill (`tasks/artifacts/data-checks-2026-11-07/RESULTS.md` §6) shows the verification pattern.
- **Then:** refresh `internal_stats.goalie_stats_unified`. It was materialized at 09:05, apparently by a scheduled job; either wait for the next run or get TJ's approval for a manual refresh. Verify with SELECTs that every 2025-26 regular-season WGO row has non-null `nst_5v5_counts_gsaa` except 12-09.

### P2. Wrong NST rows dated 2026-04-17 — TJ approved 11-09; the SQL call was declined at the tool prompt twice, so nothing changed. TJ can run `p2-p3-nst-goalie-fix.sql` in this folder from the Supabase SQL editor
Dry count 11-09: 976 rows (98 in eight tables, 97 in pk_counts and pk_rates), all season totals (max gp 64), and `games` has no game on 04-17.
98 rows in each goalie table (checked in all_counts, 5v5_counts, 5v5_rates and pp_counts) are dated 2026-04-17, a day with no games, and hold **season-cumulative** values (`gp` up to 64, `toi` up to 3,008). They don't join to WGO, so the matrix ignores them, but anything that sums NST gamelogs by date double-counts them. Proposed: delete `date_scraped = '2026-04-17' AND season = 20252026` from the 10 tables after a row-count check, and have the NST lane find out why the regular-season-end date produced a season-range URL (`regularSeasonEndDate = 2026-04-17` in `seasons`).

### P3. NST mapped a game to the wrong Matt Murray (2026-10-10) — TJ approved 11-09; the SQL call was declined at the tool prompt twice, so nothing changed. TJ can run `p2-p3-nst-goalie-fix.sql` in this folder from the Supabase SQL editor
Dry count 11-09: exactly 1 row per table under 8476899/NSH, and 0 under 8483575, so re-keying causes no key clash.
NST's row for NSH on 2026-10-10 is stored under `player_id 8476899` (the veteran Matt Murray), but WGO has `8483575` (the NSH Matt Murray). One row per table. Fix: re-key that row to 8483575 in the 10 tables, and have the NST lane add team and date disambiguation to the goalie name mapping.

### P4. Two Stanley Cup Final rows tagged 20262027 (WGO)
`wgo_goalie_stats` rows dated 2026-06-14 (Hart, team 54; Bussi, team 12) carry `season_id 20262027`. They should be 20252026 (game type 3). Fix 1 hides them from rankings. Correcting the WGO season tag is a separate WGO writer issue; it is logged here, not proposed for a write.

## Follow-ups for other lanes
- **Superstyle (UI):** `GoalieMatrixTable` and `TeamMatrixTable` give every metric cell "!" when `row.warnings` has anything in it. Warnings like `inferred_top_two_adjusted_start_share` or a `partial_*` for a different metric then flag unrelated cells. Proposed: scope "!" to the metrics a warning affects, or show row-level warnings once on the row.
- **Default season:** see "Shared" above.
