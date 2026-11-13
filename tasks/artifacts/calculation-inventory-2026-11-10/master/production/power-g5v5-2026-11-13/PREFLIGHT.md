# Power ratings v4 rebuild: read-only preflight (2026-11-13)

**The rebuild is not approved** (decision 150): this preflight made no route calls and wrote nothing to production. All database reads were bounded, read-only SELECTs (`default_transaction_read_only=on`, 8 s statement timeout), each after a `pg_stat_activity` guard that reported 0 active queries.

## Answers in brief
1. **Backup:** `run/issued-rows-2026-09-29_2026-11-13.tsv` holds all 1,472 rows the 46 calls can overwrite (46 dates × 32 teams, all v3). Each call writes only the date it is called for, and only teams already in the backup. Every run now also snapshots the range just before its first call.
2. **Deployed writer is v4:** the source at `496ab3766` writes `team-power-v4-5v5-goaltending`, and GitHub deployment 7769867793 put that commit into production (success, 16:01:06Z). **This is source-to-commit evidence, not a live call.** From round 4, the runner also confirms the live writer with a no-write probe and dry runs (§6 step 4).
3. **The 47 carried rows:** none of them can be recomputed from valid inputs. Each has only gp = 82 season-total rows in its 150-day lookback. The team's last real game was on 2026-04-09..04-16, 166–174 days earlier. Each row will hold the team's 09-28 rating, labelled `legacy_unversioned`, source 2026-08-29.
4. **Writer code:** a carried row keeps its source row's `calculation_version` and `source_through_date`. Only computed rows get the v4 label. No team in this range would carry forward a v4 label.
5. **Served readers:** none of them reads `calculation_version` or `source_through_date`, so a user cannot tell a carried row from a v4 one. The goalie column is labelled "5v5" even for carried legacy values. §5 lists what is missing (not fixed).
6. **Readback:** fail closed, key by key, against the committed 47-key carry manifest (§6). Expected exceptions: 22 / 17 / 7 / 1 carried rows on 09-29 / 09-30 / 10-01 / 10-02, and none after that.

## 1. Backup and what the loop can overwrite
**Command** (no route calls):
```bash
python3 -I power-g5v5-loop.py --preflight --end 2026-11-13
```
- Run at 16:08:04Z, exit 0, 0 calls. Rerun at 16:13:04Z after the readback change in §6; the backup is not retaken.
- **File:** `run/issued-rows-2026-09-29_2026-11-13.tsv`, 1,472 rows plus a header.
  - All 24 columns (`select *`); sha256 `84d4ac83d69fbf2df5cc38ee85c9f7157e10c732360798bf27139b47ca9d4f8d`.
  - 46 dates × 32 teams, 1,472 unique (team, date) keys.
  - Every row is `team-power-v3-all-team-baseline-prior-after-norm-pooled-st`, including all 47 carried keys from §3.
- **Plan logged:** 46 calls for 09-29 → 11-13; 1,425 v4 rows and 47 carried rows expected; partial dates 09-29: 10, 09-30: 15, 10-01: 25, 10-02: 31.

**Why the backup covers every row a call can overwrite.** Code at `496ab3766`, `web/pages/api/v1/db/update-team-power-ratings.ts`:

*Tables:*
- The handler's only write is one upsert into `team_power_ratings_daily`, keyed on `team_abbreviation, date` (line 275).
- The audit wrapper `withCronJobAudit` inserts one `cron_job_audit` row per call. That table is append-only, so the insert overwrites nothing.
- `withNhlOffSeasonSkip` (`games`, `seasons`), `fetchGameLogs`, `fetchAllRatings` and the special-teams context only read. The off-season check uses today's date, not the `date` parameter. It is in season now, so the route runs.
- `update-team-power-ratings-new` is a no-write stub, and the loop never calls it.

*Dates:*
- With `date=D` alone, the start and end date are both D.
- Auto-backfill runs only when the table is empty; it holds 1,472 rows in range alone.
- The late-arrival window (D-1..D) applies only when no date parameter is given.
- So each call writes date D only.

*Teams:*
- A call writes the computed teams (genuine NST rows in [D-150, D]) plus the carried teams (stored rows in [D-60, D)).
- Check C in `preflight-window-checks.out` finds no team outside the 32 rated teams in either source: NST 05-02..11-13 and stored rows 07-31..11-12.
- Check D shows each date in range already has exactly those 32 rows.
- So every key a call can write is already in the backup, and no call creates a new row.

**Change in this commit: snapshot just before the loop.** The backup is a 16:08Z snapshot, and pg_cron 283 rewrites D-1..D every morning. From 2026-11-14 it rewrites 11-13 with the deployed v4 writer. The script now writes `run/pre-run-<UTC>.tsv` immediately before the first call of every real run. The 16:08Z file stays the baseline for the movement report.

