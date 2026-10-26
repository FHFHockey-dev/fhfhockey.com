# Receipt: days-ahead preflight anchoring (run-projection-v2)

**Base** HEAD `9b462e9c9` (master `74a6e7d04` plus sync). **Uncommitted.**

No production, database or network reads. No git mutations, deploys or builds. Every test ran offline, on fixtures.

## 1. Which gates failed, and why

Live symptom: on 10-26, `run-projection-v2?date=2026-11-01` returned `HTTP 422: Preflight freshness checks failed`.

The cause: every backward-looking window in `runProjectionPreflightChecks` ended at `asOfDate`, the game date. For a slate N days ahead, the newest data that can exist is from yesterday's games. A window of `[asOfDate-7, asOfDate)` therefore drops anything older than `7-N` days before today.

I reproduced it on the old code with the new fixture test. The clock was frozen at 2026-10-26 16:00Z. Team 1 last played 10-25 and team 2 on 10-22. Both are fresh by today's standard.

| Slate | Failing gates (old code) |
|---|---|
| today (10-26) | none |
| +4, +5, +6 | `skater_derived_freshness`: team 2 falls outside `asOf-7` |
| +6, after a league off-day (latest games T-2/T-3) | `skater_derived_freshness` and `projection_derived_v2`: the league-wide newest derived row falls outside `asOf-7` |

The same windows put three other gates at risk with longer horizons or breaks:
- `skater_line_freshness`: hard-stale above 21 days, measured from `asOf`.
- `projection_input_ingest`: `asOf-14`.
- `stale_goalie_game_rows`: `asOf-30`.

## 2. Fix (`web/pages/api/v1/db/run-projection-v2.ts`)

- **New helper** `preflightFreshnessAnchorDate(asOfDate, now)` returns `min(asOfDate, today)`. "Today" is the UTC date, which is also how the route defaults `asOfDate`.
  - Today's and past runs anchor at `asOfDate` exactly as before.
  - At 9 p.m. ET the UTC date has already rolled over. An ET-dated run then keeps its own anchor, and a run for the UTC-dated default is no less strict.
- **Windows that now end at the anchor:**
  - the line-combination fetch, and the line-combination age;
  - the per-team skater derived window (`anchor-7`);
  - the league-wide `projection_derived_v2` window (`anchor-7`);
  - the ingest window (`anchor-14`);
  - the goalie-game window (`anchor-30`).

  A days-ahead run now checks exactly the windows that today's run checks.
- **Still on `asOfDate`:**
  - the scheduled games and teams;
  - `goalie_start_priors_v2`, which still requires rows for the slate's scheduled games;
  - the season lookup.
- `PreflightSummary` gains `freshnessAnchorDate`, so the 422 body shows which anchor applied.
- `bypassPreflight` is neither used nor changed.

## 3. Tests (`web/__tests__/pages/api/v1/db/run-projection-v2.preflight.test.ts`, new)

These run the real preflight, including the real `fetchRecentTeamLineCombinations`, against an in-memory Supabase fixture. It's a new file because the existing route test's global Supabase mock returns errors for `games`.

- **Today:** today-fresh inputs pass, with anchor = today.
- **+4, +5 and +6:** the same inputs pass, with anchor = today.
- **+6 after a league off-day:** passes, just as today's run does.
- **Stale as of today:** team 2 last played 8 days ago. Today's run fails `skater_derived_freshness`, and so do +1, +4 and +6, with exactly the same gate.
- **Hard-stale line combinations as of today:** at +5, `skater_line_freshness` fails.
- **No goalie start priors for the +6 slate:** `goalie_start_priors_v2` fails, and its action names the slate date.
- **Past slate (10-20):** anchors at 10-20, so data from 10-22 doesn't count.
- **`preflightFreshnessAnchorDate`:** past, today and future dates, plus the ET-evening UTC rollover.

## Checks

| Check | Result |
|---|---|
| vitest, new file plus `run-projection-v2.test.ts`, TZ=UTC | **passed** 31/31 |
| vitest, same files, TZ=America/New_York | **passed** 31/31 |
| Old code against the new file | 7 failed, 2 passed. That's the reproduction above (log `anchor-before.log`). |
| eslint, both files | **passed**, exit 0 |
| Whole-project tsc, HEAD export plus these 2 files, under `/private/tmp/fhfh-heavy.lock` | **passed**, exit 0 (lock acquired at 21:50:00Z and released) |

## 4. Producer closure

`run-projection-v2.ts` is a closure root, so the closure moves:

| Tree | Closure |
|---|---|
| HEAD `9b462e9c9` | `87edd78f5dfa96eded8a32927ef184d9266995edf52f395cf5ac6b8565c64f97` (listed for 5aa9ba5e0) |
| HEAD plus this change (export) | `5644e3fdb1e230e0a063a27b52519cc8e70b88272e92f27ca5aadc8f53d1dea4`: **VERIFIED** by `verify-forge-release-sha.ts --tree`: 194 modules, 0 findings, 21 dynamic table sites |

No commit reproduces the new closure yet, so it is **not listed**. Once the orchestrator commits it, list it with `verify-forge-release-sha.ts <full SHA>`, then add its `producerIdentity.closureSha256`, `commit` and receipt to `VERIFIED_FORGE_PRODUCER_CLOSURES`. Until that ships, runs from the new build deny, which is fail-safe.

## Follow-up (outside this lease)

Inside the run, `lib/projections/stages/skater-stage.ts:1451` (`assessLineCombinationRecency`) also measures line-combination age from `asOfDate`. At +6 days, a team whose latest combo is 16–21 days old today gets the hard-stale fallback skater list, and teams 5 or more days old get the soft-stale warning. The run doesn't fail; its inputs are degraded. The same anchor would fix it, but that file is outside this lease.

## Files

- `91a1124fb7e0578997940c2e0a4feb38e772a3926b165b78524922ad25aab59d`  web/pages/api/v1/db/run-projection-v2.ts
- `a60bf611a82ca7be171fd457fe88e5c97d676af58b5001d0af0d2f92f108a3c4`  web/__tests__/pages/api/v1/db/run-projection-v2.preflight.test.ts

Scratch closure receipt (not in the repo): `anchor-closure-receipt.json`, sha256 `ff91c19343f8c9d3fe3498895415bc95a2dbf14c785fde291871be280d745b8e`.

Diary: `tasks/diaries/2026-10-26-claude-prov-guard.md`. This receipt is the only other new file.
