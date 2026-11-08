# WiGO historical identity repair: applied and verified

The authorized bounded transaction was executed **once** against `fyhftlxokyjtpndbkfse.public.wgo_skater_stats`. Fresh preflight still matched all 273 original row checksums. The transaction completed without an error, and a separate readback proves the committed outcome.

## Actual changes

- **273 rows across 33 players:** populated `game_id`, `team_abbrev`, `opponent_team_abbrev`, and `home_road` from the validated official NHL evidence.
- **3 of those rows, Joseph LaBate (8476425):** corrected `season_id` from 20242025 to 20162017. Exact IDs: 2813678, 2814157, 2814495.
- No other field values changed. No inserts, deletes, schema changes, endpoint calls, recalculation, deployment, push or build.

## Verified postflight

- Exact target rows present: **273**.
- Correct identities and seasons: **273**.
- Complete non-identity checksums preserved: **273**.
- Actual stored last-20 frames for all 33 players: **608 rows; zero invalid identities, zero duplicate player/game identities**.
- All 273 repaired rows remain in the current frames.

This verifies the underlying historical-data repair. The WiGO calculation was **not** invoked; the next natural calculation remains the final downstream observation. An immediate replay would affect the full active cohort because the current route has no targeted player selector, and is outside this execution scope.

## Evidence

- `pre-execution-preflight-result.json`
- `execution-result.json`
- `postflight-result.json`
- `actual-stored-frames-result.json`
- `APPLIED-RECEIPT.json`

The executed bytes are retained under their original frozen filename `repair-NOT-EXECUTED.sql`. Despite that historical filename, they **have now been applied**. Do not rerun them. SHA-256: `718ce0010b330ff9291bfb36187a7deb85a419918cebd1cc5059f284c20023f2`.

The prior preparation report and receipt are retained as historical pre-execution evidence and are superseded by this applied receipt for current status.
