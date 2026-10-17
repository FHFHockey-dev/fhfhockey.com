# Live v1 daily FORGE run: 2026-10-20

**Status.** An independent reviewer reviewed this twice, and the second pass found nothing blocking. The gate is the target-date replay at Oct 20 clocks (`daily-dry-run.ts` → `$P/daily-dry-run-20261020-replay-v1/`):
- 100 of 1,260 participation receipts null, matching the Oct 16 baseline
- reviewed plan valid at 104 rows
- cadence command valid
- expiry 22:59:59.999Z

The future weeks in that replay are re-sliced from retained games, so the live schedule and roster shapes are first exercised on the day. The plan, run-date and coverage gates stop a malformed capture before materialize.

**Authority:** TJ's 2026-10-17 approval (session chat). It covers:
1. provider reads only (NHL rosters, boxscores, landings, schedule, read-only Yahoo), bounded like Oct 16, with no Yahoo transactions
2. materialize execute: inserts into `player_forecast_source_observations` only, ≤1,320 requests, ≤180 s
3. publish plus one catalog-head CAS, after review
4. ≤5 read-only consumer readback requests

The review is done by a separate reviewer agent. The publish decision is Chef's. Scheduler binding and public activation are **not** approved and are not part of this runbook.

**Why this date:** 11 games and 15 owned players play on Oct 20. The due time is 08:00 ET (12:00Z). The first game is 23:00Z, per the retained schedule; the fresh capture confirms it.

Throughout, `P=/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1`, `R=$P/daily-acquisition-contract-20261016-v1/retained-materialization-request.json`, and each `--out` is a new directory `$P/daily-20261020-v1/<stage>`. Commands run from `web/` with `NODE_PATH="$PWD" NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}'`.

| # | When (ET) | Step | Network / DB | Stop if |
|---|---|---|---|---|
| 0 | before 07:00 | Read-only head check: `native_forecast_catalog_heads` has 0 rows; RPC present | 1 SQL read | Table missing or not empty |
| 1 | 07:00 | `forge-daily.ts capture --retained $R … --date 2026-10-20 --weeks 8 --execute true`: 27 club rosters, the 2 frozen-window weeks (Sep 29, Oct 6; games ≤ Oct 12 only, nothing reserved) and 8 future weeks. 37 GETs serial, 1 s spacing, 8 s timeout, ≤8 MiB total, no retries | 37 NHL GETs | Any failure. Reconcile the ledger; no retry without a new decision |
| 2 | 07:05 | `forge-daily.ts inputs …`: offline. Gates: capture equals plan, taken on the run date, frame unchanged, every club roster present. Prints cutoff, coverage, participation inputs, closure scope | none | Any gate failure |
| 3 | 07:10 | `native-baseline-cadence.ts materialize --input <inputs>/materialization-request.json …`, dry first, then with `--execute-target https://fyhftlxokyjtpndbkfse.supabase.co --execute-intent "forge-daily-v1 2026-10-20 inputs per TJ approval 2026-10-17"` | ≤1,320 requests, ≤180 s, inserts only | Status other than `closed`. Run a read-only reconcile before anything else |
| 4 | ≥08:00 | `forge-daily.ts outputs --command <inputs>/preparation-command.json --proof <materialize>/stage.json --reviewed <reviewed-native.json> --approval-ref "tj-chat-2026-10-17:forge-daily-v1" --max-null-participation 100`. Pinned to the Oct 16 baseline, which the Oct 20-clock replay also hit exactly. If it trips, stop and inspect the new null reasons; the gate is not raised without a stated reason | none | Any refusal, including the null gate |
| 5 | 08:05 | Independent reviewer agent reviews `pending-plan.json`, coverage and receipts, and writes `native-daily-review-decision-v1` with `planHash` | none | Reject: no publication. Report to TJ |
| 6 | 08:20 | **Chef publish decision.** If usable: `forge-daily.ts review … --head-id <new uuid> --expected-revision 0 --expected-hash null`, then `native-baseline-cadence.ts publish` (dry → `--execute-target … --approved-package-hash <dry packageHash>`) | journaled inserts plus one CAS | Any `held`, `stopped` or `unknown` result. Read-only reconcile, no retry |
| 7 | after publish | Local readback (isolated `.next-player-forecasts`, env `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID=<head>`): FORGE next-20, Start Chart API, RSO data, Start Chart UI plus its API call. Exactly 5 requests | 5 GETs | Any request outside that list |

Publication has to complete before the daily expiry, which is the earlier of issuance + 12 h and the first bound game − 1 ms (about 22:59:59.999Z).

## Known limits, disclosed in the plan review and to TJ

- **Native means are frozen at their Oct 16 cutoffs.** History through Oct 12; reserved experiment games are excluded until the Oct 28 readout. They are re-issued unchanged under a new stated expiry, with the same approved candidate hashes.
- **Participation** uses the frozen Sep 29–Oct 12 window under the roster-continuation assumption. The method accepts cutoffs only until 2026-10-27 04:00Z.
- **Fiala (9572) keeps `knownConflict=true`** from the Oct 16 Yahoo injury report. The other players keep `null` (unknown, not healthy). There is no fresh Yahoo injury read in v1.
- **11 of the 69 players have native means only.** They had no frozen participation history on Oct 16.
- **No public activation.** Production has no catalog-head env var; only the local readback reads the head.
- **Carried conflict.** Fiala's carried conflict withholds his 20 receipts, labelled `known_current_roster_conflict`, from Oct 16 Yahoo evidence. It errs conservative; this goes in the run note.
- **Roster revisions.** Consumers require `rosterRevision` equality, and the means and receipts carry Oct 16 revisions. The readback (step 7) is where a mismatch would show as exclusions. Check it before relying on the selected catalog.
- **Injury coverage gap.** With the full Oct 16 mapping, the same Yahoo payloads list 12 players as IR, IR-LT or O (4 owned, 8 candidates) and 2 as DTD (`tasks/artifacts/forge-daily-automation-2026-10-17/INJURY-POLICY-PROPOSAL.md`). v1 carries only Fiala's conflict, so the other 11 IR/O players get receipts with an unknown conflict, not a withhold. Put this in the reviewer brief and the run note, and name those players if they get a non-null probability.
- **Serving horizons will likely read `incomplete_refresh`** (release review B2, `tasks/artifacts/forge-serving-release-review-2026-10-17/BLOCKERS.md`). Hosted schedule rows come from the production writer, which writes no `scheduleCoverage` witness, so consumers mark every horizon incomplete; the Oct 17 readback already showed `incomplete_refresh`. Step 7 can confirm the selected head, IDs and hashes, not served totals. That is expected and is not a run failure.
- **Run order.** Capture and inputs after 04:00Z (midnight ET, so the capture is dated the run day). Outputs after 12:00Z. Publish and the compare-and-swap before 22:59Z.
