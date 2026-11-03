# Lane B: does the WiGO page show current data? (2026-11-01)

**Answer: partly.** Source tables are current through 2026-10-31. The two tables behind the centre table, `wigo_career` and `wigo_recent`, are not. The writer runs every day but never reaches about the last quarter of its player list, which is where the league's young players sit. Nothing on the page shows this, because no as-of label exists.

Current season from the data: **20262027**. The regular season opened 2026-09-29, 226 games have been played through 10-31, and there are no preseason rows (B-02, B-03). Finding IDs and ledger lines in `PROD-READ-LEDGER.md` share the `B-NN` prefix. A `B-NN` in a "Verified" line or "Evidence" column, or marked "ledger", is a ledger line; anywhere else it is a finding in this report.

Budget: 24 of 24 production reads run, the original 20 plus 4 TJ approved afterwards (B-01 to B-25; B-17 was logged but not run because it joined `teams`, which is out of scope).

## Findings, worst first

### B-01: P0. The writer stops at about player id 8483787, so 89 current skaters have stale or missing aggregates
`web/pages/api/v1/db/calculate-wigo-stats.ts:236,256`; `web/vercel.json:5-6` (`maxDuration` 240)

- **What happens:** the writer walks 3,906 non-goalie players in id order, one at a time, and flushes every 200 written rows. Today it wrote exactly 1,000 rows between 08:50 and 08:53 UTC, ending at id 8483787. Only 2,953 of the 3,906 players have an id at or below that point.
- **Who is affected:** of 740 skaters who have played this season, 643 were written today. 76 of the other 97 have old rows and 13 have no row at all, all with ids of 8483808 or higher. The remaining 8 are finding B-02.
- **What the user sees:**
  - Connor Bedard (8484144), row from 09-17: STD GP **69** in a table for a season where he has played **8**. It is 2025-26 data presented as STD.
  - Matthew Schaefer: STD GP 82, actual 14. Max Sasson: 66, actual 16. Matthew Wood: 71, actual 14.
  - Macklin Celebrini, row from 10-24: STD GP 9, actual 13. Leo Carlsson: 10, actual 13.
  - Gavin McKenna (16 GP), Ivar Stenberg (15), T.J. Hughes (14), Roman Kantserov (14) and the other 9 missing players: no row, so `fetchPlayerAggregatedStats` returns `[]` and the comparison table is empty. Season production still works, from totals.
- **Why stale dates vary:** stable id ordering landed 10-25 (`1b5c36024`). Before that the order was unstable, so high ids were reached at random. Since then they are not reached at all.
- **The failure is silent:** `cron_job_audit` has **no row for this job since 10-25**, though rows were written today, so these runs leave no audit record and `cron-report` has no outcome from them. The wrapper inserts its row only after the handler returns (`lib/cron/withCronJobAudit.ts:381-421`), so a killed run records nothing.
- **Why it no longer finishes:** in September the job finished in 212 to 252 seconds, reporting "processed 2170 of 3156 players". The list is now 3,906. When the per-player NST reads or checks grew was not traced.
- **Verified:** production read, B-04, B-05, B-06, B-20, B-21, B-24; code. **Inferred, strongly:** that the run is killed by the platform limit. The batch boundary, the 3-minute span and the missing audit rows all fit, and a page cap is ruled out since 2,953 ids were walked. It is not proven: September runs logged up to 252 seconds, above the 240 now configured, and I have no platform log or `cron.job_run_details`.

### B-02: P0. Eight active skaters are rejected on every run because of bad rows in their last 20 games
`calculate-wigo-stats.ts:311-330`