## 2. The deployed writer is v4: source-to-commit evidence, not a live call
**GitHub deployment `7769867793`** (`gh api repos/FHFHockey-dev/fhfhockey.com/deployments/7769867793`):
- sha `496ab37665f1098c496e4273645c897c0b9dbf4a`;
- environment "Production – fhfhockey";
- created 2026-11-13T16:01:05Z by `vercel[bot]`;
- status `success` at 16:01:06Z ("Deployment has completed").

**`git show 496ab3766:web/pages/api/v1/db/update-team-power-ratings.ts`:**
- lines 33–34: `TEAM_POWER_RATING_CALCULATION_VERSION = "team-power-v4-5v5-goaltending"`;
- line 231: computed rows are labelled with it;
- line 289: the response's `calculationVersion` reports it.

**`git show 496ab3766:web/lib/power-ratings.ts`:**
- line 889: `if (log.data_mode !== "all" || log.gp !== 1) return;` (season totals excluded);
- lines 192–199: the 5-on-5 goaltending read from `nst_team_gamelogs_es_counts`.

**Both files are byte-identical to F9's `d6626b521`:** writer blob `cd543a4c…`, library blob `132896b9…`.

**Not checked:** that fhfhockey.com's production alias serves this deployment right now. That needs a live request or the Vercel API. The loop checks it on its first call: any `calculationVersion` other than v4 stops it with code 7. That one call would only have rewritten 09-29 with whatever code is deployed.

## 3. The 47 carried team-dates
**Queries:** `preflight-carried-keys.sql` (output: `preflight-carried-keys.csv`, every column, now and carried) and `preflight-window-checks.sql` (output: `.out`).

**Count per date:**
- 2026-09-29: 22
- 2026-09-30: 17
- 2026-10-01: 7
- 2026-10-02: 1

**Why none can be recomputed:**
- **No genuine game in the lookback.** For every key, every NST all-situations row in [D-150, D] has gp = 82: 57–60 season-total rows dated 2026-05-02..06-30. There is no gp = 1 row.
- **Last game too old.** The team's last genuine game was 2026-04-09..04-16, 166–174 days before D, so outside the writer's 150-day lookback (`TEAM_RATINGS_TREND_LOOKBACK_DAYS`).
- **Carried only until the first game.** The first genuine game is the day after the team's last carried date (09-30..10-03). From that date the team is computed as v4.
- **No other route to a valid rating.** The only way to compute these 47 would be a lookback of 167–175 days or more, reaching April 2026. That would change the definition, so it is not proposed.

**Every key now holds v3 built from season totals:** `source_through_date` 2026-06-30, the date of the last gp = 82 row. That is the bug v4 fixes.

**Carry chain:**
- 2026-09-28 holds 32 rows, all `legacy_unversioned`, source 2026-08-29 (check E).
- Each 09-30 / 10-01 / 10-02 key's previous day is also a key, so the ascending loop carries the 09-28 row through each team's run of carried dates.
- **No team "slides out" in range:** none has a genuine game on exactly D-151 and none after it (check B). So no carried row inherits a v4 label.

**What the writer stores on each key:**
- **Copied from the team's 09-28 row (17 columns):** off, def and pace ratings; xgf60, gf60, sf60, xga60, ga60, sa60 and pace60; finishing, goalie, danger, special and discipline ratings; `variance_flag`; and `trend10`.
  - `trend10` is 0.00: the team has no genuine game, so there is no trend override.
- **Labels:** `calculation_version = legacy_unversioned`, `source_through_date = 2026-08-29`.
- **`pp_tier` / `pk_tier`:** recomputed per date, not carried. The current v3 rows hold null for all 47 keys. The tier code (`teamSpecialTeamsContext.ts`) has not changed since L12 `690693c71`, so null is expected. The readback does not compare these two.
- **`created_at`:** not in the upsert, so it is kept.
- **Discipline:** every current v3 row holds null; the carried rows get the 09-28 value.
- **Goalie:** the carried `goalie_rating` is the legacy all-situations definition (empty-net goals included), not 5-on-5 goaltending.

**The 47 keys** (four of the eight ratings shown; every column is in the CSV):

