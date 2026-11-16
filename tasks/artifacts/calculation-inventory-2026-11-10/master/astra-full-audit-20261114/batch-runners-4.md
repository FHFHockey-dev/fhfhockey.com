# Astra production runners — batch 4

2026-11-14; worker `gpt-6-astra/high`. Fully read the last two executable files, **226 lines**, in path order. Both match `89da739cb`. Cumulative source coverage is **54/54 files, 8,584 lines**; no production executable inventory entry remains unread. Source review is not current production qualification or transitive audit of all imported applications.

| Source relative to `production/` | Lines | SHA-256 |
|---|---:|---|
| `rolling-resume/rolling-resume-slow.py` | 113 | `c655915db71fb993326a5af39ff21000e088f7f489c9a5922e35b3c1c8bb7869` |
| `trend-bands-2026-11-13/trend-bands-history.py` | 113 | `5fa8432214ab53024649aa822492ac0b797f996104c46563d26f0331e9e12f6d` |

## Findings

### AFULL-OPS-11 — P1 — Rolling completion accepts remaining players and an unchanged resume cursor repeats indefinitely

- **Location:** `rolling-resume-slow.py:94–113`, especially :108–112; fixed scope :12; claimed sequential resume/stop contract :2–3.
- **Claim checked:** FORGE-INPUTS-PLAN-2026-11-13.md:23–34 requires bounded, sequential resumable recompute of 764 players and final date/strength readback; :56–66 records the approved slower eight-player continuation and remaining-zero completion.
- **Evidence:** unchanged top-level control-flow AST from line 72 onward, with all calls, guard, time, logging and process exits replaced by local fakes. Imports, secret read and HTTP functions were never executed.
- **Minimal inputs → wrong outputs:** (1) one HTTP200 response with nonempty runSummary, `remainingPlayerCount=7`, `nextResumeFrom=None`, one processed player/five rows → logs **DONE**. It treats absent next cursor as completion even though seven remain. (2) start cursor 100; HTTP200 repeatedly reports seven remaining, zero processed and `nextResumeFrom=100` → calls cursor 100 three times; the audit's external three-call cap stopped it, while the runner has no cursor-progress or total-call guard. (3) `success:false` with nonempty runSummary and remaining zero also logs DONE; success is logged but not gated. Expected: contradictory completion, failed status and nonadvancing cursors stop as uncertain outcomes, preserving the current cursor.
- **Suggested correction:** require the route's documented successful/partial-success contract; validate nonnegative counts and remaining/cursor consistency. Completion must explicitly establish zero remaining. Any continuation must make a permitted strictly advancing cursor transition with progress; stop duplicates/backward cursors and cap attempts against the approved roster/batch budget. Keep uncertain-write reconciliation before retry; do not discard the accepted freshness-bypass policy.
- **Readers affected:** operational completion and resume decisions for rolling support/metric writes. If a bad cursor is repeated, unnecessary writes continue at 60-second gaps until another stop is hit. No retained real response demonstrates these cases. The plan's final 764-player readback remains repository-reported evidence rather than invalidated history.

### AFULL-OPS-12 — P1 — Trend-history runner labels an unexpectedly empty rebuild DONE

- **Location:** `trend-bands-history.py:15`, :85–113, especially :108–113.
- **Claim checked:** queue :220–221 approves and reports a frozen 769-player, ten-per-call history pass; source :15 carries that count. The older REMAINING-PRODUCTION-PLAN-2026-11-13.md:34–38 proposed 764, subsequently revised in the queue.
- **Evidence:** unchanged loop AST from line 79 onward, local fake endpoint and clock only; no secret read, DB or HTTP.
- **Minimal input → wrong output:** at offset zero with TOTAL_PLAYERS=769, return HTTP200 `{success:true, dry_run:false, processed:0, updated_bands:0, errors:[]}` in one second → runner logs **DONE, calls=1, players=0, updated_bands=0** and exits normally. Expected: an empty population before the frozen bound is an explicit mismatch/uncertain result, not successful completion of the approved history rebuild.
- **Suggested correction:** validate each page's expected identities/count against a frozen roster or explicit server completion token; require final accounted population to match the approved scope before DONE. A legitimate roster revision or empty result should stop for reconciliation and recorded revised scope, not silently change the contract. Manual offset resumes need an explicit already-completed prefix rather than requiring that invocation's processed total alone to equal all 769.
- **Readers affected:** trend-history completion evidence and subsequent scheduling of production steps. This is a missing completion guard, **not proof of missing bands in the actual run**. Queue :221 separately reports 77 calls, 769 players and sampled snapshot readback; no original response log is retained in this folder.

