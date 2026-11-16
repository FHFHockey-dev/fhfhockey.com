# Rankings acceptance matrix — 2026-11-15

**Assessed:** deployed `89da739cb` (#446), Vercel `dpl_8paYEhJ2hjQqDzyGyfw35jvahbAr`. The Rankings code there is byte-identical to #431 (`502a93b4c`) and to local `octoberBranch` before this lane's fixes.

**Observation window:** 2026-11-15, 01:00–02:25 UTC. Every production read was approved by TJ pop-up.

**Evidence kinds:**
- **Deployed:** a production GET.
- **Local + prod DB:** the local reader against the production DB.
- **Offline:** fixtures only.
- **SQL:** independent read-only counts.

**Receipts:**
- `LIVE-SQL-RECEIPT.md`
- `STAGE-C-RECEIPT.md`
- `stage-d/STAGE-D-RECEIPT.md`
- `packet2/RECEIPT.md`
- `packet3-RECEIPT.md`, which includes the parity reads
- `offline-correctness/REPORT.md`
- `perf/REPORT.md`

## Verdict per view (deployed build)
Verdicts use only verified, partial and blocked. "Fixed locally" means the uncommitted candidate below.

| View | Verdict | Deployed evidence | Fixed locally (uncommitted) | To reach verified |
|---|---|---|---|---|
| Metric Explorer (skaters) | **Verified** | 2.25 s; durable 11-11; matches the matrix in value, rank, percentile and peers (582) for all 10 overlapping skaters | — | — (it still inherits the 740-skater publication gap) |
| Skater table/matrix, current, season 5v5 | **Partial**: population short, publication 2 days stale | page default 5.92 s cold (3.32 s for an earlier `min_gp=1` sample; 0.24 s repeat); 740 ranked / 582 qualified at 10 GP; composites v3 | W1: a dry build on prod data gives 769 skaters through 11-13, all 24 omitted included. F11: API default floor = page floor. Default-view parity: values, ranks and percentiles unchanged; deployment rank scope now filled (F13) | commit + deploy, then an approved **republish**, plus a publish schedule (none exists) |
| Skater matrix with team / position filter | **Partial**: wrong source live | team=EDM: rolling fallback (11-13), all composites null, 21 s locally. Position is inferred from code | F13 on prod data: team=EDM and position=D are durable at 11-11, composites present, 4.2–4.8 s | commit + deploy |
| Skater snapshot | **Partial** | in-pool player: works, 9.0 s with team=EDM. Unpublished player: over 30 s, generic message | F14 on prod data: 0.54 s, "not in the published cohort". The page-default snapshot equals its table row | commit + deploy |
| Skater comparison | **Partial** | team=EDM works; off-team subject explicitly unavailable; 10.6 s locally; values agree with matrix and snapshot | F1 offline (composite ranks independent of the confidence filter) | commit + deploy |
| Skater windows/strengths not published (e.g. last10, all strengths) | **Partial**: slow, horizon-limited | fallback: 736 ranked / 712 qualified, no composites, 15.3 s locally | none | publishing more contexts (R02) and a latest-per-player relation (F3: schema/rolling-owner work) |
| Skater historical 2025-26 | **Partial**: population short | durable 04-16, 776 published vs **up to** 940 skaters with matched rolling rows (upper bound; WGO count timed out; cause inferred to be the same writer horizon) | W1 code (only the 2026-27 season window was dry-built) | historical republish approval |
| Goalie matrix, current | **Partial** | 76 of 76 goalies (SQL-verified), 1.27 s, snapshot 11-13. HD SV% can rank on one high-danger shot | F5, F6, F7 offline. Fixed-code parity on prod data: 0 differences for the top 10 | commit + deploy; F8 exposure floors (methodology decision) |
| Goalie snapshot, current | **Partial**: not sampled deployed | — | prod data: traded goalie 8482076 gets pooled performance and latest-team workload, with explicit notes, 1.20 s | deploy, then one deployed sample |
| Goalie historical 2025-26 | **Blocked: upstream data** | 0 rows. All 2,768 WGO goalie rows for 2025-26 lack `game_id`, and the reader deliberately excludes them (98 goalies expected) | — | `game_id` backfill on `wgo_goalie_stats` 2025-26 (production write; needs TJ) |
| Team matrix, current | **Partial**: slow | 32 of 32, **11.28 s**; power 11-14, style 11-12/13 | F15 on prod data: identical unit usage and team order, 2.38 s locally. F9 cap for in-progress seasons | commit + deploy |
| Team snapshot, current | **Partial**: slow | not sampled deployed | prod data: one build, 8.84 s before F15 | deploy, then one deployed sample |
| Team historical 2025-26 | **Partial**: HTTP 500 live | **500**: `team_unit_toi` read hits the DB statement timeout (Vercel log) | F15 on prod data: 200 in 2.53 s, 32 teams. F9 amendment keeps the finished season's unit TOI (offline). Style shows 0 games: NST 5v5 coverage 66/82, and style requires every game (source gap) | commit + deploy; NST 2025-26 team backfill for style |
| Trending | **Partial**: slow | **19.86 s**, always the rolling fallback, fires on every skater page load | none | R08 read model, or load trending only when visible |

No view is verified end to end except Metric Explorer, and only within the 740-skater publication. Population is SQL-verified for 2026-27 goalies (76) and teams (32). The 2026-27 skater population is verified **short by exactly 24** (independent WGO count 764 vs 740 published); 2025-26 is short by up to 164.

## Population detail
| View | Expected (independent) | Returned | Duplicates | Missing / why |
|---|---|---|---|---|
| Skaters 2026-27 season 5v5 (through 11-11) | 764 distinct WGO skaters | 740 | none in DB (reader `totalRankedRows` = DB distinct; pages not enumerated, `page_size` max 50) | 24, all last played ≤10-11 with valid rolling rows. The rankings writer used the 30-date interactive horizon (`entityMetricRankingWriter.ts:232`). **Writer defect**, fixed locally (W1) |
| Skaters 2025-26 season 5v5 | up to 940 (matched rolling rows) | 776 | none | up to 164; cause inferred to be the same |
| Goalies 2026-27 | 76 with GP>0 (75 with a start); 1 multi-team | 76 | — | match |
| Goalies 2025-26 | 98 | 0 | — | upstream: no `game_id` on any 2025-26 WGO goalie row |
| Teams 2026-27 / 2025-26 | 32 | 32 (2025-26 only with the fix) | — | match |

## Sources (latest event date, 2026-11-15)
- **Through 11-13:** WGO skater, goalie and team stats; `goalie_stats_unified`; rolling 5v5 and all-strength; `nst_team_5v5` (5v5 rows only, 622 = 311 games × 2).
- **`team_unit_toi`:** games through 11-12, snapshot 11-13. Snapshot dates are not strict event cutoffs, because the nightly job appends games.
- **Power ratings:** 11-14.
- **Durable skater rankings and composites:** snapshot **11-11**, written 11-13 07:06 UTC. That is 2 days and 13 games behind the sources.
- **Publication contents:** 5v5 all-skaters only. Rankings cover 4 windows; composites v3 cover the season window only. A stale v1 composite generation (11-07, 732 players) is still stored.
- **Publish schedule:** none. Neither publish route is in `web/vercel.json` or the repo SQL, and the 11-08 audit found no `pg_cron` entry. Not re-checked live.

## Timings (single samples, not percentiles)
| Route | Deployed | Local + prod DB, deployed code | Local + prod DB, fixed code |
|---|---|---|---|
| Skater matrix, page default (10 rows) | 3.32–5.92 s cold, 0.24 s repeat (repeat speed-up inferred to be the in-process cache). The 11-08 audit measured 19.14 s | 4.10 s (50 rows) | 4.67 s |
| Skater matrix team=EDM | — | 21.05 s | 4.24 s |
| Skater matrix position=D | — | — | 4.78 s |
| Skater matrix last10, all strengths (fallback) | — | 15.31 s | — |
| Snapshot of an unpublished skater | — | over 30 s (timeout) | 0.54 s |
| Skater snapshot, page default | — | — | 3.22 s |
| Snapshot team=EDM | 9.00 s | 14.88 s | — |
| Comparison, 2 ids, team=EDM | — | 10.55 s | — |
| Goalies, current | 1.27 s | — | 1.07 s |
| Goalies 2025-26 | 1.59 s (0 rows) | — | — |
| Teams, current | 11.28 s | — | 2.38 s |
| Teams 2025-26 | 500 after 8.44 s | — | 2.53 s |
| Trending | 19.86 s | — | — |
| Metric Explorer | 2.25 s | — | — |
| W1 dry build (season window) | — | — | 19.7 s (writer, not interactive) |

Response size is about 211 KB per 10 skater rows. Local timings exclude Vercel cold start and are not directly comparable with deployed ones.

Where the time goes (code, offline bench and live logs):
- query paging and transfer, not compute;
- snapshot and comparison rebuild the whole matrix for every page they scan (fixed by F14);
- the team view's `team_unit_toi` reads use offset paging over the whole snapshot (fixed by F15, which uses the existing `idx_team_unit_toi_latest`; the EXPLAIN plan uses it);
- trending always uses the fallback;
- the client sends a request per keystroke with no abort (R09, open).

## Cross-view agreement
- **Matrix, snapshot and comparison agree** for McDavid in the team=EDM context on prod data. Deployed snapshot d5 is byte-identical to the local c07 apart from timestamps.
- **Deployed matrix rows match the local reader exactly** (d1 vs c01).
- **Metric Explorer matches the matrix:** 10 of 10 overlapping skaters.
- **The fixed code changes no values, ranks or percentiles** in the default skater or goalie views. The only change: the default skater view now fills the deployment rank scope (F13), which deployed returned as null.
- **BEAST tier:** null means no tier gate was met, by design. The gates have no sample floor, so a 1-GP skater can hold a tier. This belongs with R07.

## Fix candidate (local, uncommitted)
Eleven fixes, each test-first:

| Fix | Change |
|---|---|
| F14 | One-build snapshot with an explicit "not in the published cohort" |
| F13 | Team, position and EV-deployment pools derived from the publication, with league-scope composites |
| F1 | Composite ranks no longer depend on the confidence filter |
| F4 | Team snapshot and comparison accept an id, abbreviation or name |
| F5 | An invalid goalie team token returns 400 |
| F6 | Goalie Start Share follows the selected window |
| W1 | The entity writer publishes the full WGO-anchored season and refuses when coverage is unverified |
| F11 | When the API omits `min_gp`, the page's window floor applies (opt-in through `window`; writers send an explicit `min_gp`, so they are unaffected) |
| F7 | Goalie start projections older than 7 days become context only |
| F9 | Unit TOI is capped at the power date for in-progress seasons; finished seasons keep their latest snapshot (TJ confirmed) |
| F15 | The `team_unit_toi` read is filtered to the units the view uses |

**Files (22):**
- 10 source files in `web/lib/rankings/`;
- 5 modified tests;
- 7 new files in `web/lib/rankings/__acceptance__/`, holding regression tests only.

The exact list is in `offline-correctness/REPORT.md` under "Release file set". Patch: `offline-correctness/FIXES.patch`. Lease: `CLAUDE-LEASES.json`, lane RANKINGS-ACCEPTANCE.

**Checks run by Chef:**
- 49 test files, 515 passing;
- scoped eslint, exit 0;
- full `npm run typecheck -- --incremental false`, exit 0;
- no runtime import cycle.

The six open-defect reproductions live outside `web/` in `offline-correctness/repros/` and pass as reproductions.

**Not verified:**
- F1, F4, F5, F6, F7, F11 and the F9 amendment on prod data;
- browser rendering of the new warnings and labels;
- W1 for the last 5/10/20 windows on real data.

## Open (not fixed in this lane)
**Needs TJ:**
- republish (W1) and a publish schedule;
- the 2025-26 goalie `game_id` backfill;
- the 2025-26 NST team backfill;
- F8, per-metric goalie exposure floors;
- the Fantasy preset's 1 GP floor;
- release of this candidate.

**Engineering:**
- trending speed (R08 or deferral);
- R09 request churn;
- F2, per-column durable vs fallback;
- F3, the interactive population horizon;
- F10, static June metadata and WAR season;
- F12, snapshot errors swallowed in `rankings.tsx`;
- the stale v1 composite generation.

**Other lanes:**
- Astra AFULL-RANK12-01..03 (a note is posted);
- `tasks/MASTER-LIST.md:99` still says Rankings is paused (report only).

## Post-release status (2026-11-15)
- **Release:** #447, merged as `baeb5df7f`. The smoke check passed: `RELEASE-PLAN.md`.
- **Republish (current season):** rankings and composites are both at 11-13. 769 skaters are served, including all 24 previously omitted (`republish/RECEIPT.md`).
- **Updated verdicts:**
  - Skater table/matrix, current: population **verified** (769 published = 769 source cohort through 11-13; 24/24 served).
  - Team/position filters and the unpublished-player snapshot: fixed live.
  - 2025-26 teams: 200 (was 500).
- **Still partial:**
  - trending speed;
  - 2025-26 skaters (no historical republish);
  - 2025-26 goalies (blocked on the `game_id` backfill);
  - freshness depends on manual publishing.
- **New constraint:** rankings and composites must be republished at the same `as_of_date`. The reader joins them on the exact date.
- **TJ requirement (2026-11-15) for the next publish:** keep the last complete rankings + composites pair visible until both tables are ready at the new cutoff. The reader still joins on the exact date, so until a paired-snapshot reader ships, both writers must be pinned to the same `as_of_date` and published back to back.