| # | Team | Date | Now off / def / pace / goalie (v3, source 2026-06-30) | Will store off / def / pace / goalie (`legacy_unversioned`, source 2026-08-29) | NST rows in lookback (all gp = 82) | Lookback starts | Last genuine game | First genuine game |
|---|---|---|---|---|---|---|---|---|
| 1 | ANA | 2026-09-29 | 117.64 / 83.62 / 128.45 / 92.47 | 115.35 / 81.27 / 122.81 / 97.55 | 60 | 2026-05-02 | 2026-04-16 | 2026-10-02 |
| 2 | BUF | 2026-09-29 | 105.60 / 93.76 / 104.83 / 112.56 | 110.05 / 101.81 / 98.87 / 98.64 | 60 | 2026-05-02 | 2026-04-09 | 2026-10-01 |
| 3 | CBJ | 2026-09-29 | 101.39 / 99.47 / 118.13 / 99.73 | 81.58 / 113.50 / 91.61 / 104.03 | 60 | 2026-05-02 | 2026-04-11 | 2026-10-01 |
| 4 | CGY | 2026-09-29 | 86.67 / 87.71 / 113.41 / 106.42 | 82.08 / 75.14 / 110.79 / 95.31 | 60 | 2026-05-02 | 2026-04-16 | 2026-10-01 |
| 5 | COL | 2026-09-29 | 135.05 / 119.09 / 129.64 / 120.93 | 113.34 / 112.39 / 101.59 / 103.75 | 60 | 2026-05-02 | 2026-04-16 | 2026-09-30 |
| 6 | DAL | 2026-09-29 | 98.55 / 115.72 / 65.65 / 106.98 | 86.57 / 117.38 / 53.56 / 105.84 | 60 | 2026-05-02 | 2026-04-11 | 2026-10-02 |
| 7 | DET | 2026-09-29 | 104.69 / 102.97 / 113.15 / 94.15 | 98.47 / 100.40 / 104.71 / 107.20 | 60 | 2026-05-02 | 2026-04-11 | 2026-10-02 |
| 8 | LAK | 2026-09-29 | 97.93 / 115.18 / 109.32 / 94.71 | 104.74 / 113.14 / 121.11 / 85.20 | 60 | 2026-05-02 | 2026-04-16 | 2026-09-30 |
| 9 | MIN | 2026-09-29 | 110.14 / 103.17 / 118.16 / 106.42 | 120.54 / 108.03 / 125.65 / 101.87 | 60 | 2026-05-02 | 2026-04-11 | 2026-10-01 |
| 10 | NJD | 2026-09-29 | 105.70 / 103.09 / 107.88 / 95.26 | 117.49 / 109.30 / 112.57 / 93.34 | 60 | 2026-05-02 | 2026-04-11 | 2026-10-01 |
| 11 | NSH | 2026-09-29 | 99.00 / 91.79 / 100.34 / 94.71 | 98.40 / 96.33 / 103.56 / 103.32 | 60 | 2026-05-02 | 2026-04-16 | 2026-10-01 |
| 12 | NYI | 2026-09-29 | 98.75 / 82.89 / 105.09 / 132.65 | 93.96 / 81.46 / 112.54 / 117.28 | 60 | 2026-05-02 | 2026-04-11 | 2026-09-30 |
| 13 | OTT | 2026-09-29 | 111.17 / 123.18 / 84.89 / 82.43 | 108.67 / 114.68 / 92.32 / 106.89 | 60 | 2026-05-02 | 2026-04-11 | 2026-10-03 |
| 14 | PHI | 2026-09-29 | 89.96 / 120.74 / 72.97 / 90.80 | 104.13 / 116.26 / 87.33 / 87.92 | 60 | 2026-05-02 | 2026-04-11 | 2026-09-30 |
| 15 | PIT | 2026-09-29 | 111.94 / 99.55 / 108.51 / 97.50 | 109.32 / 93.62 / 107.78 / 87.22 | 60 | 2026-05-02 | 2026-04-11 | 2026-09-30 |
| 16 | SEA | 2026-09-29 | 77.40 / 90.49 / 102.31 / 104.19 | 77.39 / 97.19 / 97.17 / 91.04 | 60 | 2026-05-02 | 2026-04-16 | 2026-10-01 |
| 17 | SJS | 2026-09-29 | 83.65 / 88.69 / 90.90 / 80.75 | 88.94 / 107.62 / 83.88 / 76.60 | 60 | 2026-05-02 | 2026-04-16 | 2026-10-01 |
| 18 | STL | 2026-09-29 | 78.36 / 109.39 / 75.20 / 86.33 | 80.47 / 109.20 / 86.90 / 113.26 | 60 | 2026-05-02 | 2026-04-16 | 2026-10-02 |
| 19 | TBL | 2026-09-29 | 115.74 / 113.09 / 90.05 / 102.52 | 113.16 / 113.93 / 94.13 / 91.78 | 60 | 2026-05-02 | 2026-04-11 | 2026-10-01 |
| 20 | UTA | 2026-09-29 | 102.47 / 101.56 / 99.30 / 108.10 | 96.54 / 107.10 / 98.99 / 95.11 | 60 | 2026-05-02 | 2026-04-16 | 2026-10-01 |
| 21 | WPG | 2026-09-29 | 90.25 / 96.83 / 88.12 / 99.73 | 88.74 / 108.50 / 78.73 / 111.03 | 60 | 2026-05-02 | 2026-04-16 | 2026-10-02 |
| 22 | WSH | 2026-09-29 | 111.83 / 91.46 / 113.08 / 119.26 | 94.86 / 88.01 / 106.10 / 111.10 | 60 | 2026-05-02 | 2026-04-11 | 2026-10-02 |
| 23 | ANA | 2026-09-30 | 117.45 / 82.71 / 129.24 / 93.57 | 115.35 / 81.27 / 122.81 / 97.55 | 59 | 2026-05-03 | 2026-04-16 | 2026-10-02 |
| 24 | BUF | 2026-09-30 | 105.32 / 93.49 / 105.15 / 112.36 | 110.05 / 101.81 / 98.87 / 98.64 | 59 | 2026-05-03 | 2026-04-09 | 2026-10-01 |
| 25 | CBJ | 2026-09-30 | 101.45 / 99.54 / 118.71 / 100.36 | 81.58 / 113.50 / 91.61 / 104.03 | 59 | 2026-05-03 | 2026-04-11 | 2026-10-01 |
| 26 | CGY | 2026-09-30 | 87.11 / 87.09 / 113.90 / 106.62 | 82.08 / 75.14 / 110.79 / 95.31 | 59 | 2026-05-03 | 2026-04-16 | 2026-10-01 |
| 27 | DAL | 2026-09-30 | 98.40 / 116.73 / 65.18 / 107.14 | 86.57 / 117.38 / 53.56 / 105.84 | 59 | 2026-05-03 | 2026-04-11 | 2026-10-02 |
| 28 | DET | 2026-09-30 | 104.77 / 103.23 / 113.63 / 95.14 | 98.47 / 100.40 / 104.71 / 107.20 | 59 | 2026-05-03 | 2026-04-11 | 2026-10-02 |
| 29 | MIN | 2026-09-30 | 109.96 / 103.48 / 118.74 / 106.62 | 120.54 / 108.03 / 125.65 / 101.87 | 59 | 2026-05-03 | 2026-04-11 | 2026-10-01 |
| 30 | NJD | 2026-09-30 | 105.87 / 103.36 / 108.25 / 96.18 | 117.49 / 109.30 / 112.57 / 93.34 | 59 | 2026-05-03 | 2026-04-11 | 2026-10-01 |
| 31 | NSH | 2026-09-30 | 99.09 / 91.41 / 100.56 / 95.66 | 98.40 / 96.33 / 103.56 / 103.32 | 59 | 2026-05-03 | 2026-04-16 | 2026-10-01 |
| 32 | OTT | 2026-09-30 | 110.92 / 124.61 / 84.80 / 84.18 | 108.67 / 114.68 / 92.32 / 106.89 | 59 | 2026-05-03 | 2026-04-11 | 2026-10-03 |
| 33 | SEA | 2026-09-30 | 77.78 / 90.03 / 102.57 / 104.53 | 77.39 / 97.19 / 97.17 / 91.04 | 59 | 2026-05-03 | 2026-04-16 | 2026-10-01 |
| 34 | SJS | 2026-09-30 | 83.78 / 88.13 / 90.94 / 82.62 | 88.94 / 107.62 / 83.88 / 76.60 | 59 | 2026-05-03 | 2026-04-16 | 2026-10-01 |
| 35 | STL | 2026-09-30 | 78.67 / 110.05 / 74.92 / 87.83 | 80.47 / 109.20 / 86.90 / 113.26 | 59 | 2026-05-03 | 2026-04-16 | 2026-10-02 |
| 36 | TBL | 2026-09-30 | 115.37 / 113.96 / 90.07 / 102.97 | 113.16 / 113.93 / 94.13 / 91.78 | 59 | 2026-05-03 | 2026-04-11 | 2026-10-01 |
| 37 | UTA | 2026-09-30 | 102.32 / 101.72 / 99.50 / 108.18 | 96.54 / 107.10 / 98.99 / 95.11 | 59 | 2026-05-03 | 2026-04-16 | 2026-10-01 |
| 38 | WPG | 2026-09-30 | 90.49 / 96.73 / 88.10 / 100.36 | 88.74 / 108.50 / 78.73 / 111.03 | 59 | 2026-05-03 | 2026-04-16 | 2026-10-02 |
| 39 | WSH | 2026-09-30 | 111.68 / 91.04 / 113.56 / 118.62 | 94.86 / 88.01 / 106.10 / 111.10 | 59 | 2026-05-03 | 2026-04-11 | 2026-10-02 |
| 40 | ANA | 2026-10-01 | 117.02 / 83.23 / 130.79 / 95.79 | 115.35 / 81.27 / 122.81 / 97.55 | 58 | 2026-05-04 | 2026-04-16 | 2026-10-02 |
| 41 | DAL | 2026-10-01 | 98.26 / 115.89 / 63.65 / 107.29 | 86.57 / 117.38 / 53.56 / 105.84 | 58 | 2026-05-04 | 2026-04-11 | 2026-10-02 |
| 42 | DET | 2026-10-01 | 104.62 / 103.00 / 114.44 / 97.12 | 98.47 / 100.40 / 104.71 / 107.20 | 58 | 2026-05-04 | 2026-04-11 | 2026-10-02 |
| 43 | OTT | 2026-10-01 | 110.55 / 124.05 / 84.22 / 87.84 | 108.67 / 114.68 / 92.32 / 106.89 | 58 | 2026-05-04 | 2026-04-11 | 2026-10-03 |
| 44 | STL | 2026-10-01 | 78.92 / 109.72 / 73.86 / 90.93 | 80.47 / 109.20 / 86.90 / 113.26 | 58 | 2026-05-04 | 2026-04-16 | 2026-10-02 |
| 45 | WPG | 2026-10-01 | 90.58 / 96.63 / 87.67 / 101.54 | 88.74 / 108.50 / 78.73 / 111.03 | 58 | 2026-05-04 | 2026-04-16 | 2026-10-02 |
| 46 | WSH | 2026-10-01 | 111.37 / 90.76 / 114.36 / 117.02 | 94.86 / 88.01 / 106.10 / 111.10 | 58 | 2026-05-04 | 2026-04-11 | 2026-10-02 |
| 47 | OTT | 2026-10-02 | 111.15 / 123.75 / 83.87 / 88.22 | 108.67 / 114.68 / 92.32 / 106.89 | 57 | 2026-05-05 | 2026-04-11 | 2026-10-03 |

