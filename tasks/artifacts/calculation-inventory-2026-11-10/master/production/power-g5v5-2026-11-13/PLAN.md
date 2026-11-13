# Team power ratings v4: 5-on-5 goaltending and genuine games only, rebuild plan for TJ

Lane F9, 2026-11-13. Code: `06c8316a4` (5-on-5 goaltending), `820e5cb6d` (landing label) and `d6626b521` (season-total rows excluded), on octoberBranch, not pushed.
- **Code ready, not rebuilt.** Nothing in this plan has run: no route call, no production write.
- Reads were bounded and read-only. `pg_stat_activity` was checked first each time: 1 active query, none long.

## 1. What changes (v4 = two changes; the version string stays `team-power-v4-5v5-goaltending`)
**A. Goaltending component (decision 145), now labelled "5-on-5 goaltending"**
- Per game, the inputs come from one NST 5-on-5 counts row (`nst_team_gamelogs_es_counts`, situation `5v5`): GA, SA, xGA and 5-on-5 TOI (the exposure).
- Per-60 = count × 3600 / 5-on-5 TOI seconds.
- Component = EWMA(5v5 xGA/60) − EWMA(5v5 GA/60) over the team's window, then z-scored across teams → `100 + 15z`.
- **Unknown stays unknown:** if any game in the window has no 5-on-5 row, or the row lacks GA, SA, xGA or a TOI above 0, `goalie_rating` is null. The league baseline uses known teams only. There is no all-situations fallback and no zero-fill.
- 5-on-5 drops empty-net goals **and** power-play/penalty-kill goals and xGA.

**B. Season-total rows are not games (TJ: "Fix in v4, then rebuild")**
- `buildGenuineTeamGames` now counts an NST all-situations row as a game only when `gp = 1`.
- **Why gp = 1:**
  - A team plays at most once per date, so a genuine per-game row has exactly one game played.
  - Every per-game row in the table has gp = 1: 2,534 rows in 2025-26 (10-07 → 04-16) and 618 in 2026-27 (09-29 → 11-12).
  - The only other values are aggregates: 2,400 rows with gp = 82 dated 2026-04-17 → 06-30 (2025-26 season totals, 32 teams × 75 days), and 32 rows with gp = 20–24 dated 2025-10-06.
  - A missing gp proves nothing, so that row is not counted either (unknown, not a game).
- **Effect:**
  - v3 filled every early-season window with up to 25 copies of last season's season-total rates. On 2026-09-29, 22 teams' v3 ratings show `source_through_date` 2026-06-30, a season-total row rather than a game.
  - In v4 a window holds genuine games only: the team's 2026-27 games, because no 2025-26 game falls inside the 150-day lookback.
  - This applies to every component and to trend10, because `teamRatingsTrend.ts` uses the same function.
- **Teams that have not played yet:** a team with no genuine game in the lookback isn't rated. The writer carries its last stored row forward with that row's own version and `source_through_date`, exactly as it does in the offseason.
  - In this range that is 47 team-dates on 09-29 → 10-02. They carry the 09-28 rows (`legacy_unversioned`, `source_through_date` 2026-08-29).
  - Teams rated per date: 10 on 09-29, 15 on 09-30, 25 on 10-01, 31 on 10-02, then all 32.
  - A team-date with no stored prior row would get no row (unknown). None in this range.
- The dead `nst_team_5v5` query (`situation='all'` on a table that only holds `5v5` rows, so it always returned nothing) was removed.

**Unchanged:** the weights, the headline, the GP prior (off/def/pace shrink toward 100 below GP 10), the PP/PK tiers and the table schema. `goalie_rating` can now be null. The issued v3 rows become history: the loop backs them up before it writes (rule 21).

## 2. Empty-net verification (read-only)
Retained games: every 2026-27 goal with an empty net (NHL play-by-play `nhl_api_pbp_events`, `goalie_in_net_id` null, shootouts excluded), 10-01 → 11-12. That is 102 empty-net goals against, in 93 team-games.

