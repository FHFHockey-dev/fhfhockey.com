# WGO Utah Identity Repair Contract

## Scope

This contract prepares `B-CLEAN NEW 105` without authorizing a Production mutation. It covers only the 88 `public.wgo_team_stats` rows for season `20252026` stored under team 59 with the already-correct `Utah Mammoth` name.

## Frozen read-only evidence

- Source rows: 88 rows on 88 dates, all team 59 / Utah Mammoth, with null `game_id` and `opponent_id`.
- Target conflicts: zero team-68 rows on those season/date keys.
- Schedule mapping: every source row maps to exactly one team-68 game and one non-68 opponent; there are 88 distinct mapped games and no ambiguous or missing mappings.
- Manifest digest: `dd27185df94d9f7e9816eb3a9a8a8b66` over `row id : date : mapped game id : mapped opponent id`, ordered by row ID.
- Pre-repair table receipt: 38,484 total WGO rows and 2,788 rows in season `20252026`.

These counts and digests are preconditions, not permission to write.

## Candidate migration

`20260730200000_repair_utah_wgo_team_identity.sql`:

1. Takes a table-level writer lock for the bounded transaction.
2. Reconstructs the exact manifest from the WGO rows and canonical team-68 schedule.
3. Requires the frozen 88-row digest and either the complete pre-state or complete post-state.
4. Updates only `team_id`, `game_id`, and `opponent_id`; every metric, row ID, date, season, and franchise name remains unchanged.
5. Requires exactly 88 updates on first application and zero updates on physical replay.
6. Fails the transaction if any repaired row does not match its exact mapped game/opponent.

## Application and rollback gates

Before application, re-run the frozen preconditions and require the exact migration in the grouped predeploy authorization. After application, require 38,484 total rows, 2,788 season rows, zero target-key duplicates, zero residual team-59 rows in the manifest, 88 exact team-68 rows, the unchanged manifest digest, and unrelated-scope digest invariance.

The inverse rollback manifest is the same frozen row-ID/date/game/opponent digest. A rollback may set only those 88 rows back to team 59 with null game/opponent links after proving the complete post-state and zero later writes to those IDs. It must run in one locked transaction, require exactly 88 updates, reproduce the original digest and counts, and retain its own receipt. Do not use the inverse after later canonical WGO writes have changed any manifest row.

## Local executable proof

On 2026-07-30, the value-free hosted identity manifest reproduced the frozen digest on the isolated local Supabase stack. First application changed exactly 88 rows; physical replay left every manifest row `xmin` unchanged. The locked inverse restored exactly 88 pre-state rows, and reapplication restored the exact 88-row post-state. The immutable-field digest remained `0c3b0c5b2dd02dab9c2c3ece04909d50`, the unrelated-row digest remained `fbcb62d89e71125835a93c44c9e1c19d`, and cleanup returned WGO, game, and team fixture counts to zero.

This closes the local rollback/reapply gate only. Production application and its post-count, digest, invariance, and retained rollback receipts still require exact mutation authorization.
