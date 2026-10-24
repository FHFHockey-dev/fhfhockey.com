# Task 1 paired scoreboard — local implementation

Canonical `octoberBranch`, base `84cb1229cd1c1cdd037c43e660d2a181304ada51`. Four source/test files changed; no snapshot, settlement, bridge, model, migration or Claude-owned file edits. `SOURCE-PINS.json` identifies the tested bytes.

- `servedForecastLedger.ts`: pairwise comparisons join season × served date × class × player × game. Missing sources, unmatched rows, duplicate keys, conflicting participation and head-specific missing/conflicting evidence are explicit. Both forecasts must have the same known actual for each scored head.
- Count heads and FP use dressed-only cohorts. Metrics include forecast-minus-actual bias, MAE, RMSE, total actual/total forecast, Mincer–Zarnowitz slope/intercept, and paired RMSE skill `1 - RMSE(source)/RMSE(reference)`. A zero reference error yields null skill; constant/single forecasts yield null regression.
- Expected-FP deciles use source forecast rank, never actuals or goals. Ties stay together at midpoint rank, so small/tied samples can have empty bins. Per-head sample sizes and exclusions remain visible. The existing `decile10` now describes FP in the expected-FP top bin; source errors now exclude DNP, while `n`/phantoms still describe settled rows.
- Goalie start/win/shutout Brier and reliability each use their own probability and binary event. Probabilities outside [0,1], missing/nonbinary/conflicting outcomes and ambiguous source identities are excluded. Known non-starts remain in the event cohort; count/FP metrics remain dressed-only. These are known-outcome sample scores, not complete-population calibration.
- `scoreboard.ts` returns daily `paired` and `pooledPaired` reports. Existing per-source summaries are labeled `unpaired_descriptive_only`. Numeric conversion preserves null/invalid/blank evidence. One additional existing ledger column, `season_id`, is read; no new table/column is assumed.

## Verification

- **Passed:** 32 offline tests across ledger (21), scoreboard API (4), unchanged snapshot route (3), unchanged settle route (4). `TESTS.log`.
- **Passed:** scoped TypeScript over four touched files plus transitive dependencies, under `/private/tmp/fhfh-heavy.lock`; exit 0. `TYPECHECK.log` is empty on success.
- **Passed:** scoped ESLint, exit 0. `LINT.log` is empty on success.
- **Passed:** scoped `git diff --check`.
- Node 22.11.0 / npm 10.9.0. Tests used synthetic existing fixtures plus deterministic arithmetic/adversarial fixtures, empty environment inputs, an isolated Vite env directory, and a network-denial preload. Commands/configurations are preserved in `verify-local.sh`, `vitest.config.mts`, `tsconfig.json`, and `network-deny.cjs`.
- No full suite, production build, production requests, database reads/writes, migration, paid calls, commit, push or deployment. These tests establish implementation arithmetic and guards, not predictive skill.

## Remaining input/evidence gates

- **Task 1.2 partial:** persisted rows lack historical F/D position and forecast/actual TOI/PP-TOI. F/D slices and opportunity/rate decomposition remain unavailable, explicitly labeled in API/code; G is identifiable from player class. No current-roster guess or synthetic minutes were substituted.
- **A3/A4 preserved:** missing actuals/DNP safeguards are unchanged; no authoritative completeness producer or durable independent universe exists in this route. Coverage stays unavailable. A complete-population start calibration claim is unsupported.
- **Task 1.4 pending separate approval/evidence:** production Q3/Q4 around October 29 and R23 frozen-cohort qualification were not run. Model coefficients remain candidates; target-by-target review is still required.
- No action was denied or left with uncertain execution. Required input contracts are missing; no permission request is pending. File lease is ready for parent review/handoff; no additional edits planned.