| Check (93 team-games) | Result |
|---|---|
| NST all-situations GA = play-by-play total GA (empty-net goals included) | 93 / 93 |
| NST 5-on-5 GA = play-by-play GA with both goalies in and 5 skaters a side (`situation_code` 1551) | 93 / 93 |
| The one empty-net goal at 5 skaters a side (`0551`, conceded by OTT 2026-10-06) is excluded from NST 5-on-5 | yes |
| NST 5-on-5 SA = play-by-play shots on goal at 1551 | 85 exact, 8 off by ±1 (NST vs NHL shot attribution) |
| 5-on-5 TOI below all-situations TOI | 93 / 93 |
| NST 5-on-5 rate table (GA/60, xGA/60) = counts × 3600 / TOI | 93 / 93 (rates rounded to 0.01) |

- **Example:** LAK 2026-11-12 allowed 5 goals, 1 of them into an empty net. NST all-situations shows 5 GA; NST 5-on-5 shows 3 GA on 19 shots, 1.25 xGA in 3,077 s.
- **Coverage, 2026-05-02 → 11-12:** every all-situations row has a complete 5-on-5 row (2,538 / 2,538). The rebuild should produce no unknown goaltending values.
- **Evidence:**
  - `en-goals-reconciliation.csv` and `.sql`;
  - `en-games-shots-toi-reconciliation.csv` and `.sql`.

## 3. Before/after sample (computed locally, never written)
- **Method:**
  - bounded read-only SELECTs (numeric columns only) of the NST team logs, WGO discipline, teams and the stored rows;
  - v3 (`power-ratings.ts` before F9) and v4 (`d6626b521`) run side by side on that data;
  - 6 dates: 09-29, 10-01, 10-05, 10-15, 11-01, 11-12.
- **Harness check:** v3 recomputed locally matches the stored v3 rows to 1e-14 on every date.
- **How much the other components move:** mean / max absolute change in rating points, and the correlation between v3 and v4. On 09-29 and 10-01 only the teams rated in both versions are compared.

| Date | Teams rated v3 → v4 | Offense | Defense | Pace | Finishing | Danger | Special | Discipline | Variance flag | **5v5 goaltending** |
|---|---|---|---|---|---|---|---|---|---|---|
| 09-29 | 32 → 10 | 1.5 / 3.9 | 1.1 / 2.5 | 1.4 / 3.1 | 12.2 / 26.9 | 12.5 / 22.3 | 3.6 / 8.8 | 2.0 / 7.3 | 2 flips | 11.1 / 18.3 |
| 10-01 | 32 → 25 | 1.5 / 4.6 | 1.5 / 6.3 | 1.6 / 7.0 | 8.8 / 20.4 | 11.8 / 26.4 | 3.5 / 8.7 | 0.4 / 4.3 | 8 flips | 8.3 / 22.4 |
| 10-05 | 32 → 32 | 2.1 / 5.1 (r 0.84) | 2.0 / 11.0 (r 0.80) | 3.1 / 9.9 (r 0.49) | 5.9 / 16.8 (r 0.88) | 6.8 / 16.0 (r 0.85) | 1.9 / 5.3 | 0.3 / 3.8 | 8 flips | 8.1 / 23.1 (r 0.76) |
| 10-15 | 32 → 32 | 3.2 / 8.8 (r 0.94) | 2.9 / 12.2 (r 0.94) | 4.2 / 9.9 (r 0.89) | 3.2 / 7.7 (r 0.97) | 4.1 / 11.4 (r 0.94) | 0.7 / 1.9 | 0.0 / 0.3 | 4 flips | 8.2 / 32.9 (r 0.72) |
| 11-01 | 32 → 32 | 1.6 / 5.7 (r 0.99) | 1.6 / 3.9 (r 0.99) | 2.9 / 11.6 (r 0.97) | 1.6 / 3.8 (r 0.99) | 1.6 / 4.3 (r 0.99) | 0.2 / 0.5 | 0.0 / 0.0 | 1 flip | 7.9 / 23.3 (r 0.78) |
| 11-12 | 32 → 32 | 0.7 / 2.1 (r 1.00) | 0.8 / 2.4 (r 1.00) | 1.3 / 3.9 (r 0.99) | 0.8 / 1.7 (r 1.00) | 0.7 / 1.9 (r 1.00) | 0.1 / 0.3 | 0.0 / 0.0 | 1 flip | 6.9 / 22.3 (r 0.81) |

- **Season-total fix:**
  - Offense, defense and pace move little early because the GP prior already shrinks them toward 100 at low GP.
  - Finishing and danger move most early in the season (up to about 27 points on 09-29), because those components have no prior.
  - By 11-12 every non-goaltending component is within 4 points of v3.
