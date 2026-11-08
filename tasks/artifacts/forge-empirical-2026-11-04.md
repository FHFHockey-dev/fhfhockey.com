# FORGE empirical pass 2 — local read-only diagnostic

Date: 2026-11-04. Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, base `152ee53b766d656d21154aacfe53ff2491a1bccf`. Uncommitted changes only. No model promotion, goalie-sampler activation, production record changes, push, deployment, migrations, ingestion jobs or provider downloads.

## Implemented slice and contract

`web/scripts/forge-ledger-evaluate.ts` is an offline adapter for the existing served-ledger export. It reuses `scorePairedLedger` from `web/lib/player-forecasts/servedForecastLedger.ts`; it does not fit a new model, invent distributions, or stitch daily forecasts into cumulative horizons. Existing tests were extended in `servedForecastLedger.test.ts`.

Input schema `forge-served-ledger-export-v1` contains `exportedAt`, unique `columns`, and positional `rows`. Output version is `forge-retained-ledger-diagnostic-v1`; SHA256 pins the exact bytes. The CLI reads at most 16 MiB/10,000 rows, has no database/network imports, and creates output exclusively (`wx`). It requires valid player/game/team identities, method/source watermarks and cutoff ≤ issue ≤ initial retention < scheduled start, with retention before evaluation. Missing or immature settlement, invalid observed counts and incoherent point expectations are quarantined in the report, never rewritten. Prediction accounting allows the maximum .00015 discrepancy from three independently rounded four-decimal values. All retained rows remain in population accounting; the reused paired count scorer deliberately reports **dressed-only** results. This is not unconditional forecast accuracy.

H1 is a one-game, retained-point-forecast diagnostic. H10/H20 explicitly return unavailable: the ledger has no frozen cumulative window identity. It is invalid to infer such windows from repeated daily forecasts, multiply one-game means by H, or construct trajectories from marginals. The separate pass-1 trajectory evaluator remains synthetic/explicit-input-only and unused for these empirical rows. Existing FORGE/BLSH/RSO/Trade Analyzer contracts are unchanged.

## Observed inventory and provenance

Read-only Supabase project `fyhftlxokyjtpndbkfse` was inspected through its connector. No application endpoints were invoked. There were 22 SQL attempts: 21 succeeded; one full-row export failed with `Transport closed` and was replaced by compact per-date exports. Two project-list reads occurred across the context boundary. SQL only selected metadata, retained forecast/settlement rows, and aggregated source dates. No protected historical numeric outcome block was opened.

- Legacy skater projections: **47,477 H1 rows / 255 runs**, dates 2025-10-07 through 2026-11-09; **70 H5 rows / one run** on 2026-10-21; **zero H10/H20**. The legacy horizon field is not proof of a cumulative frozen trajectory.
- Runs: **461 succeeded**, of which **128 were created after their target date**. Also 23 failed runs. Historical `as_of_date` alone is not genuine issuance evidence.
- Versioned game revisions: **one**, issued September 28; final-pregame pointers: **zero**; roster events: **zero**. Thus the newer schema's existence is not evidence of historical population/forecast coverage.
- Served ledger through November 4: 1,814 exact bridge, 637 reaimed bridge, and 2,953 rows for each naive control. All initial retention clocks precede scheduled start. The export excludes November 4's 398 not-yet-settled baseline rows.
- The eight retained served dates evaluated are October 22, 23, 24, 26, 30, 31 and November 2, 3. They contain **7,959 source rows / 2,898 distinct retained player-games**. These dates are not continuous coverage. No native or market forecast source is present.
- Older artifact directories in the canonical checkout are empty. Recovery archive manifests contain FORGE logs and code snapshots, not a recoverable qualified cumulative forecast cohort in the inspected paths. Prior research pilot descriptions are not treated as retained forecast evidence.

Historical strength data have 23,524 player-game rows for season-start 2025 (games October 1–June 14), first retained December 26, 2025, last rewritten July 21, 2026; season-start 2026 has 8,804 rows (September 19–November 2), first retained October 6, last rewritten November 4. Counts include preseason/postseason; no regular-season benchmark was inferred from these aggregates. Current NHL payload heads have 1,676 boxscores, 1,774 landings, 1,702 play-by-play and 1,697 shiftchart entries; earliest current fetched clocks are March 30/April 2, 2026. A current head is not an inventory of all historical revisions or proof of pre-origin availability.

