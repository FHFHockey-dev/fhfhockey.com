# Task 3: bounded pilot export ready for approval

**Approval-ready request:** Approve one read-only snapshot export from FHFH's linked Supabase project **`fyhftlxokyjtpndbkfse`**, `public` schema, using `task3-pilot-export.sql` exactly once: **2026-10-01 inclusive through 2026-10-22 exclusive**, season **20262027**, at most **10,000 played WGO player-game identities / 20,000 ES+PP observations**, **15-second statement timeout**, **1-second lock timeout**, no parallel query workers, **16 MiB maximum output**. Stop on timeout, schema error, truncation or excess output; no retry, pagination, broader dates, new credential handling or NST/application calls. Save the single `export` result as bare JSON for local validation. No database writes, migrations or deployments.

The target ref was read from the repository's `supabase/.temp/project-ref`; its hosted state was not queried. The SQL is a proposal, **not executed or hosted-plan validated**. Exact CPU/I/O cost is unknown; the statement timeout bounds execution and the output limit bounds returned data, but neither promises a free query or bounds scanned pages. Existing checked-in indexes cover WGO dates and NST player/date/season. The SQL permits at most two source matches per table/identity so duplicates remain visible without unbounded join multiplication. It **materializes** at most 10,001 canonical joined candidates (one truncation sentinel), not at most 10,001 scanned rows. The sentinel is applied after `wgo_skater_stats LEFT JOIN games ON game_id=id`. Each subsequent NST lateral aggregate returns exactly one array-bearing row, so it cannot multiply the player-game cardinality. A valid export has at most 10,000 WGO joined rows, 20,000 strength slots and 80,000 contained source matches (four tables × two duplicate-detection slots). Canonical mismatches/duplicates are retained for validator rejection rather than silently normalized. Actual scanned rows/pages depend on the planner.

`jsonb_agg` produces one final SQL result row. The server's 16 MiB check occurs **after** constructing that JSON and does not cap aggregation memory. The 15-second statement timeout covers the SELECT, including its CTEs, sorts and aggregates; 20 seconds is the idle-in-transaction timeout, not an active-transaction deadline. There is no hard database-work or memory bound inferred from `LIMIT`.

## Exact read surface

| Table | Columns used |
|---|---|
| `wgo_skater_stats` | `id, player_id, game_id, date, season_id, position_code, games_played` |
| `games` | `id, date, seasonId, type, startTime` |
| `nst_gamelog_es_counts`, `nst_gamelog_pp_counts` | `id, player_id, season, date_scraped, gp, toi, goals, total_assists, total_points` |
| `nst_gamelog_es_counts_oi`, `nst_gamelog_pp_counts_oi` | `id, player_id, season, date_scraped, gp, toi, gf` |

No base-table wildcard selects, names, birth information, account/user identifiers, league settings, roster records, emails, prices, credentials or environment values. The internal `c.*` refers only to the explicitly selected canonical CTE columns. Only public NHL source identities and numeric hockey observations are exported. Source `created_at` is deliberately excluded: rows are upserted, so insert time cannot prove when the current values became available. Position comes from the game-level WGO row, not today's player metadata. Canonical game date/season/type and source duplicate sentinels are retained for local exclusion checks. Source TOI is seconds according to `update-nst-gamelog.ts`'s MM:SS/decimal-minutes conversion.

