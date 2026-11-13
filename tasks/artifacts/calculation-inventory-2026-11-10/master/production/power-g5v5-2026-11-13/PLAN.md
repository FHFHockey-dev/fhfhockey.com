# Team power ratings v4: 5-on-5 goaltending (decision 145), rebuild plan for TJ

Lane F9, 2026-11-13. Code: `06c8316a4` on octoberBranch (not pushed). **Code ready, not rebuilt.** Nothing in this plan has run: no route call, no production write. Reads were bounded and read-only (`pg_stat_activity` checked first each time: 1 active query, none long).

## 1. What changes
- **Goaltending component**, now labelled **"5-on-5 goaltending"**:
  - Per game, from one NST 5-on-5 counts row (`nst_team_gamelogs_es_counts`, situation `5v5`): GA, SA, xGA and 5-on-5 TOI (the exposure).
  - Per-60 = count × 3600 / 5-on-5 TOI seconds.
  - Component = EWMA(5v5 xGA/60) − EWMA(5v5 GA/60), on the same window as the other components (latest 25 genuine games in 150 days, half-life 10). Then z-scored across teams → `100 + 15z`.
- **Unknown stays unknown:** if any game in a team's window has no 5-on-5 row, or the row lacks GA, SA, xGA or a TOI above 0, `goalie_rating` is null. The league baseline uses known teams only. There is no fallback to all-situations and no zero-fill.
- **Scope note:** 5-on-5 drops empty-net goals **and** power-play/penalty-kill goals and xGA from the component. Both explain the movers in §3.
- **Unchanged:** offense, defense and pace (they still use all-situations xGA, GA and SA), finishing, danger, special teams, discipline, the variance flag, all weights, the headline, the GP prior and the PP/PK tiers.
- **Stored contract:** same table and columns. `calculation_version` changes to `team-power-v4-5v5-goaltending`, and `goalie_rating` can now be null. The 1,440 issued v3 rows become history: the loop backs them up before it writes (rule 21).

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

- **Example:** LAK 2026-11-12 allowed 5 goals, 1 of them into an empty net. NST all-situations shows 5 GA; NST 5-on-5 shows 3 GA on 19 shots, 1.25 xGA in 3,077 s. The other goal was not at 5-on-5.
- **Coverage, 2026-05-02 → 11-12 (the whole lookback):** every all-situations row has a 5-on-5 row (2,538 / 2,538), and 0 are incomplete. The rebuild should therefore produce no unknown goaltending values.
- **Evidence in this folder:**
  - `en-goals-reconciliation.csv` and `.sql`;
  - `en-games-shots-toi-reconciliation.csv` and `.sql`.

## 3. Before/after sample (computed locally, never written)
- **Method:**
  - bounded read-only SELECTs (numeric columns only) of the NST team logs, WGO discipline, teams and the stored rows for 3 dates;
  - the HEAD (v3) and new (v4) `power-ratings.ts` run side by side on that data.
- **Harness check:** v3 recomputed locally matches the stored v3 rows to 1e-14 (off, def and goalie, all 96 team-dates).
- **Other components:** offense, defense, pace, finishing, danger, special, discipline and the variance flag are identical in v3 and v4 for all 96 team-dates. Only `goalie_rating` moves.

| Date | Corr. v3 vs v4 | Mean abs. change | Largest rank move | v4 unknown |
|---|---|---|---|---|
| 2026-10-15 | 0.745 | 8.5 | 15 places | 0 |
| 2026-11-01 | 0.798 | 7.6 | 17 places | 0 |
| 2026-11-12 | 0.819 | 6.8 | 18 places | 0 |

2026-11-12, the largest movers. ENGA is empty-net goals against this season.