The general provenance table has 43 injury, 30 lineup, 18 news and 32 goalie-start rows, all observed in April 2026; it does not establish October coverage. Game-prediction feature/odds/output rows belong to another contract and cannot substitute for player-level FORGE inputs. A deeper raw-version join and intended-use receipt are still needed before admitting a historical reconstruction. No commercial source rights were inferred from access to stored data.

## Measured H1 comparisons

All values below are MAE on the **same head-specific paired observed appearances**, after forecast and label quarantine. Lower is better. These are exploratory served-output comparisons, not holdout certification or a causal rate/exposure experiment. Exact and reaimed forecasts remain separate. The controls were captured pregame alongside the bridge; their underlying source snapshot authenticity cannot be independently replayed from the ledger watermark.

`naive_last5` means five preceding skater appearances, but **ten preceding goalie starts** with a ten-team-game start share. `naive_season` uses current-season appearance/start history, not prior-season shrinkage. Goalie controls also use the existing team-win prior for W. Neither control implements the requested full prior-season/multi-season baseline ladder.

| Class / source | Control | Category | Paired n | FORGE MAE | Control MAE |
|---|---|---|---:|---:|---:|
| skater / bridge_exact | naive_last5 | goals | 1510 | 0.2860 | 0.2887 |
| skater / bridge_exact | naive_last5 | assists | 1510 | 0.4206 | 0.4248 |
| skater / bridge_exact | naive_last5 | pp_points | 1510 | 0.1805 | 0.1804 |
| skater / bridge_exact | naive_last5 | shots | 1510 | 1.0380 | 1.1007 |
| skater / bridge_exact | naive_last5 | hits | 1510 | 1.0196 | 0.9441 |
| skater / bridge_exact | naive_last5 | blocks | 1510 | 0.7709 | 0.7418 |
| skater / bridge_exact | naive_season | goals | 1510 | 0.2860 | 0.2837 |
| skater / bridge_exact | naive_season | assists | 1510 | 0.4206 | 0.4213 |
| skater / bridge_exact | naive_season | pp_points | 1510 | 0.1805 | 0.1781 |
| skater / bridge_exact | naive_season | shots | 1510 | 1.0380 | 1.0621 |
| skater / bridge_exact | naive_season | hits | 1510 | 1.0196 | 0.9275 |
| skater / bridge_exact | naive_season | blocks | 1510 | 0.7709 | 0.7339 |
| skater / bridge_reaimed | naive_last5 | goals | 352 | 0.2979 | 0.3165 |
| skater / bridge_reaimed | naive_last5 | assists | 352 | 0.4543 | 0.4504 |
| skater / bridge_reaimed | naive_last5 | pp_points | 352 | 0.2475 | 0.2392 |
| skater / bridge_reaimed | naive_last5 | shots | 352 | 1.0609 | 1.0835 |
| skater / bridge_reaimed | naive_last5 | hits | 352 | 0.9082 | 0.9320 |
| skater / bridge_reaimed | naive_last5 | blocks | 352 | 0.7747 | 0.7761 |
| skater / bridge_reaimed | naive_season | goals | 352 | 0.2979 | 0.3044 |
| skater / bridge_reaimed | naive_season | assists | 352 | 0.4543 | 0.4519 |
| skater / bridge_reaimed | naive_season | pp_points | 352 | 0.2475 | 0.2338 |
| skater / bridge_reaimed | naive_season | shots | 352 | 1.0609 | 1.0441 |
| skater / bridge_reaimed | naive_season | hits | 352 | 0.9082 | 0.8639 |
| skater / bridge_reaimed | naive_season | blocks | 352 | 0.7747 | 0.7632 |
| goalie / bridge_exact | naive_last5 | saves | 70 | 10.5964 | 11.4128 |
| goalie / bridge_exact | naive_last5 | goals_against | 70 | 1.3844 | 1.5567 |
| goalie / bridge_exact | naive_last5 | shots_against | 70 | 11.2808 | 12.6456 |
| goalie / bridge_exact | naive_season | saves | 70 | 10.5964 | 14.1688 |
| goalie / bridge_exact | naive_season | goals_against | 70 | 1.3844 | 1.7942 |
| goalie / bridge_exact | naive_season | shots_against | 70 | 11.2808 | 15.8035 |
| goalie / bridge_reaimed | naive_last5 | saves | 11 | 12.3482 | 10.9475 |
| goalie / bridge_reaimed | naive_last5 | goals_against | 11 | 2.0419 | 1.6091 |
| goalie / bridge_reaimed | naive_last5 | shots_against | 11 | 14.0631 | 11.7675 |
| goalie / bridge_reaimed | naive_season | saves | 11 | 12.3482 | 12.1669 |
| goalie / bridge_reaimed | naive_season | goals_against | 11 | 2.0419 | 1.8831 |
| goalie / bridge_reaimed | naive_season | shots_against | 11 | 14.0631 | 13.6194 |