The proposal uses a `REPEATABLE READ READ ONLY` transaction and ends with rollback. PostgreSQL documents that read-only mode disallows normal table-changing commands, while still permitting physical I/O; this is not a zero-cost guarantee. [PostgreSQL 15 transaction documentation](https://www.postgresql.org/docs/15/sql-set-transaction.html). Supabase's [current changelog](https://supabase.com/changelog) was checked; the listed HTTP TLS change does not affect the direct PostgreSQL query proposal.

## What the pilot unblocks

The first dependency is **an observed matched assist/IPP denominator**, not a three-season parameter search. This pilot provides raw individual G/A/points and on-ice GF with equal strength-specific exposure, canonical identities and explicit coverage diagnostics. It can immediately produce descriptive F/D × ES/PP assist-share and IPP means and supply normalized raw rows to the existing split-half fitter. Small-sample or missing-cohort failures remain visible; no default k is chosen.

This pilot **does not complete task 3.1's 2023-24-onward fit**, team A/G reconciliation, current-c reconstruction or predictive qualification. Expansion to 2023-10-10 onward would be a separately bounded export after the schema/alignment pilot succeeds. Historical values in a new export are retrospective snapshots, not proof of what was known before historical forecasts.

## Runnable validator/extractor

From `web/`, using existing Node 22.11/npm tooling:

```sh
NODE_PATH=. npx --no-install ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-assist-export.ts --input /tmp/forge-assist-pilot.json --output /tmp/forge-assist-pilot-validated.json
```

For a separately approved export client, pipe only its bare-JSON result into the same program with `--stdin --output /tmp/forge-assist-pilot-validated.json`. The receiver counts actual UTF-8 bytes as chunks arrive, stops above 16 MiB **before JSON parsing/validation**, and writes no output on overflow. The file-input path checks both file size before reading and actual byte length before parsing. This bounds receiver input/processing, not bytes already buffered by an upstream database client or server scan/aggregate work. The chosen execution client must support bare JSON with control statements kept out of stdout; this worker has not connected or exercised a live client.

The validator makes **no network/database/environment calls**. It enforces the exact project/scope, row/byte limits, no silent truncation, allowlisted fields, unique player-games, single-game source rows, matched dates/seasons/TOI, integer nonnegative counts and `G+A=points<=on-ice GF`. Missing counts with positive exposure remain unknown and are excluded with reasons; numeric zero remains observed zero. Duplicates are never resolved by arbitrarily selecting a row. The output contains normalized `HistoricalCounts[]`, coverage/exclusion counts, descriptive priors and the input SHA256; it does not fit or publish coefficients. A currently exported row receives `availableAt=exportedAt`, never a fabricated historical availability time. Output files use exclusive creation.

Thirteen new offline test cases exercise valid extraction, missing versus zero, frame/exposure mismatches, single-game semantics, duplicate/truncated scope, extra fields, canonical binding, the local CLI and the bounded stream receiver. An oversized-stream case proves the receiver stops before parsing or consuming subsequent chunks. They establish mechanics only. No real pilot export has been supplied or queried.

## Exact local search and integration state

`task3-local-search.json` lists every retained capture path and SHA256 searched: **62 each in a/b/a0/b0 (248 total), zero c**. It also identifies the exact 2,074-row historical audit extract and synthetic native fixture. All four variants have **zero reads of the four required raw count tables**. Hydrated b/b0 do contain cumulative `ipp_points_all`, `ipp_on_ice_goals_for_all`, `ipp_*_3ya` and related rolling keys; these are available aggregate summaries, not independent aligned individual-assist/on-ice-GF game frames, split halves or value-vintage evidence. The historical audit extract contains only heads, reconstructed projections and a limited rolling EV view. The native fixture is explicitly `synthetic_fixture`.

Reproduce the metadata-only inventory with `node tasks/artifacts/forge-skater-candidates-2026-10-22/inspect-task3-local.cjs` after choosing a fresh output path in the script; it refuses to overwrite existing evidence. The four real variants were captured October 21 after their target games; they cannot be relabeled as historical as-of input. `task3-sql-contract-check.json` verifies every selected column against the checked-in schema, the six-table allowlist, read-only commands and numeric bounds. It is a static check, not hosted SQL execution/plan validation.

**Default-off is safe:** the candidate helpers and validator have no production stage call sites and perform no automatic reads. This disconnected structure can remain in place without estimates and cannot alter served means. Enabling a useful stage path still needs matched on-ice opportunity, qualified priors and source/coverage contracts; an unused runtime flag would not supply those inputs, so none was added. **Stage/calculator editing lease is released.** Task2 retains exclusive ownership of its physical-rate helper repair; no calculator code was edited here.