- **Scenario:** one invalid game in a player's last 20 withholds all of that player's writes. Garrett Wilson, Hayden Hodgson, Guillaume Brisebois, Dylan Coghlan, Alex Formenton, Sheldon Dries, Jack Ahcan and Matt Kiersted each have 3 to 15 such rows. Formenton shows STD GP 10, actual 14, frozen at 10-24.
- **It clears only by ageing out:** the player must play enough clean games to push the bad rows out of the window.
- **Likely much wider:** the 10-24 group also holds old low-id players the run should reach today (min id 8448208). Today's run wrote 1,000 of the 2,953 ids it reached, while September runs wrote 69% of their list, so roughly 1,000 players may now be rejected each run. Each one still costs reads, which worsens B-01. This is an estimate; the run's rejected list was never recorded (B-01).
- **Verified:** production read B-05, B-06. The bad and duplicate counts are equal for all eight, which points to null `game_id`, but my query cannot separate null from duplicate. **Not verified:** the response's `rejectedPlayerIds`, because killed runs never record it.

### B-03: P0, continues old B-10. Rows the writer has not reached still hold wrong L-window rates
`wigo_recent` rows dated 09-17 and 09-18

- **Scenario:** 20 of the 33 active skaters with September rows have L5 G/60 more than 2% away from the value their own row implies (`l5_g * 60 / (l5_atoi * l5_gp)`).
- **Today's rows are clean:** 0 wrong of 643. See the old-items table.
- **Verified:** production read, ledger B-10 and B-21. **Not verified:** the size of the error on these rows. The query counted misses over 2% and did not measure a ratio, so I cannot confirm the 60x figure for them. Fixing B-01 rewrites them.

### B-04: P0. Traded players get wrong STD ATOI and every STD rate built on it
`calculate-wigo-stats.ts:463-466,524`

- **Scenario:** Dawson Mercer's STD ATOI is **26.16 min**. `wgo_skater_stats` averages **15.38 min** over the same 14 games, and his L5 ATOI is 15.64. His STD PTS/60 reads **0.98**; on WGO time it is about **1.67**. His row is 70% off, and the page shows it as fact.
- **Scale:** 3 of the 5 two-team skaters written today are more than 15% off. No single-team skater is (ledger B-10).
- **Cause, proven for Mercer:** `nst_seasonal_individual_counts` holds two `strength='all'` rows for him: a stale `N.J` row (GP 10, TOI 151.0) and a cumulative `N.J, WPG` row (GP 14, TOI 215.3). The writer adds both: 366.27 / 14 = **26.16**, exactly the value stored. The correct 215.3 / 14 = 15.38 matches WGO.
- **Same path, same error:** `processNstRecord` also sums ixG, iCF, iHDCF and iSCF from those rows (`calculate-wigo-stats.ts:469-472`), and GF, SF and zone starts from the on-ice table, which has the same two rows (`:473-478`). So those STD values are inflated too. Code plus the row shape; I did not read those columns. The stale-row source is the NST lane: report only.

### B-05: P0. 199 active skaters have STD ATOI of exactly 0, shown as 0:00
`calculate-wigo-stats.ts:524`; `statMetadata.ts:376-385`, `tableUtils.ts:121`

- **Scenario:** Filip Bystedt plays 12:51 a game in WGO and has both games in the NST gamelog, yet `std_atoi` is 0 and his STD per-60s are null. The table shows **0:00** with blank rates. The client's derived fallback also requires ATOI above 0 (`fetchWigoPlayerStats.ts:320`), so it cannot rescue them.
- **Scale:** 199 across all write dates, 145 of them written today. 63 have 10 or more games (ledger B-10, B-21).
- **Cause, proven for Bystedt only:** he has **no** `strength='all'` row for 20262027 in either `nst_seasonal_*` table (ledger B-25), so `toi_all` stays 0. Today's read is after the writer ran, so this is not just a race with `update-nst-current-season` at 08:45. The other 198 were not checked, and why the row is missing is not known. NST lane: report only.

### B-06: P1. Everyone who played last night has blank L5, L10 and L20 TOI and rates, because the writer runs before NST lands
`calculate-wigo-stats.ts:997-999,1156-1160,1188-1189`; `tasks/TASKS/cron-operations/cron-schedule.md:49`