**Teams computed on the partial dates:**
- 2026-09-29: BOS, CAR, CHI, EDM, FLA, MTL, NYR, TOR, VAN and VGK (each from its one game on 09-29).
- The 09-30..10-02 lists are in check A.
- Every computed team's games fall in 2026-27; none comes from last season.

**5-on-5 inputs (check G):** all 618 genuine games between 2026-05-02 and 11-13 have a complete 5v5 `es_counts` row (GA, SA, xGA, and TOI above 0). So every v4 row should have a known goalie rating.

## 4. Writer code: a carried row keeps its own version and source date
At `496ab3766`, `update-team-power-ratings.ts`:
- **Lines 228–236:** the v4 label (`TEAM_POWER_RATING_CALCULATION_VERSION`) and `calculated.sourceThroughDate` are set only in the `if (calculated)` branch, i.e. for a team with a genuine game.
- **Lines 237–266:** the carried branch writes `calculation_version: latest.calculation_version ?? "legacy_unversioned"` and `source_through_date: latest.source_through_date ?? latest.date ?? null` (lines 243–246). Rating columns are copied from `latest`.
- **Which row is `latest`:** the team's newest stored row strictly before D. `fetchAllRatings` uses `.lt("date", targetDate)` (`power-ratings.ts` line 849), sorted by date descending, and the first row per team is kept (writer line 201).
- **When a carried row could be labelled v4:** only if that previous row were v4, i.e. the team was computed the day before and then lost its last game from the lookback. Check B shows this never happens in range.
- **The readback enforces it:** every non-v4 row must be `legacy_unversioned`, source 2026-08-29, and equal to the 09-28 row (§6).