| Team | v3 stored | v4 | Change | ENGA |
|---|---|---|---|---|
| LAK | 90.1 (#25) | 108.6 (#9) | +18.5 | 7 |
| OTT | 95.1 (#19) | 110.9 (#6) | +15.8 | 6 |
| VAN | 69.3 (#32) | 84.1 (#27) | +14.8 | 4 |
| FLA | 97.9 (#14) | 74.6 (#32) | −23.3 | 3 |
| NSH | 122.2 (#3) | 107.8 (#10) | −14.3 | 0 |
| DAL | 89.2 (#26) | 77.1 (#30) | −12.2 | 3 |

The two biggest risers conceded the most empty-net goals. NSH conceded none and still drops 14, so the special-teams goals and xGA leaving the scope also move teams. This split was not measured per team.

Full table (32 teams × 3 dates): `sample-before-after.tsv`.

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
  - `teamLandingDashboard.ts`: the "Goalie-carried" tag and the trust type treat null as average. That gives the same result as leaving the team out.
  - `dashboard/normalizers.ts`, `rankings/teamMatrix.ts`: no display.
  - `forge/command-center` page: passes the value through.
- **Flagged, not changed:** game predictions. `featureBuilder.ts` feeds `goalie_rating` into the baseline model feature `homeMinusAwayGoalieRating` ("Goalie rating edge"). After the rebuild that input means 5-on-5 goaltending. Same scale (mean 100, SD 15), but a different definition from the one the model was fitted on. Issued predictions keep their stored features.

## 5. The 45-call plan (needs TJ's approval)
**Preconditions**
- The release containing F9 is live on fhfhockey.com.
- No other writer is running.
- Start outside the cron windows: 08:00–08:20, 09:25–11:00 (pg_cron 283 writes this table at 10:15) and 11:15–11:40 UTC.

**Calls**
- `GET https://fhfhockey.com/api/v1/db/update-team-power-ratings?date=D`, Bearer `CRON_SECRET`.
- D = 2026-09-29 → 2026-11-12, ascending, one date per call: **45 calls**, sequential, with a 5 s pause.
- With `date` alone the route takes a one-day window: no backfill and no late-arrival expansion.

**Rows replaced**
- Per call, 32 rows keyed (`team_abbreviation`, `date`) for D are upserted. Every column is rewritten and `calculation_version` becomes v4.
- In total, the 1,440 v3 rows for 09-29..11-12 (verified at 14:49Z: 1,440 v3, 0 other).
- Only `goalie_rating` should differ. Other columns could move only if NST data changed since this morning's v3 run.
- **2026-11-13:** pg_cron 283 wrote 32 v3 rows at 10:15Z today. Either add call 46 (`--end 2026-11-13`), or leave it for the 11-14 cron, whose late-arrival window (11-13..11-14) rewrites it as v4 once the release is live.

**Load**
- About 1–4 s per call (the v3 run this morning), about 6 minutes in total.
- Each call reads about 150 days of NST team logs (6 tables, about 2.5k rows each) plus 60 days of stored ratings, and writes 32 rows.
- No NST, NHL or Yahoo requests.

**Backup**
- Before the first call, the script exports the issued rows in range to `run/issued-rows-<start>_<end>.tsv`. This is a read-only SELECT of about 1,440 numeric rows with no jsonb.
- It also logs the version counts.

**Resume**
- Each start recomputes the to-do list from the database: every date in range without 32 v4 rows with a known `goalie_rating`.
- Rerunning the script resumes at the first such date. The upserts are idempotent.

**Stop rules** (exit code, log in `run/run.jsonl`)
- DB guard before every call: at most 5 active queries, none older than 10 s, no Lock/IO waits, probe under 1.5 s. Up to 3 checks 60 s apart, then stop (3).
- Entering a cron window: stop (4).
- A non-200 status, or a timeout/network error with an uncertain outcome: stop (2). Rerun to resume.
- A response `calculationVersion` other than v4 (the release is not live): stop (7). That call only rewrote its date with the existing definition.
- `processedDays` ≠ 1 or `totalUpserts` ≠ 32: stop (6).
- Readback after each call (`count`, v4 count, known-goalie count for D) ≠ 32/32/32: stop (6).
- A call over 60 s: stop (5).

**Verification** (read-only, built into the script)
- After each call: the readback above.
- At the end:
  - version counts in range (expect 1,440 v4);
  - rows after the end date that are still v3 (expect only 11-13, unless call 46 ran);
  - every non-goalie column compared with the backup (expect 0 changes);
  - 2026-11-12 `goalie_rating` against §3's v4 values, within 0.05.
- Then, as a smoke test, one cached read of the Power Terminal or the landing.

**Commands** (TJ's terminal, after approval)
```bash
python3 -I tasks/artifacts/calculation-inventory-2026-11-10/master/production/power-g5v5-2026-11-13/power-g5v5-loop.py --preflight
```
```bash
python3 -I tasks/artifacts/calculation-inventory-2026-11-10/master/production/power-g5v5-2026-11-13/power-g5v5-loop.py
```
- `--preflight` runs the guard, writes the backup and prints the 45 planned dates. It makes no route calls. It was tested read-only at 14:49Z and the test output was deleted.
- Add `--end 2026-11-13` for call 46.

**After the rebuild**
- pg_cron 283 keeps writing v4, because the version is a code constant.
- Rollback: restore from the backup TSV (separate approval). Alternatively, release v3 code and rerun the loop.

## 6. Notes for the Chef (not changed by F9)
- **Season-total rows in the lookback.** `nst_team_gamelogs_as_rates` and `_es_counts` hold 1,920 rows with gp = 82 (2025-26 season totals) dated 2026-05-02..06-30. The 150-day lookback counts them as games, so early-season windows in v3 and v4 include up to 25 copies of last season's season rates. This predates F9 and affects every component equally.
- **Dead `nst_team_5v5` query.** `fetchGameLogs` still queries `nst_team_5v5` with `situation='all'`, but that table only holds `5v5` rows, so the query always returns nothing. Left as is.