- **Scenario:** the writer runs at 08:50 UTC, and the previous day's NST gamelogs arrive with the 10:05 UTC pipeline. One missing game in a window nulls that window's ATOI, per-60s, ixG, iCF and on-ice values. McDavid today: L5 points 11, but L5 ATOI, G/60, PTS/60 and ixG all blank, though NST now has his 10-31 game.
- **Scale:** **313 of the 313** written skaters who played 10-31 have null L5 ATOI (ledger B-10). The blanks last until the next run, when the next night's players go blank instead. On a night like 10-31, that is about half of the written skaters.
- **Verified:** production read, ledger B-07, B-08, B-10, B-23; code. `cron.job` confirms 08:50 and active. The 10:05 pipeline start is in `web/vercel.json:31-32`; that it carries the NST gamelogs comes from the schedule document.

### B-07: P1. NST gamelogs are missing two whole dates, which blanks L10 and L20 until those games age out
`nst_gamelog_as_counts`; `calculate-wigo-stats.ts:997-999`

- **Scenario:** 2026-10-05 (144 WGO rows) and 2026-10-06 (324 rows) have no NST rows at all, plus one row on 09-29. Metric Game Log charts on NST columns have no points for those games.
- **Scale:** of 643 skaters written today, L10 ATOI is null for 392 and L20 for 515 (345 for L5, 313 of those from B-06). Windows reaching into 2025-26 may have older holes too; I did not separate those.
- **Verified:** production read, ledger B-14, B-10. Mercer and Imama each show 13 NST games against 14 WGO. This is the NST lane: report only.

### B-08: P1. The percentile panel's default view has no current data, and its fallback is a junk cohort
`RateStatPercentiles.tsx:212,281-285`; `fetchWigoPercentiles.ts:141-153,301-323`

- **Data:** `nst_percentile_as_offense` and `_defense` have **0 rows** for 20262027. For 20252026 they have 633 rows with a **max GP of 5**. ES, PP and PK are populated for 20262027.
- **By player, from the code (not rendered by me):**
  - McDavid and Mercer have 10+ GP, so the staleness check falls back to 2025-26 AS. McDavid's row there has GP 3 and Mercer's GP 3. Min GP defaults to 10, so nobody else qualifies and the cohort is that one player. The panel is labelled "2025-26 values and cohort, not 2026-27", but any percentile from it is meaningless.
  - Imama has 10+ GP but no fallback row, and Bystedt has under 10 GP, so both get "No AS data".
- **Ratings too:** see old B-12 in the table below. `overall.as` is null, so Overall averages only ES and ST.
- **Verified:** production read, ledger B-11, B-16; code. **Not found:** the writer of `nst_percentile_*`. My search of `web/pages`, `functions`, `webhooks`, `web/scripts` and `web/lib` found no code that writes it, so it may be database-side.

### B-09: P1. No as-of label anywhere, so all of the above is invisible (continues A-02/B-04)
`hooks/useWigoPlayerDashboard.ts:32-35,164-168`; `fetchWigoPlayerStats.ts:629-639`

The aggregate key and totals fallback now carry the season, which is progress. But `wigo_career` and `wigo_recent` still have no season column, and no WiGO component, hook or fetch helper reads `last_updated` (search returned nothing). See the label table below.

### B-10: P1. 14 skaters carry a stale team and 2 have none, so a traded player gets the old team's branding
`hooks/useWigoPlayerDashboard.ts:209-212`

- **Scenario:** Mercer's `players.team_id` is 1 (NJD), and he last played for WPG, so his page is built on New Jersey branding. Others: St. Ivany, Struble, Hunt, Hallander and nine more.
- **Verified:** production read, ledger B-16, B-18; code. **Not checked:** which other WiGO panels read `team_id`.

### B-11: P1. The Game Score chart is missing Imama's latest games
`components/WiGO/GameScoreLineChart/index.tsx:61`

- **Scenario:** `get_skater_game_scores_for_season` returns 12 games ending 10-25. WGO has 14 ending 10-30. McDavid, Mercer and Bystedt all match WGO.
- **Verified:** production read, ledger B-12, B-08. **Not checked:** the RPC's definition, so the cause is unknown. Passed to lane C.

