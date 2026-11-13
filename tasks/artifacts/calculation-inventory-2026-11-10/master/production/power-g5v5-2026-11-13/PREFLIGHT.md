# Power ratings v4 rebuild: read-only preflight (2026-11-13)

**The rebuild is not approved** (decision 150): this preflight made no route calls and wrote nothing to production. All database reads were bounded, read-only SELECTs (`default_transaction_read_only=on`, 8 s statement timeout), each after a `pg_stat_activity` guard that reported 0 active queries.

## Answers in brief
1. **Backup:** `run/issued-rows-2026-09-29_2026-11-13.tsv` holds all 1,472 rows the 46 calls can overwrite (46 dates × 32 teams, all v3). Each call writes only the date it is called for, and only teams already in the backup. Every run now also snapshots the range just before its first call.
2. **Deployed writer is v4:** the source at `496ab3766` writes `team-power-v4-5v5-goaltending`, and GitHub deployment 7769867793 put that commit into production (success, 16:01:06Z). **This is source-to-commit evidence, not a live call.**
3. **The 47 carried rows:** none of them can be recomputed from valid inputs. Each has only gp = 82 season-total rows in its 150-day lookback. The team's last real game was on 2026-04-09..04-16, 166–174 days earlier. Each row will hold the team's 09-28 rating, labelled `legacy_unversioned`, source 2026-08-29.
4. **Writer code:** a carried row keeps its source row's `calculation_version` and `source_through_date`. Only computed rows get the v4 label. No team in this range would carry forward a v4 label.
5. **Served readers:** none of them reads `calculation_version` or `source_through_date`, so a user cannot tell a carried row from a v4 one. The goalie column is labelled "5v5" even for carried legacy values. §5 lists what is missing (not fixed).
6. **Readback:** the loop now also requires every non-v4 row to equal its 09-28 snapshot exactly. Expected exceptions: 22 / 17 / 7 / 1 carried rows on 09-29 / 09-30 / 10-01 / 10-02, and none after that.

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

## 6. Readback checks the loop runs, and expected exceptions
**Before every call:**
- **Not in a cron window** (08:00–08:20, 09:25–11:00, 11:15–11:40 UTC); else stop 4.
- **DB guard:** at most 5 active queries, none older than 10 s, no Lock/IO waits, probe under 1.5 s. Up to 3 checks 60 s apart, then stop 3.

**After every call (date D):**
- **Response checks:**
  - HTTP status must be 200, else stop 2.
  - `calculationVersion` must be `team-power-v4-5v5-goaltending`, else stop 7.
  - `processedDays` must be 1 and `totalUpserts` 32, else stop 6.
- **Database readback** (`state_by_date(D, D)`), else stop 6. All of these must hold:
  - 32 rows;
  - v4 rows = teams with a gp = 1 row in [D-150, D], and the same as the plan's count;
  - every v4 row has a known `goalie_rating`;
  - no v3 row is left;
  - **new in this commit:** every remaining row is exactly the team's 09-28 snapshot: `legacy_unversioned`, source 2026-08-29, and all 17 copied columns within 1e-9 (both null counts as equal).
- **Duration:** a call over 60 s stops with code 5.
- **Resume:** each start recomputes the same per-date rule from the database and resumes at the first date that fails it.

**Expected per date:**
| Date | v4 | carried (09-28 snapshot) |
|---|---|---|
| 09-29 | 10 | 22 |
| 09-30 | 15 | 17 |
| 10-01 | 25 | 7 |
| 10-02 | 31 | 1 |
| 10-03 … 11-13 | 32 | 0 |

**At the end** (read-only, logged as `final`):
- Version counts in range: **1,425 v4 + 47 `legacy_unversioned`** with `--end 2026-11-13` (1,393 + 47 without it).
- `expected_carried_rows` = 47, and `dates_not_done` must be empty.
- The non-v4 rows grouped by date, version and source. Expected exactly: 09-29 22, 09-30 17, 10-01 7 and 10-02 1, all `legacy_unversioned` / 2026-08-29.
- Rows after the end date: from 11-14, whatever cron 283 has written (v4).
- Per-column movement against the 16:08Z backup: compare with PLAN §3.
  - Expected: on the 47 carried keys every rating moves from the season-total v3 values to the 09-28 values, and discipline goes from null to the 09-28 value.
- 2026-11-12 `goalie_rating` and `off_rating` against PLAN §3's local sample, within 0.05.
  - Mismatches are logged, not a stop. They can come from NST rows that arrived after the sample.

**Expected exceptions:**
- **The 47 carried rows,** and nothing else.
- **A possible stop 7** if production isn't serving `496ab3766` when the loop starts.
- **A possible stop 6** if NST or stored data changes during the run (for example a late NST row giving a team its first game earlier).

## 7. What changed in this commit
- **`power-g5v5-loop.py`:**
  - the carried-row equality check added to the per-date "done" rule and the readback;
  - `run/pre-run-<UTC>.tsv` snapshot before the first call;
  - `expected_carried_rows` and `dates_not_done` in the plan and final logs.
- **Tests run:**
  - `py_compile`.
  - Preflight of 2026-09-28 alone, from a scratch copy: 32 exact carried rows, 0 calls. The new rule accepts an exact snapshot.
  - The real preflight above: 46 calls; 1,425 v4 and 47 carried rows expected.
  - **Not tested:** the post-call readback on actual v4 rows. None exist until the loop runs.
- **PLAN.md:** pointers to this file; §5 backup, resume and done-rule text; the §6 note now cites decision 150.
- **New files:** `preflight-carried-keys.sql/.csv`, `preflight-window-checks.sql/.out`, and `run/issued-rows-2026-09-29_2026-11-13.tsv` (the backup).
  - The preflight log `run/run.jsonl` stays local because the repository ignores `*.jsonl` under `tasks/artifacts`. Its events are quoted in §1.

## Commands for TJ, after approval only
```bash
python3 -I tasks/artifacts/calculation-inventory-2026-11-10/master/production/power-g5v5-2026-11-13/power-g5v5-loop.py --end 2026-11-13
```
- 46 calls, about 6 minutes.
- Start outside the cron windows.
- The script reuses this backup and writes a fresh pre-run snapshot.