Exact bridge skater SOG improves descriptively against both captured controls, while HIT/BLK are worse. This supports prioritizing exposure/recording-effect diagnosis, not introducing a venue model on this sample. Reaimed forecasts differ in cohort and vintage; their metrics cannot be compared directly with exact-bridge aggregate errors.

After quarantine, exact-bridge goalie start Brier is **0.2598 versus 0.2533** for the ten-start control on 70 pairs; win Brier is **0.3225 versus 0.3117**. These scores are heavily selection-biased because unused backups lack known outcomes. They are not valid population calibration conclusions. The JSON includes RMSE, bias, paired counts, missing/conflicting-label exclusions and reliability bins. No participation log loss, ranking utility, ratio, CRPS, interval coverage or rate/exposure decomposition is claimed from insufficient fields.

Two seven-calendar-day blocks contain the whole cohort; the report retains paired metrics within each block. No confidence interval or superiority claim is produced from these two incomplete blocks. No promotion criteria were fitted after seeing results; this pass has **no promotion eligibility**, no candidate tuning and no holdout claim.

## Missingness and reproduced accounting issues

The adapter accepts all 7,959 forecast identities/clocks. **1,790 rows remain unsettled**, and **six source rows** representing two goalie appearances are quarantined for SA ≠ saves + GA. Thus 1,796 source rows have unavailable outcomes after validation. The six rows are exact-bridge, last-five and season copies of:

- NHL player 8477465, game 2026020176, October 24: saves 25, GA 6, SA 30.
- NHL player 8478872, game 2026020177, October 24: saves 29, GA 4, SA 32.