### B-12: P3. A browser can keep last season's id for up to a day after rollover
`web/pages/api/v1/season.ts:49`; `hooks/useCurrentSeason.ts`; `lib/NHL/server/index.ts:249-266`

- **Scenario:** `/season` sends `max-age=86400`. On rollover, a returning browser may keep the old id and the page would read an empty or stale season until the cache expires.
- **Season flip:** `getCurrentSeason` takes the newest `seasons` row whose `startDate` has passed, and that is opening night (09-29), not preseason (09-19) (ledger B-22). The September rows hold full-season GP (Bedard 69, Schaefer 82), so the writer computed STD from 2025-26 on 09-17 and 09-18, before opening night on 09-29. Aggregates reflect whichever season was current at write time.
- **Verified:** code. **Not observed:** an actual rollover.

## Season resolution

| Question | Result | Evidence |
|---|---|---|
| What the data says | 20262027, games through 10-31 | B-01, B-02, B-03 |
| What the writer's `getCurrentSeason` resolves to | 20262027: newest `seasons` row started 09-29, and today's rows match this season's GP exactly (0 of 643 mismatched) | B-22, B-10 |
| What the page's `currentSeasonId` resolves to | 20262027: same helper, through `/api/v1/season`. No page loaded by me | code; B-22 |
| Off-season pause `79492e495` | Not blocking. The gate is on both routes, and today's timestamps show the jobs ran | `calculate-wigo-stats.ts:1396`, `update-wgo-skaters.ts:2235`, B-05, B-09 |
| Writers in `web/vercel.json` | None of the WiGO writers. They are active pg_cron jobs: 231 `update-wigo-table-stats` 08:50, 9 `update-all-wgo-skaters` 07:30, 14 `update-all-wgo-skater-totals` 07:40, 220 `update-nst-current-season` 08:45 | code; B-23 |

## Freshness per source table

"Row count" is for 20262027 unless noted. Cadence for the WiGO, WGO and NST current-season jobs is confirmed in `cron.job` (ledger B-23). Other cadences come from `cron-schedule.md`.

| Table | Latest | Rows | Writer | Cadence (UTC) | Verdict |
|---|---|---|---|---|---|
| `wgo_skater_stats` | 10-31 | 8,135 (740 skaters, 226 games) | `update-wgo-skaters?action=all` | 07:30 | **Current** |
| `wgo_skater_stats_totals` | updated 11-01 07:40 | 740 | `update-wgo-totals?season=current` | 07:40 | **Current** |
| `wigo_career` | 1,000 rows 11-01, the rest older | 7,828 in total (no season column) | `calculate-wigo-stats` | 08:50 | **Partial**: B-01, B-02, B-04, B-05 |
| `wigo_recent` | 1,000 rows 11-01, the rest older | 2,188 in total (no season column) | `calculate-wigo-stats` | 08:50 | **Partial**: B-01, B-03, B-06 |
| `wgo_team_stats` | 10-31 | 452 (226 x 2) | Not traced | Not traced | **Current** |
| `nst_team_5v5` | 10-31, updated 11-01 09:15 | 452 | `update-nst-team-daily` family (not traced to one job) | 09:15 and others | **Current** |
| `nst_gamelog_as_counts`, `_as_rates` | 10-31 | 7,666 each, 31 dates | 10:05 pipeline | Daily | **Gaps**: 10-05, 10-06 |
| `nst_gamelog_as_counts_oi`, `_as_rates_oi` | 10-31 | 7,486 each, 30 dates | 10:05 pipeline | Daily | **Gaps**: at least 10-05, 10-06 |
| `nst_percentile_es_*` | Max GP 15 (WGO 16) | 739 | Not found | Unknown | **Current or one game behind** |
| `nst_percentile_pp_*`, `_pk_*` | Max GP 15 | 648, 622 | Not found | Unknown | **Current or one game behind** |
| `nst_percentile_as_*` | None | **0** | Not found | Unknown | **Empty**: B-08 |
| `players` | No timestamp read | All 740 present | Not traced | Not traced | **14 stale teams, 2 null**: B-10 |
| `get_skaters_avg_stats` | Window 09-29 to 11-01 | 740; ran without timeout (time not measured) | RPC | Live | **Current** |
| `nst_seasonal_*` (writer input) | Mercer and Bystedt only | Mercer 2 rows; Bystedt 0 | `update-nst-current-season` | 08:45 | **Faulty for those two**: B-04, B-05; table-wide not checked |