## 5. Served readers: can a user tell a carried row from v4? No
| Reader | Gets `calculation_version` / `source_through_date`? | Carried row shown differently? |
|---|---|---|
| `lib/teamRatingsService.ts` `fetchTeamRatings` | No. The select is a fixed column list without them, and the `TeamRating` type has neither. `fetchTeamRatingsAsOf` selects `*`, but `mapRowToTeamRating` drops both. | n/a (data layer) |
| `/api/team-ratings` (`pages/api/team-ratings.ts`) | No. It returns `fetchTeamRatings` unchanged. | n/a |
| `TeamPowerCard.tsx` (via `/api/team-ratings`) | No | No. One snapshot date for the whole card; the goalie column is headed "5v5 Goalie". |
| `TeamPowerTerminal.tsx` (via `/api/team-ratings`) | No | No. The goalie bar is labelled "5v5 Goalie". |
| Landing: `teamLandingRatings.ts` → `pages/underlying-stats/index.tsx` | No. It uses `fetchTeamRatings`; the narrative-history select also leaves both out. | No. The header is "5v5 Goaltending", and the narrative calls the value "5-on-5 goaltending". |
| Trends team-power API (`pages/api/v1/trends/team-power.ts`) | Doesn't read `team_power_ratings_daily`. It reads the NST count tables from season start. | Carried rows never reach it. |