Their stored outcome source is `wgo_goalie_stats`. Tests reproduce both failures and verify no guessed correction. This identifies inconsistent ledger labels, not a proven root cause in WGO or the ingest adapter. NHL shootout deciding goals do not belong to individual goalie GA; see [NHL rule 84.4](https://media.nhl.com/site/asset/public/ext/2022-23/2022-23Rulebook.pdf). Empty-net and shootout team bookkeeping must be reconciled against an authoritative individual-goalie boxscore before any record repair.

**Zero retained rows have a proven DNP settlement.** The snapshot route constructs a universe then only upserts forecast rows (`web/pages/api/v1/db/forge-served-forecast-snapshot.ts:96–101`); it reports `coverageStatus: unavailable_independent_universe_not_persisted` at line 131. The existing settlement helper correctly requires complete team/class evidence before treating absence as DNP (`servedForecastLedger.ts:289–310`). Missing rows therefore remain unknown here. Population coverage cannot be recovered by filtering to eventual GP or substituting the naive-model population.

The snapshot upsert also means `created_at` proves initial row existence, not immutability of current predictions. Forecast and outcome revisions share a mutable record. Full byte-authenticated pregame snapshots would be stronger evidence; current output is explicitly labeled a retained-ledger diagnostic.

A separate check of **point forecast** means found **62 inconsistent goalie rows**: 48 `bridge_reaimed`, seven `naive_last5`, and seven `naive_season`. Absolute SA − saves − GA discrepancy ranges from .0002 to .0834, exceeding four-decimal rounding tolerance. These rows remain in the population/known-outcome counts but are excluded from every comparison. Example: goalie 8480947/game 2026020165, last-five forecast SA 13.5833, saves 11, GA 2.6667. No repaired forecast is substituted. After both quarantines, exact-bridge goalie comparisons have **70 pairs** and reaimed comparisons only **11 pairs**. The skater results are unchanged. Upstream reconciliation and a fresh independently captured cohort are required before any goalie performance claim.

## Exact blockers and next admissible inputs

| Requested evaluation | Current status | Needed evidence |
|---|---|---|
| H1 incumbent vs captured controls | Measured, appearance-only | Persisted eligible-player universe, final complete team/class coverage, pregame immutable bytes/input references |
| H10/H20 incumbent and cumulative baseline comparisons | Unavailable | Common-origin frozen schedule/version and exact target IDs/end boundary; issued cumulative forecasts, known membership/trades and mature complete labels |
| Shrunk prior-season / recency multi-season rates | Not run | Admitted immutable prior boxscores with first-available receipts, prior-only fitted pool/shrinkage, forecast-time population and fold allocation; current revised season rows alone are insufficient |
| Strength rates × predicted exposure | Not run | Frozen ES/PP/SH rate inputs and predicted minutes; independently reconciled actual exposure; hold rates/exposure fixed in separate experiments |
| Historical enriched replay | Not supportable from this inventory | Cutoff-time injury/lineup/starter snapshots; use boxscore-only prior replay until prospective enriched snapshots exist |
| Goalie unconditional/relief/ratios | Incomplete | Unused-backup negatives, starts vs relief, minutes, joint SA/GA/saves, no-exposure mass; six inconsistent labels and 62 inconsistent forecast rows need source reconciliation |
| Distribution and persistent-uncertainty evaluation | Unavailable empirically | Genuine joint samples/parameters frozen at origin; no artificial trajectories from stored means/quantiles |
| Final untouched holdout and promotion | Not attempted | Predeclared allocation and criteria plus enough independent calendar blocks; existing development exposure must remain labeled |

## Reproduction and checks

Frozen local inputs/results are outside the repository under `/Users/tim/.fhfh/forge-evaluation/2026-11-04/`:

- `served-ledger.json`, SHA256 `ee4a2e95b7294bb5c63dd1a4e8ac42319adcb5946687aa534474e6f2731b22d1`.
- `inventory.json`, SHA256 `7b2a99d784544a1e94cd2a3137eefd7eba3a27406ad6a8518871a358cf704c18`.
- `ledger-report-accounting-verified.json`, SHA256 `5ccb814a83f11550a6181b5186712129890651f4a5794bb69fa74f5274611b57`, contains all final comparisons and block diagnostics. Earlier intermediate local reports are superseded. Runtime is approximately 0.15 seconds for 7,959 rows on this machine; this is one local run, not a production benchmark. Runtime is intentionally nondeterministic; result metrics and input hash reproduce.

From `web/` (choose a new output filename; overwrite is refused):

```sh
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-ledger-evaluate.ts --input /Users/tim/.fhfh/forge-evaluation/2026-11-04/served-ledger.json --as-of 2026-11-04T16:41:23.776Z --output /tmp/forge-ledger-reproduction.json
npm test -- --run lib/player-forecasts/servedForecastLedger.test.ts
npm run typecheck -- --incremental false
```

The frozen export was assembled with one date-bounded SELECT for each of the eight dates, in the form `SELECT json_agg(json_build_array(<the export's columns in order>) ORDER BY player_class,player_id,game_id,source) AS rows FROM forge_served_forecast_ledger WHERE served_date='<date>'`. The eight reads were not one atomic database snapshot. Re-reading the mutable database may produce different records; use the pinned local bytes to reproduce this result. Independent metadata census used `GROUP BY horizon_games` on `forge_player_projections`, `GROUP BY status` on `forge_runs`, and grouped retained/fetched clocks on the named source tables.

Final-tree verification: **291 tests passed across 16 files**, including all 15 pass-1 aggregate files plus `lib/player-forecasts/servedForecastLedger.test.ts` (32 tests). The final narrow adapter regression also passed before the aggregate. **Full `npm run typecheck -- --incremental false` passed**, **targeted ESLint on all 12 owned TypeScript files passed**, and **final diff/whitespace review passed**. Tests include RSO bridge and BLSH/Trade Analyzer consumers. The typecheck initially caught a Buffer/BinaryLike typing mismatch in the adapter hash call; the final Uint8Array conversion fixes typing while preserving the exact input hash. The checks were rerun after the final forecast-accounting change.

Logs: `/tmp/fhfh-forge-pass2-complete-tests.log`, `/tmp/fhfh-forge-pass2-complete-typecheck.log`, `/tmp/fhfh-forge-pass2-complete-lint.log`. Run the aggregate command from the pass-1 receipt with `lib/player-forecasts/servedForecastLedger.test.ts` appended. No build or browser run was warranted for this offline-only adapter. No sampler caller was enabled; a bounded caller search found `jointGoalieCounts` only in its implementation and tests.

Pass 1 remains a local integrity slice: its fixture results prove accounting/temporal behavior, not NHL accuracy. Its original implementation receipt is `tasks/artifacts/forge-integrity-2026-11-04.md`. This pass adds measured exploratory H1 results and explicit H10/H20/prior-only/enriched-data blockers, without qualifying or promoting any model.