## Target players

| | McDavid 8478402 | Imama 8478147 | Bystedt 8483428 | Mercer 8482110 |
|---|---|---|---|---|
| WGO games / pts / last | 14 / 37 / 10-31 | 14 / 0 / 10-30 | 2 / 0 / 10-31 | 14 / 6 / 10-30 |
| Totals GP / pts | 14 / 37 | 14 / 0 | 2 / 0 | 14 / 6 |
| `wigo_career` STD GP / pts | 14 / 37 | 14 / 0 | 2 / 0 | 14 / 6 |
| Career and recent written | 11-01 08:51 | 11-01 08:51 | 11-01 08:53 | 11-01 08:52 |
| WGO avg TOI (min) | 23.48 | 7.65 | 12.85 | 15.38 |
| STD ATOI (min) | 23.48 | 7.65 | **0 (B-05)** | **26.16 (B-04)** |
| STD PTS/60 | 6.75 | 0 | **Null (B-05)** | **0.98; about 1.67 on WGO time (B-04)** |
| STD PPTOI (sec per game) | 231.3 | 2.4 | 84.5 | 58.5 |
| L5 GP / pts | 5 / 11 | 5 / 0 | 2 / 0 | 5 / 2 |
| L5 ATOI | **Null (B-06)** | 7.80 | **Null (B-06)** | 15.64 |
| L5 PTS/60 | **Null (B-06)** | 0 | **Null (B-06)** | 1.53 (correct) |
| L10 / L20 GP | 10 / 20 | 10 / 20 | 2 / 2 | 10 / 20 |
| LY GP / pts | 82 / 138 | 2 / 0 | None (correct, rookie) | 82 / 42 |
| NST games, counts / on-ice | 14 / 14 | **13 / 12** | 2 / 2 | **13 / 13** |
| Game Score games / last | 14 / 10-31 | **12 / 10-25 (B-11)** | 2 / 10-31 | 14 / 10-30 |
| Percentile GP, ES | 14 | 12 | 2 | 13 |
| Percentile GP, AS | **None this season; 3 last season (B-08)** | **None (B-08)** | **None (B-08)** | **None this season; 3 last season (B-08)** |
| `players` team / last WGO team | EDM / EDM | FLA / FLA | SJS / SJS | **NJD / WPG (B-10)** |

All four are in the part of the id range the writer reaches, so they do **not** show B-01. Use Bedard (8484144) or McKenna (8486067) to see it.

Evidence: ledger B-01, B-07, B-08, B-12, B-16, B-18.

## As-of labels

| Label | Location | What it says | What it really reflects | Verdict |
|---|---|---|---|---|
| Comparison table STD, LY and other period rows | `WigoComparisonMatrix.tsx` | No date or season on the values | Whatever season was current when that player's row was last written | **Misleading**: B-01 |
| "*Season* games", selected-stat log | `WigoComparisonMatrix.tsx:211` | `currentSeasonId` | Live read for that season | True |
| "Season production *season*" | `PerGameStatsTable.tsx:155` | Totals season or `currentSeasonId` | Totals, 07:40 today | True; no date |
| "Skaters · *season* · 0–100" | `WigoDashboardSections.tsx:302` | `currentSeasonId` | RPC over the season window | True |
| "*Prior* values and cohort, not *season*" | `RateStatPercentiles.tsx:375` | Fallback season | Fallback season | True, but the cohort is junk for AS: B-08 |
| Ratings help "*20262027* cohorts" | `WigoDashboardSections.tsx:256` | Raw season id | ES, PP and PK only; AS is empty | **Misleading**: B-08 |