**What is missing (not fixed, as asked):**
1. **Pass the labels through.** Select `calculation_version` and `source_through_date` in `fetchTeamRatings` and the landing history query, add them to `TeamRating`, and return them from `/api/team-ratings`.
2. **Mark non-v4 rows.** Show a visible marker on any row whose version isn't the current v4, such as "carried from 2026-08-29 (pre-v4)", in the card, the terminal and the landing.
3. **Fix the goalie value on non-v4 rows.** Withhold or relabel it: those rows hold the legacy all-situations definition, so "5v5" is wrong for them. The narrative should not call it 5-on-5 goaltending.

**Exposure:**
- Only views of 2026-09-29..10-02 (the date picker or `?date=`). Every later date will have 32 v4 rows.
- Landing narratives also read each team's last 11 stored rows. On landing dates up to about 10-12, those rows include carried legacy rows, unmarked.

## 6. The runner's checks (fail closed; Astra #434 P1 rebuild gate)
Nothing is written before step 6. Steps 1–5 are also the whole `--preflight`.

1. **Cron windows and DB guard** (§9 has the evidence).
   - **Live cron check:** `cron.job` 283 must still be `15 10 * * *` and active, with no run in progress. No other active job may mention the table or route (commands are filtered in the database and never selected). Else stop 4.
   - **Start margin:** the runner refuses to start inside a guard window, or within 15 minutes of one. It checks again right before the pre-run snapshot. Each call is checked against the window too, and the runner stops 4 inside one (resumable).
     - 08:00–08:20 UTC (03:00–03:20 ET)
     - 09:25–11:00 UTC (04:25–06:00 ET)
     - 11:15–11:40 UTC (06:15–06:40 ET)
   - At most 5 active queries, none older than 10 s, no Lock/IO waits; 3 checks 60 s apart, then stop 3.
   - The guard runs again before every request to the route.
2. **Backup, always verified** (never trusted because the file exists).
   - `run/issued-rows-<start>_<end>.tsv` is created only if missing. Every run then checks it against the live table:
     - the same columns;
     - every live (team, date) in range, 32 per date, no duplicates;
     - byte-equal to the live row wherever the live row is still the issued v3 row.
   - Else stop 8.
3. **Carry manifest, key by key.** `carry-manifest.tsv` holds the 47 keys with full-precision values (from `carry-manifest.sql`). Else stop 6, before any request. All three must hold:
   - the live keys with no genuine game in their lookback equal the manifest's keys exactly;
   - every manifest row equals the live 2026-09-28 row: `legacy_unversioned`, source 2026-08-29, and all 17 copied columns within 1e-9;
   - the 09-28 snapshot still has 32 rows.
4. **The live route is bound to v4 without a write.**
   - **Deployment gate, before any request to the writer:**
     - The latest successful GitHub deployment of "Production – fhfhockey" must be a commit in master's history (GitHub compare: `identical` or `ahead`).
     - The writer source at that commit must contain the dry-run code from `2bf3c1d26`: the v4 string, `getRequestFlag(req, "dryRun")`, the no-write branch and `skipAuditWhenNoOp`.
     - Releases are squash-merged, so the gate checks the source rather than whether `2bf3c1d26` is in master's history.
     - Otherwise it stops 7. The old writer, which audits every call, is never reached.
     - These are read-only `gh api` calls; if `gh` fails, the gate fails closed.
     - With a localhost base, the working-tree source is checked instead.
   - **Probe:** `?date=2000-01-01&dryRun=true`. Nothing is stored or logged by NST anywhere near that date (the table starts 2025-10-07), so even a writer without a dry-run mode writes no rating.
     - The response must say `dryRun: true`, v4, `totalUpserts: 0` and `wouldUpsert: 0`, else stop 7.
     - The probe is reached only after the deployment gate passes. On the dry-run writer, a successful dry run leaves no `cron_job_audit` row.
   - **Dry runs** of the first date to write (09-29) and of 2026-11-12. Each must be a one-day, no-write run (`processedDays 1`, `totalUpserts 0`, `wouldUpsert 32`) whose rows pass the per-date check below. 2026-11-12 must also match PLAN §3's local sample (goalie and offense, ±0.05). Else stop 6.
5. **Served API, version-aware.** `GET /api/team-ratings?date=<first date>` is what the card, the terminal and the landing read. It must return 32 rows, each with `calculationVersion` and `sourceThroughDate`. Every served value must equal the database (ratings, trend10, version, source date). Else stop 6.
   - This requires F16's reader change in production. Until then the runner stops here.
