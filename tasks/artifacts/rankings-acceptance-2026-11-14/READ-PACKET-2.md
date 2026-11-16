# Rankings acceptance — follow-up read packet 2 (proposed, NOT executed)

**Purpose:** close the Blocked rows and confirm the local fixes against production data.

**URLs:** `packet2/urls.json`. Each was built with the page's own URL builders and passed the real parsers offline (`packet2/packet.urls.test.ts`, 1/1 pass, no network).

**Rules:**
- Chef is the only reader. Everything runs sequentially, concurrency 1.
- Run one call, check its stop condition, then run the next. No batching; this fixes the Stage C breach.
- No writes, no cron/ETL routes, no audit rows, no NST/provider calls.

## Part A — deployed GETs on https://fhfhockey.com (5)
| # | URL id | Answers | Expected evidence |
|---|---|---|---|
| A1 | P1 skaters, page default (`min_gp=10`) | the page's real default view; the first live sample with the 10 GP floor | 740 ranked rows; P/60 leader has ≥10 GP; time and bytes |
| A2 | P6 goalies 2025-26 | goalie historical population and speed | totalRankedRows vs Part C2; season-bounded snapshot |
| A3 | P8 teams 2025-26 | team historical | 32 teams; power/style dates inside 2025-26 |
| A4 | P10 trending | the request that fires on every skater load; always uses the fallback | time, bytes, source |
| A5 | P11 Metric Explorer (goals_per_60) | metric-explorer parity | rank, percentile and value equal the matrix cell for the same players (d1/c01) |

**Stop:** HTTP 5xx, no response, or any call over 20 s. **Client cap:** 25 s.

## Part B — local fixed code (isolated `next dev :3110`, started with network) against the production DB (6)
| # | Call | Confirms | Pass if |
|---|---|---|---|
| B1 | P2 team=EDM | F13 | source `entity_metric_rankings`, snapshot 11-11, derived-pool warning, composites not null |
| B2 | P3 position=D | F13 | same as B1 for the defense pool |
| B3 | P4 snapshot of unpublished 8473533 | F14 | under 5 s, reason "not in the published cohort" |
| B4 | P7 goalie snapshot of traded 8482076 | R05 stints, F14 for goalies | one row; team = latest stint; starts split per team |
| B5 | P9 team snapshot EDM | F4/F14 for teams | under 5 s; one row |
| B6 | W1 dry build via script | W1 | distinct entity count ≈ 764+ through the current cutoff; coverage verified |

B6 detail:
- Call `buildEntityMetricRankingRows({ season: 20262027, windows: ["season"], strength: "5v5", … })` from a vitest script under `packet2/`, with the real server client. Reads only.
- Do **not** call `upsertEntityMetricRankingRows`.
- Do **not** go through the route: `withCronJobAudit` would write an audit row.
- Record the distinct entity ids, the snapshot date, the coverage blockers, and the wall time.

**Stop:** any call over 30 s, any 5xx, or any DB error.

## Part C — SQL (4; `statement_timeout` 5 s; a timeout is narrowed, never lengthened)
| # | Query | Answers |
|---|---|---|
| C1 | `nst_team_5v5` rows from 2026-09-29 on, grouped by `situation` | whether legacy all-situation rows exist (R06) |
| C2 | distinct goalies with GP>0 in `wgo_goalie_stats`, 2025-26 regular season, by date range | expected count for A2 |
| C3 | `team_unit_toi` distinct `snapshot_date`s for 20262027 vs max `team_power_ratings_daily.date` | R06 unit-TOI cutoff (F9 decision input) |
| C4 | latest `goalie_start_projections.game_date` per goalie active in the last 14 days, as an age distribution | F7 projection-age threshold input |

## Not in this packet
- Republishing (W1 production write).
- Any change to the publish schedule.
- Load testing.
