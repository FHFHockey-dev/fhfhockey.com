# Decision 152: why the refresh touches every game, what stays unchanged, where it stops (Chef, 2026-11-13)

**State:** plan only. The order is migration 149, then the writer and registry release, then the **dry run** (its diff comes to TJ), then the refresh. Each step is its own approval. PP share stays **off**; readers stay withheld until the refresh and readbacks pass and TJ approves serving it.

## Why 31 calls for 16 changed team-games
The 2026-27 regular season has 309 games; ≤10 games per call gives 31 calls, sequential and ≥5 s apart, with the load gate before each. Only 16 team-games (14 games) should change values, but the refresh has to cover all 309 games:

1. **It replaces the calculation, not just the bad rows** (decision 152, TJ: no one-off rebuild that leaves the old calculation in place).
   - After the refresh, every 2026-27 row comes from the stored-input writer and carries `calculation_version` and `computed_at`.
   - A row the refresh didn't touch stays a null-version old-writer row, and readers can't tell it apart from a verified one.
2. **The clock table starts empty.** Readers will show PP share only where `pp_team_game_clock.availability = 'available'`, so each of the 618 team-games needs its clock row (available, not applicable or unavailable with its reason). The 14 games alone would leave 590 team-games with no clock row, and so unavailable.
3. **It proves "only 16 change" in production.** The offline comparison said 593 of 609 qualified team-games already agree. Re-deriving all of them through the production writer, and checking the dry run, confirms that against live stored inputs instead of assuming it.

## What must stay unchanged
- **The 593 agreeing team-games:** every player row's values (PPTOI, `pp_share_of_team`, unit, unit-relative fields, team, player) are identical; only `calculation_version` and `computed_at` go from null to set. No row is added or removed.
- **The 16 changing team-games change exactly as the dry run says:** 15 stale rows deleted (group A), 23 rows updated (B: overtime seconds; C: 2026020131 t18 now 120 s), 5 rows inserted (C's missing skaters). Nothing else.
- **Untouched:** any other season's rows, `created_at` on kept rows, and every other table except `pp_team_game_clock`, which goes from 0 to 618 rows.
- **Availability rules hold:**
  - share ≤ 1 and PPTOI ≤ clock on every row;
  - PP1 and PP2 have at most 5 players each;
  - a qualified 0 is `not_applicable`;
  - no player rows for an unavailable team-game;
  - nothing capped.

## Dry run (after the writer release, its own approval)
- The same 31 batches with `dryRun=true`; nothing is written.
- The full expected diff is saved and hashed, and comes to TJ before any refresh.
- **Any difference from the expectation above stops the plan:** a different set of changed team-games, other row counts, or any clock availability other than the expected one.

## Refresh: where it stops on a mismatch
- **Before each call:** the load gate (busy, long queries or lock waits stop it).
- **After each call (10 games):** read back each game against the hashed dry-run expectation (row set, values, both clock rows).
- **The first mismatch, non-200, call over 60 s or failed gate stops the run before the next call.**
- **What a stop leaves:** each game is replaced in one transaction (`replace_power_play_game_v1`), so no game is ever half-written. Games before the stop are fully on the new calculation, later games fully on the old one. Readers are still withheld, so nothing is shown.
- **Resume:** from the next game, only after the mismatch is reconciled and TJ re-approves.
- **After the run:** the nightly job 388 (08:05Z, last 3 days) keeps new games current with the new writer.

## Tooling
F11 is preparing, offline: a dry-run pass-through and a concurrency-1 option on the batch route (today it has no dry run and runs games in parallel), plus the runner `20-refresh-runner.py`. The batch route change becomes part of the writer and registry candidate before its release approval.