6. **Writes**, after approval only.
   - First a fresh `run/pre-run-<UTC>.tsv` snapshot, verified as in step 2 (else stop 8).
   - Then one `?date=D` call per date, ascending. Each response must be 200 (else stop 2) and must say v4 with `dryRun: false` (else stop 7). It must report `processedDays 1` and `totalUpserts 32` (else stop 6).
   - **Readback of D, key by key** (else stop 6):
     - the 32 teams;
     - each manifest key equals its manifest row (label, source date, 17 columns);
     - every other team is v4 with a known goalie rating and `source_through_date` ≤ D;
     - for dry-run dates, every stored row equals its dry-run row exactly.
   - A call over 60 s stops with code 5. A rerun resumes at the first date that fails the per-date check.
7. **Final verification.** Any problem exits 6 and DONE is not printed.
   - Every date passes the per-date check, and the set of non-v4 keys equals the manifest exactly.
   - 2026-11-12 matches the sample.
   - **Served readback:** after waiting 65 s for the API's 60 s cache, `/api/team-ratings` for the start date, 10-02, 11-12 and the end date must equal the database, versions and source dates included.
   - Version counts, later dates and per-column movement against the backup are logged for the record.

**Expected per date:**
| Date | v4 | carried (manifest) |
|---|---|---|
| 09-29 | 10 | 22 |
| 09-30 | 15 | 17 |
| 10-01 | 25 | 7 |
| 10-02 | 31 | 1 |
| 10-03 … 11-13 | 32 | 0 |

**Totals:**
- 1,425 v4 + 47 `legacy_unversioned` with `--end 2026-11-13`; 1,393 + 47 without it.
- **Expected exceptions:** the 47 manifest rows and nothing else.

**Expected stops before approval:**
- 7 at the deployment gate, while production lacks the dry-run writer (tested 16:31Z: deployment `496ab3766`, three markers missing, no request sent).
- 6 at step 5, while production lacks F16's version-aware reader.

## 7. Round 3 commit (`fc9718365`)
- **Added:** this file, the backup, the carried-key queries, and the first carried-row equality check in the loop.
- **Superseded by §6 and §8:** the per-date count rule and the grouped final report.

## 8. Round 4: writer dry run and fail-closed runner (Astra #434 P1, for release #435)
- **Writer, `2bf3c1d26`:** `web/pages/api/v1/db/update-team-power-ratings.ts` accepts `dryRun=true` with `date=YYYY-MM-DD`.
  - It computes that one date and returns `rows` (each with `calculation_version` and `source_through_date`) and `wouldUpsert`. It reports `totalUpserts: 0` and performs no upsert.
  - It never backfills an empty table, and returns 400 for a range or a missing date.
  - A successful dry run writes no `cron_job_audit` row (`skipAuditWhenNoOp`).
  - **Tests:** two new tests prove no write and that a carried row keeps its label. Both fail on the previous writer. The writer file passes 10/10; the 4 related suites pass 90/90. ESLint is clean.
  - **Typecheck:** exit 2, only from F16's uncommitted `lib/dashboard/normalizers.ts`.
- **Runner (this commit):** rewritten to the §6 order.
  - **New:** `carry-manifest.tsv` and `carry-manifest.sql`.
  - **Changed:** stop code 8 (backup); every mismatch now fails, including the sample, which used to be only logged.
  - **Restricted:** `--base http://localhost:PORT` is allowed for `--preflight` only, because a local server shares the production database.