Lane D or C should confirm how the matrix period rows render; I read the label code, not the running page.

## Runs and changes needed (all ask-first for TJ; none were run)

1. **Writer change, then one full `calculate-wigo-stats` run.** A plain rerun will not help: it stops at the same place. It needs to finish within the limit, or resume across runs, skip players with no recent games, and de-duplicate traded players' seasonal rows. It should also leave an audit row when cut short. This fixes B-01, B-03 and the writer side of B-04, and needs a separate look for B-02.
2. **Move the 08:50 `update-wigo-table-stats` pg_cron job after the 10:05 pipeline.** This is a production schedule change. It fixes B-06.
3. **NST gamelog gap repair for 2026-10-05 and 2026-10-06, through `/db/runner`.** NST lane. At the documented 20 URLs per day this is about 40 URLs, which is not below the burst limit of fewer than 40, so it must be paced at the `AGENTS.md` limits. Then re-run the writer. It fixes B-07.
4. **Find and run the writer of `nst_percentile_as_*` for 20262027, or stop using AS as the default.** The choice depends on where that writer is. It fixes B-08.
5. **Refresh `players.team_id` for the 16 skaters.** Writer not traced. It fixes B-10.

## Not checked

- **Writer run evidence:** platform logs and `cron.job_run_details` were not read, so the kill in B-01 stays inferred. `nst_seasonal_*` was read for Mercer and Bystedt only, so the scale of B-04 and B-05 rests on `wigo_career`, and their causes on those two players. Further reads need new approval.
- No page was loaded and no route called. Every "user sees" comes from code plus data, not from the running page.
- Bad-row causes in B-02, and the rejected player total.
- LY, 3YA and CA values were compared for the four targets only by inspection. They were not checked against source tables. 5,640 `wigo_career` rows date from 2025-04-14 and were not unit-checked; they were not among the active skaters.
- `wgo_team_stats` per-team completeness beyond the 226 x 2 total.

## Re-verified old items

| Old ID | Status | Evidence |
|---|---|---|
| A-02 / B-04 (no season or as-of context) | **Partly fixed.** Query key and totals fallback now carry the season. Tables still have no season column and no as-of label exists, and the failure is live (B-01, B-09) | Code; B-05, B-06 |
| B-10 (L-window per-60s about 60x small) | **Fixed on rewritten rows, still open on stale ones.** 0 of 643 wrong today, 0 bad ATOI units. Mercer's L5 PTS/60 of 1.5349 equals 2 / (15.6367 x 5 / 60) exactly. 20 of 33 September rows are still wrong by over 2%; size not measured (B-03) | Ledger B-07, B-10, B-21 |
| B-10 (`std_pptoi` wrong) | **Fixed.** Now seconds per game. Max is 328 across written rows, and 0 exceed 600 across all write dates. McDavid: 231 sec, or 3:51 | Ledger B-07, B-21 |
| B-12 (ratings and percentiles use different seasons) | **Still open, now live.** Ratings use 20262027, with AS empty. The percentile panel's default falls back to 2025-26 AS for 10+ GP players with a row there, such as McDavid | Code; ledger B-11, B-16 |
| B-13 (NST rows have no game identity) | **Data clean this season, code still open.** 20262027: no GP above 1, no dates out of range, no duplicate player-dates. 20252026 still has 1,194 multi-game and 1,266 pre-opening rows, plus 2,340 after the regular season (playoffs not separated), but the chart reads the current season only. Index alignment not re-read (lane C) | Ledger B-13; code |
| C-05 (contaminated NST GP) | **Fixed for the current season, open on the fallback path.** 20262027: 0 rows above WGO GP. 20252026: 682 of 941 ES rows above, max 102 against 83. `sanitizePercentileCohortGp` runs on the requested season only; the fallback return at `fetchWigoPercentiles.ts:318-319` skips it, so a fallback to 2025-26 ES or PP would use the bad GP | Ledger B-15, B-11; code |