- **Goaltending:** the change is mostly the 5-on-5 switch, and it stays large through 11-12. The two biggest risers on 11-12 conceded the most empty-net goals. NSH conceded none and still drops, because 5-on-5 also removes special-teams goals and xGA. That split was not measured per team.

2026-11-12, the largest goaltending movers. ENGA is empty-net goals against this season.

| Team | v3 stored | v4 | Change | ENGA |
|---|---|---|---|---|
| LAK | 90.1 (#25) | 108.3 (#10) | +18.2 | 7 |
| OTT | 95.1 (#19) | 111.9 (#6) | +16.8 | 6 |
| VAN | 69.3 (#32) | 85.3 (#27) | +16.0 | 4 |
| FLA | 97.9 (#14) | 75.6 (#30) | −22.3 | 3 |
| DAL | 89.2 (#26) | 75.0 (#32) | −14.2 | 3 |
| NSH | 122.2 (#3) | 108.7 (#9) | −13.5 | 0 |

Full table (every component, v3 and v4, 32 teams × 6 dates): `sample-before-after.tsv`.

## 4. Readers
- **Changed (label "5-on-5 goaltending", or "5v5 Goalie" where space is tight):**
  - `web/components/forge-command-center/TeamPowerTerminal.tsx`: bar label "5v5 Goalie". `web/styles/ForgeCommandCenter.module.scss` widens the label column from 70 to 84 px to fit it.
  - `web/components/forge-dashboard/TeamPowerCard.tsx`: column header "5v5 Goalie", with an `abbr` title naming 5-on-5 goaltending and the empty-net exclusion.
  - `web/lib/underlying-stats/teamRatingNarrative.ts`: "5-on-5 goaltending is outperforming / lagging behind expected goals against right now."
  - `web/lib/teamRatingsService.ts`: contract comment on `goalieRating`.
- **Landing (`820e5cb6d`, Chef-approved):** `web/pages/underlying-stats/index.tsx`.
  - Header "5v5 Goaltending", with a 5-on-5 tooltip.
  - Popover label "5-on-5 goaltending"; its formula text says empty-net goals are excluded.
  - The popover's GA/60, xGA/60 and save-gap lines were **removed**. They showed stored all-situations values, which include empty-net and special-teams goals: a different scope from the rating above them.
- **Reviewed, unchanged:**
  - `teamLandingDashboard.ts`: the "Goalie-carried" tag and the trust type treat null as average, which gives the same result as leaving the team out.
  - `dashboard/normalizers.ts`, `rankings/teamMatrix.ts`: no display.
  - `forge/command-center` page: passes the value through.
- **Noted for Astra and the model project, not changed (decision 42: there is no production game model):** `featureBuilder.ts` feeds `goalie_rating` into the feature `homeMinusAwayGoalieRating`. After the rebuild it means 5-on-5 goaltending.

## 5. The 45-call plan (needs TJ's approval)
**Preconditions**
- The release containing F9 (`06c8316a4`, `820e5cb6d`, `d6626b521`) is live on fhfhockey.com.
- No other writer is running.
- Start outside the cron windows: 08:00–08:20, 09:25–11:00 (pg_cron 283 writes this table at 10:15) and 11:15–11:40 UTC.

**Calls**
- `GET https://fhfhockey.com/api/v1/db/update-team-power-ratings?date=D`, Bearer `CRON_SECRET`.
- D = 2026-09-29 → 2026-11-12, ascending, one date per call: **45 calls**, sequential, with a 5 s pause.
- With `date` alone the route takes a one-day window: no backfill and no late-arrival expansion.
- The bounds are unchanged by fix B.

**Rows replaced**
- Per call, all 32 rows keyed (`team_abbreviation`, `date`) for D are upserted, every column rewritten. In total, the 1,440 v3 rows for 09-29..11-12 (verified 15:02Z: 1,440 v3, 0 other).
- **1,393 rows become v4:** every team with a genuine game in the lookback (10 + 15 + 25 + 31 on 09-29..10-02, then 32 × 41 dates).
- **47 rows (09-29..10-02) carry the team's 09-28 row** (`legacy_unversioned`, `source_through_date` 2026-08-29) for teams yet to play. They replace v3 values that were computed from season totals. No v3 rows remain in range.
- **2026-11-13:** pg_cron 283 wrote 32 v3 rows at 10:15Z today. Either add call 46 (`--end 2026-11-13`; 32 v4 rows), or leave it to the 11-14 cron, whose late-arrival window (11-13..11-14) rewrites it once the release is live.

**Load**
- About 1–4 s per call (the v3 run this morning), about 6 minutes in total.
- Each call reads about 150 days of NST team logs (5 tables, about 2.5k rows each) plus 60 days of stored ratings, and writes 32 rows.
- No NST, NHL or Yahoo requests.

**Backup**
- Before the first call, the script exports the issued rows in range to `run/issued-rows-<start>_<end>.tsv`. This is a read-only SELECT of about 1,440 numeric rows with no jsonb.
- It also logs the version counts.
- Every run that makes calls also writes `run/pre-run-<UTC>.tsv` just before its first call, so rows changed after the preflight (cron 283 rewrites D-1..D each morning) are on disk too. The first file stays the movement baseline. Preflight results: `PREFLIGHT.md`.

**Resume**
- Each start recomputes the per-date state from the database.
- A date is done when it has 32 rows, v4 rows = teams with a genuine game in its 150-day lookback (computed from `nst_team_gamelogs_as_rates`, gp = 1), every v4 row has a known `goalie_rating`, no v3 row is left, and every other row is exactly the team's 09-28 snapshot: `legacy_unversioned`, source 2026-08-29, and the 17 copied columns equal (decision 150).
- Rerunning the script resumes at the first date that isn't done. The upserts are idempotent.

**Stop rules** (exit code, log in `run/run.jsonl`)
- DB guard before every call: at most 5 active queries, none older than 10 s, no Lock/IO waits, probe under 1.5 s. Up to 3 checks 60 s apart, then stop (3).
- Entering a cron window: stop (4).
- A non-200 status, or a timeout/network error with an uncertain outcome: stop (2). Rerun to resume.
- A response `calculationVersion` other than v4 (the release is not live): stop (7). That call only rewrote its date with the existing definition.
- `processedDays` ≠ 1 or `totalUpserts` ≠ 32: stop (6).
- Readback after each call fails the "done" rule above: stop (6).
- A call over 60 s: stop (5).

**Verification** (read-only, built into the script)
- After each call: the readback above.
- At the end:
  - version counts in range (expect 1,393 v4 + 47 carried `legacy_unversioned`);
  - the non-v4 rows grouped by date, version and source date (expect only the 47 carried rows);
  - rows after the end date (expect only 11-13 as v3, unless call 46 ran);
  - per-column movement against the backup (count changed, max |Δ|), to compare with §3;
  - 2026-11-12 `goalie_rating` and `off_rating` against this sample's v4 values, within 0.05.
- Then, as a smoke test, one cached read of the Power Terminal or the landing.

**Commands** (TJ's terminal, after approval)
```bash
python3 -I tasks/artifacts/calculation-inventory-2026-11-10/master/production/power-g5v5-2026-11-13/power-g5v5-loop.py --preflight
```
```bash
python3 -I tasks/artifacts/calculation-inventory-2026-11-10/master/production/power-g5v5-2026-11-13/power-g5v5-loop.py
```
- `--preflight` runs the guard, writes the backup and prints the 45 dates and expected v4 counts. It makes no route calls.
  - Tested read-only at 15:02Z (1,440 v3 rows, 45 dates, 1,393 expected v4 rows).
  - The final-verification block was tested from a scratch copy with route calls disabled. The test output was not kept in this folder.
- Add `--end 2026-11-13` for call 46.

**After the rebuild**
- pg_cron 283 keeps writing v4, because the version is a code constant.
- Rollback: restore from the backup TSV (separate approval). Alternatively, release v3 code and rerun the loop.

## 6. Notes
- **Teams yet to play:** for 09-29 → 10-02 the writer's existing offseason carry-forward serves a team's 09-28 `legacy_unversioned` row, labelled by its own version and source date (2026-08-29).
  - Decision 150 (TJ, 2026-11-13) keeps this labelled carry-forward: no deletion, no v4 label, no gap-filling. The exact 47 keys, and what the served readers do with them, are in `PREFLIGHT.md`.
