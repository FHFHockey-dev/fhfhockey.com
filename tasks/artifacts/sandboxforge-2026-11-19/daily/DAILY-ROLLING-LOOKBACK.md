# Daily FORGE rolling-history lookback regression

The November 19 daily-reader scenario is reproducible offline against candidate `f886ddac731ae825a12fab915848d2b5fd7d9b8c` (tree `09ef9bf0662e14cd80fa60cee25c70a988e5c748`). The candidate and the canonical checkout's `62ce797ad` had identical reader and test blobs before the work. The fixture uses the identified historical row's player `8480252`, date `2024-01-19`, season `20232024`, null `game_id`, and no sidecar for each of `ev`, `pp`, and `all`. A separate synthetic current player serves as a control.

The SQL RPC `forge_latest_rolling_rows` selects the latest row for each player and strength before the upper cutoff and has no lower bound. The old caller checked `game_id` before the lookback. The revised caller verifies the selected fields, player, strength, and date, applies the lookback, then validates canonical game identity and hydrates sidecars for in-window rows. The legacy table scan already sends both date bounds to the table, and retains strict checks on returned rows. At cutoff `2026-11-19`, January 19, 2024 is 1,035 days old. The exclusive lower bounds are `2025-11-19` for 365 days and `2023-11-20` for the 1,095-day long-absence path.

| Fixture, tested for ev/pp/all | Candidate RPC | Revised RPC | Legacy table scan |
| --- | --- | --- | --- |
| Historical null ID, default 365 days | Rejected `invalid_row` | Kept current control and excluded historical row | Kept current control and excluded historical row |
| Historical null ID, explicit 1,095 days | Default assertion stops the focused candidate RPC case | Rejected `invalid_row` | Rejected `invalid_row` |
| Synthetic recent null ID, default 365 days | Default assertion stops the focused candidate RPC case. Existing separate RPC null-ID test covers this condition | Rejected `invalid_row` | Rejected `invalid_row` |

On Darwin with Node `v22.23.4` and Vitest `v3.2.7`, the unchanged candidate reader with the new cases reported three failing RPC cases and three passing legacy cases. All failures had `{ status: "incomplete", reason: "invalid_row" }` at the default-lookback assertion. With the reader fix, all 118 tests in `skater-queries.test.ts` passed, including the six new regressions and existing RPC replay, row validation, sidecar, and legacy scan cases. Targeted ESLint and `git diff --check` passed.

## Independent reproduction

Use a disposable checkout of the pinned candidate with the `web` lockfile dependencies installed. Set `DAILY_PATCH` to the absolute path of the adjacent `rolling-lookback.patch`. SHA-256 `720e60edbd79b151563797e85ab1d1aa0408f50f103b249ada981f12b94f88ce`.

```sh
# From the root of the disposable checkout. Apply the regression tests alone.
git apply --include=web/lib/projections/queries/skater-queries.test.ts "$DAILY_PATCH"
(cd web && npm test -- --run lib/projections/queries/skater-queries.test.ts -t 'daily rolling lookback' --reporter=dot)
# Expected exit 1: three RPC invalid_row regressions and three passing legacy cases.

git apply --include=web/lib/projections/queries/skater-queries.ts "$DAILY_PATCH"
(cd web && npm test -- --run lib/projections/queries/skater-queries.test.ts --reporter=dot)
# Expected exit 0: 118 passing tests, including all six daily-lookback cases.
```

The tests run the application reader with simulated RPC and PostgREST table responses. The exact original RPC payload was unavailable, so this reproduces the recorded row shape and failure at the reader boundary. No production requests, database reads or writes, cron calls, or deployment were performed in this lane.

## Real PostgreSQL and PostgREST reproduction

`run-postgrest.sh` starts a disposable PostgreSQL 15 cluster on a private Unix socket and PostgREST 16.6 on a random local HTTP port. It loads the synthetic rows above and matching-strength recent null-ID rows, applies the candidate's unchanged `20261021182129_forge_latest_rolling_rows.sql`, and invokes the actual application reader through the same PostgREST SDK used by Supabase. Legacy cases use the application's read-only reconstruction mode to select the actual table scan. The script asserts request paths, HTTP success, returned row identities, both date windows on the table scan, and the reader outcomes. Its cleanup reverses the source patch and shuts down both services.

Use the candidate's disposable checkout or archived source with its `web` dependencies installed. The runner checks the pinned reader, migration, and lockfile blobs, and checks the exact commit for a Git checkout. It requires Bash, Python 3, Git, curl, Node `22.23.4`, PostgreSQL 15, and PostgREST 16.6. `PG_BIN_DIR` can point to an alternative PostgreSQL 15 bin directory. When run as root, the script uses `runuser` to start PostgreSQL under the existing `postgres` OS account, overridable with `PG_OS_USER`. The output directory must be empty.

```sh
POSTGREST_BIN=/absolute/path/to/postgrest bash "$DAILY_DIR/run-postgrest.sh" \
  "$CANDIDATE_CHECKOUT" "$DAILY_RESULT_DIR"
```

The macOS preflight passed 18 candidate and 18 fixed scenarios on PostgreSQL 15.19 and PostgREST 16.6. Across all three strengths, the candidate RPC failed with `invalid_row` for all three scenarios. The fixed RPC returned the synthetic control for the default historical case and continued to reject the wider historical and recent default cases with `invalid_row`. The table path returned the control for the default historical case and rejected the two in-window cases both before and after the patch. The old row appeared in the actual RPC response and stayed outside the default legacy response. The archived reader returned to the pinned candidate blob after cleanup.

[`local-postgrest/`](local-postgrest) holds the macOS preflight outputs. `candidate.jsonl` and `fixed.jsonl` carry one machine-readable result per scenario, including HTTP rows, query filters, and the application outcome. `fixture-readback.json` records the nine seeded rows. `postgresql.log` and `postgrest.log` preserve database and HTTP diagnostics. This is a synthetic database with the original migration and application reader. It establishes the source-path behavior without verifying production or the larger daily job.
