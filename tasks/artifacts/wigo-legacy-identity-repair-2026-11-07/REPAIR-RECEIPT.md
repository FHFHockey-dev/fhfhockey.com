# WiGO legacy identity repair: preparation record

**Current status: applied and independently readback-verified. See `APPLIED-RECEIPT.md`. The text below records the earlier preparation state.**

## Result

All 273 captured rows across 33 players and 184 dates (2016-11-23 through 2023-04-14) have unique, source-backed identities. Each matched its exact player, appearance date, official regular-season game, and all seven stored statistics checked: goals, assists, points, shots, plus/minus, penalty minutes and time on ice. No values were inferred from current teams, names, or nearby dates. No metrics were replaced or dropped.

The repair also needs three source-confirmed season corrections for **Joseph LaBate (8476425)**. Rows **2813678, 2814157 and 2814495**, dated November 23, 25 and 26, 2016, incorrectly carry season 20242025. Official games 2016020297, 2016020311 and 2016020319 establish season **20162017**. The seven statistic comparisons pass for these rows too.

## Exact production scope

- Project: `fhfhockey.com` / `fyhftlxokyjtpndbkfse`.
- Table: `public.wgo_skater_stats`.
- Update the exact 273 captured primary keys. Fill `game_id`, `team_abbrev`, `opponent_team_abbrev`, `home_road`; correct `season_id` on the three rows above only (the other 270 retain their existing season value).
- No inserts, deletes, metric changes, schema changes, trigger changes, totals rebuilds, cron changes, application endpoints, pushes, builds or deployment.
- One atomic SQL transaction, concurrency one; 15-second statement timeout, 2-second lock timeout. Locks only the 273 target rows in ID order.
- Abort if any full-row checksum has changed, a target is missing, another row already has a proposed player/game identity, an existing schedule contradicts the official source, or any noninternal table trigger has appeared.
- Exactly 273 rows must update. Before commit, verify every new identity and checksum every non-identity field, substituting the original season solely for this preservation comparison. Any failure aborts the transaction.
- Execute only the exact reviewed `repair-NOT-EXECUTED.sql`, SHA-256 **718ce0010b330ff9291bfb36187a7deb85a419918cebd1cc5059f284c20023f2**.

## Verified dry run

Live read-only preflight found 273 unchanged rows, 33 players, zero missing rows, zero conflicting player/game identities, zero schedule contradictions, and zero noninternal triggers. The existing `games` table corroborates 269 rows. Four schedule entries are absent, so those four identities rely on the complete official NHL game-log/summary evidence. No missing schedule rows are inserted.

A read-only projection through the existing WiGO last-20 selection covers 608 rows for the 33 players. After the proposed metadata changes, it yields **zero invalid identities and zero duplicate player/game identities**. All 273 planned repairs remain inside those frames. The guard, active cohort and cross-season contract stay unchanged.

15 focused Python tests passed. `EXPLAIN (FORMAT JSON)` parsed/planned the exact metadata UPDATE without executing it, using primary-key index lookups. The complete mutation transaction has **not** been executed or rollback-tested. No claim of production repair or successful recompute is made.

## Source provenance and usage

`captured-rows.json` preserves the original identity values and complete-row/stat-preservation checksums. `source/` contains 45 official NHL documents covering the 45 initially requested player-seasons; 44 are needed by the final plan because the incorrect 2024–25 season is superseded by the already-captured 2016–17 log. `source-plan.json` records source URLs, captured timestamps, SHA-256 digests, and all 273 matches.

Source reads were sequential and cached. The Mac Python certificate-store mismatch was handled by switching to system curl with normal TLS verification, never disabling verification. Two bounded connection timeouts for Josiah Slavin's game log and a later TLS connection failure were resolved through the official NHL stats summary API; one summary proxy timeout was resolved through that player's official game log. No authentication credentials were read or transmitted. Approximate provider request accounting: 45 successful documents, five failed attempts (including the initial Python certificate failure), no provider writes. Supabase access used bounded read-only checks and one non-executing EXPLAIN; no production mutation occurred.

## Execution and completion gate

1. Review the exact SQL and source-plan hashes with the expanded three-row season correction scope, then obtain the required production-execution authorization.
2. Rerun `preflight.sql` immediately before the approved transaction. Any new drift requires recapture/review, not dropping a guard.
3. Execute the reviewed transaction once, then run `postflight.sql`: expect 273 exact/corrected/stat-preserved rows. Record a committed result before calling it repaired.
4. Observe the next natural WiGO calculation and confirm the 33 prior missing-identity failures disappear. Do not call `calculate-wigo-stats` as a narrow player replay: the current route has no player-ID selector and runs the full active cohort. An immediate recompute needs its own known bounds and authorization.
5. Transaction failure rolls back automatically. A post-commit inverse that restores invalid null game IDs would conflict with existing constraints; do not disable those constraints or promise an automatic inverse. Preserve the captured originals and investigate/forward-correct if needed.

No runtime application source was changed. All new files belong to this task's artifact directory and context diary; concurrent work is untouched.
