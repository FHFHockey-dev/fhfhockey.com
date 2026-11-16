# Pilot capture 2: game 2026020327 (FLA @ DAL): stopped at the pin, no claim

- **Approval:** TJ's pop-up, retry unchanged on the next eligible game. Candidate `6562138932`, attended launch about 30 minutes after approval.
- **Private receipt:** `~/forge-pilot/capture-2026020327-20261115T151531Z/capture-receipt.json`.

## Result
| | |
| --- | --- |
| Outcome | none recorded. Pre-claim failures are retryable by design, so no outcome row exists for 2026020327. |
| Reason | `pin_failed:Issued FORGE context read was incomplete` |
| Timings | pin 10,513 ms, total 10,513 ms |
| Claim / save / TSA | none / none / none |

## Cause: this Mac's network/DNS, not FORGE data
- **Gate (15:15:01Z):** `psql: could not translate host name "aws-0-us-east-1.pooler.supabase.com" … nodename nor servname provided`. Name resolution was failing on the operator Mac.
- **Supabase edge logs** (TJ-approved, read-only, 15:15:25–15:16:10Z, filtered to `games`, `roster_optimizer_team_games`, `rosters`, `fhfh_player_identities`): **no request from the pin reached Supabase** during the run (15:15:31–15:16:05Z). The only matches are four GETs of a different `games` query shape from another node client at 15:16:09Z, after the run ended.
- The issued-context reader turns failed reads into "read was incomplete", so the receipt hid the transport cause. The macOS unified log had no entries for the window (header only), so there is no further local evidence.

## Operator error (Claude)
**The pre-launch gate failed open.** It parsed psql's error text as numbers and let the launch proceed. No harm resulted (the pin is read-only and failed before any claim), but the launch broke the stated stop condition.

## Fixes (offline, tested; new candidate)
- **Gate:** `operator/gate.sh` fails closed on any psql error or malformed output, and checks that the Supabase API and TSA hosts resolve. `operator/launch-capture.sh` launches only after the gate passes. Self-tests (unresolvable hosts, no production query): gate exit 7, launch refused.
- **Receipts** now say what failed:
  - Transport refusals keep the database error code (e.g. `http_status:500:57014:canceling statement due to statement timeout`) and the network cause code (e.g. `http_error:fetch failed:ENOTFOUND`).
  - Pin and collect errors carry those refusals first: `[transport …] <reader message>`.

**Per TJ:** neither 2026020326 nor 2026020327 is retried.