- **Runner tests** (16:25–16:27Z), against an isolated local dev server on port 3108 (`.next-playwright`; your :3000 server untouched). Working tree: `2bf3c1d26` plus F16's uncommitted reader edits. Database reads were read-only. No production request was made.
  - **Full preflight:** `PREFLIGHT_OK`.
    - Backup verified: 1,472 rows, same sha256.
    - Manifest: 47/47 keys match.
    - Probe: `dryRun: true`, v4, 0 upserts.
    - Dry run 09-29: 10 v4 + 22 carried, every carried row exactly equal to the manifest.
    - Dry run 11-12: 32 v4, inside the sample's ±0.05.
    - Served 09-29: labels present and equal to the database.
  - **Fail-closed cases (scratch copies), each stopped as designed:**
    - a fake writer without a dry-run mode → stop 7 at the probe;
    - a backup missing one row → stop 8;
    - one manifest value changed → stop 6 before any request;
    - one sample value changed → stop 6 at the 11-12 dry run, nothing written;
    - a localhost base without `--preflight` → refused.
  - **Local server isolation:**
    - The server was started as `PLAYWRIGHT_ISOLATED_NEXT=1 npx next dev -H 127.0.0.1 -p 3108`, so its build output went to `web/.next-playwright` (last written 16:26Z), not your `.next`.
    - It was stopped by exact PIDs 93078 (`next-server`) and 93077 (`next dev`), and port 3108 is closed.
    - Your :3000 server (PID 88877) was never touched and is still running.
  - **Deployment gate (16:31Z, scratch copies with the probe replaced by an exit and HTTP blocked):**
    - Production base: the gate found deployment `496ab3766` (in master's history) missing three dry-run markers and stopped 7. No request was sent.
    - Localhost base: the working tree passed and reached the disabled probe.
    - The passing GitHub-side path can't be tested until a deployment contains the dry-run writer.
  - **Not tested:** the write loop, the post-write readback and the final served readback. They need writes, which wait for TJ's approval. They reuse the per-date check and served comparison tested above.

## 9. Cron 283 timing and guard windows (read-only, 2026-11-13 16:30Z)
**`cron.job`** (jobid, jobname, schedule and active only; the command column was never selected):

| jobid | jobname | schedule (UTC) | active |
|---|---|---|---|
| 283 | update-team-power-ratings | `15 10 * * *` | yes |

**Next run:** 2026-11-14 10:15 UTC = 05:15 ET. ET is UTC−5 (EST) until 2027-03-14.

**Last 3 runs** (`cron.job_run_details`):

| start | end | status |
|---|---|---|
| 2026-11-13 10:15:00.172 | 10:15:00.200 | succeeded |
| 2026-11-12 10:15:00.240 | 10:15:00.272 | succeeded |
| 2026-11-11 10:15:00.211 | 10:15:00.273 | succeeded |

**What those times measure:**
- pg_cron only queues the HTTP call, which takes about 30 ms. The route's own run is in `cron_job_audit`.
- **Route runs:**
  - 11-13: about 10:15:01.6 → 10:15:04.9 (3.3 s)
  - 11-12: about 10:15:02.9 → 10:15:06.5 (3.5 s)
  - 11-11: about 10:15:00.7 → 10:15:04.3 (3.6 s)
- All three returned HTTP 200.
- The writes cover D-1..D, so 2026-11-14's run rewrites 11-13 and 11-14.

**Other writers of `team_power_ratings_daily`:**
- **Inactive pg_cron jobs** whose command mentions the table, matched by `ilike` in the database:
  - 277 `refresh-team-power-ratings-daily` (`15 10 * * *`);
  - 281 `daily-refresh-team-power-ratings-daily` (`20 8 * * *`).
  - Database function `refresh_team_power_ratings` references the table. Only those inactive jobs are known to call it.
  - The runner stops if any job other than 283 that mentions the table becomes active.
- **Vercel crons:** none of the 33 in `web/vercel.json` (root and `functions/vercel.json` have none) call the writer. The 10:05–10:55 FORGE pipeline and the 10:42–11:33 sustainability crons are other heavy DB work, which is why the guard window is wide.
- **GitHub workflows:** none reference the route or the table.
- **App code:** only the writer route upserts the table (`featureBuilder.ts` writes `game_prediction_feature_snapshots`). `update-team-power-ratings-new` is a no-write stub.
- **No triggers** on the table.

**Guard window around 283:** 09:25–11:00 UTC = 04:25–06:00 ET.
- That is 50 minutes before 10:15 and 45 minutes after the route's last observed finish.
- With the 15-minute start margin, a run must not start between 09:10 and 11:00 UTC (04:10–06:00 ET). Each call is checked again before it is sent.
- A full run takes about 8 minutes (46 calls at about 3.5 s plus a 5 s pause, the pre-write checks and the 65 s served-cache wait). A run started outside the margin finishes before the next window, and a call can never overlap 283.
- **Allowed start times:** from 11:40 UTC to 07:44 UTC the next day (06:40 ET to 02:44 ET). The runner refuses to start inside a window or within 15 minutes of one: 07:45–08:20, 09:10–11:00 and 11:00–11:40 UTC.

**Tests (16:31Z):**
- Window arithmetic: 14/14 cases pass. They cover the 15-minute margin edges at 07:44/07:45, 09:09/09:10 and 11:00, each window's inside and edges, and midnight wrap.
- Live cron check: passed (283 `15 10 * * *` active; no other active job; no run in progress).

## Commands for TJ
Preflight (no writes). It passes only once production serves the dry-run writer and F16's reader:
```bash
python3 -I tasks/artifacts/calculation-inventory-2026-11-10/master/production/power-g5v5-2026-11-13/power-g5v5-loop.py --preflight --end 2026-11-13
```
The rebuild, after approval only. That is 46 writes plus 8 read-only requests (probe, 2 dry runs, 5 served reads), about 8 minutes. Start outside the cron windows.
```bash
python3 -I tasks/artifacts/calculation-inventory-2026-11-10/master/production/power-g5v5-2026-11-13/power-g5v5-loop.py --end 2026-11-13
```