## Safety, definitions and receipt comparison

| Runner | Bounds and stop behavior | Resume, idempotence and limitations |
|---|---|---|
| rolling | Fixed 2026-09-29..11-11, maxPlayers=8, maxRuntimeMs=200000, bypassFreshnessBlockers=true. Header's “20 players” is stale. Each call guard requires active<=5, longest<=10, no lock/IO waits, probe<1.5 s; read-only SQL 8 s/process timeout60 s. HTTP timeout260 s; post-response stop >200 s or two >120 s. Non-200/207 or empty summary stops. 60 s gaps | Manual initial player cursor; no durable done ledger. Partial/abandoned players are assumed to lie after next cursor, not independently enumerated. No local row readback. Source default is live, not dry/execute gated; historical authorization is in the plan. Upsert idempotence is a route/DB claim outside this runner. OPS-11. Suspicious-output warnings and freshness blockers are counted/logged rather than stopped, consistent with recorded bypass decision |
| trend | Frozen 769 players, offset pages10, season20262027, 09-29..11-12, game_limit160, dry=false. Same DB guard and timeout settings; requires HTTP200, success is True, dry_run is False, no per-player errors. Post-response slow stop >60 s; HTTP timeout280 s. 60 s gaps | Fixed START_AT and one dated pause on Nov13; they do not protect a later-day rerun. Manual offset; no row manifest, durable done marker or DB readback. Pagination can drift if underlying roster changes. A slow successful response prints next_offset=offset+10, not proof that all ten were processed. OPS-12. Route upsert/delete semantics and numerical band calculations are outside this file |

The rolling cron-window check runs before the guard/call, not as a reservation: guard waits and a long call may cross the next excluded boundary. It blocks 08:00–08:20, 09:25–11:00 UTC, but does not encode the later root remaining-plan's 11:15–11:40 window. Its probe threshold 1.5 s differs from the original FORGE plan's 1 s; late queue/plan attributes slower resumptions to TJ but does not reproduce every revised guard parameter. Twelve guard iterations with 20 s sleeps are **not a four-minute wall-time cap**, because each DB process can take up to 60 s. Treat these as recorded implementation/plan differences, not established historical violations.

Both scripts read CRON_SECRET at top level and use it only in Authorization headers; log fields omit it. Importing them normally is therefore not a safe audit technique. Neither invokes NST or another provider directly. FORGE plan :25 says rolling reads existing DB sources only; endpoint transitive behavior was not rerun or independently recertified. Neither runner computes hockey statistics locally: arithmetic is counters, durations, cursor/offset progression and scheduling.

**Retained evidence:** these two directories contain their runner only (plus excluded Python cache). FORGE-INPUTS-PLAN-2026-11-13.md:42–66 attributes bypass and each resume to TJ, documents the 201.4 s stop, then 32 final calls/252 remaining players with max46 s and zero remaining. Its :63–66 reports 10,727 rows per strength, 764 players, date-gap and sampled payload checks. Queue :187 agrees. Queue :220–221 attributes “Later, paced,” 77 calls, 769 players, 666,376 bands, max9.5 s and snapshot-date samples. These are **repository narratives**, not primary pop-up transcripts or original machine run logs. The absence of those primary records does not prove lack of approval or corruption.

## Verification and boundary

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin TMPDIR=/tmp python3 -I -B /tmp/astra-prod4-probe.py > /tmp/astra-prod4-probe-output.json
```

Exited 0; all four negative control-flow cases above reproduced. Probe SHA-256 `1841c2950b5cd764c8cc541df49aa6e4e55887920ee3e95abcd39f67f9865287`; output `f603320c4ee8e42fc3428b25885d35e39c317df2bbb153b3e29becc956725fa5`. Source hashes independently compared with `git show 89da739cb:<exact path>` and match. No runner imports/top-level setup with real dependencies, HTTP/DB/provider calls, browser/auth work, application/test edits, commits or production verification.

Complete source inventory does not close missing raw receipts, primary approvals, source-to-deployment proof, imported app/SQL correctness, reader coverage, predictive qualification or future natural-run evidence. Chef owns finding disposition and canonical integration.
