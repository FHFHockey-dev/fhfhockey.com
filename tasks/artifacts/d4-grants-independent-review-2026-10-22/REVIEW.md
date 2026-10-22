# D4 harness repair: independent review

**Qualified local acceptance of the harness/matrix repair. No concrete new defect found.** This accepts the pinned source repair and its offline preflight behavior. It does not certify the fresh SQL replay, migrations for deployment, PostgREST/JWT behavior, hosted ACLs or application access.

## Boundary and integrity

Reviewed `harness.py`, `test_harness.py`, `supabase/tests/data_api_grants.sql`, the repair report/verification, migration authority, migrations 89–90, historical v7 TAP/ACL receipts and blocked v9 receipt. Bootstrap/pgTAP shim and companion assertion files were inspected only as bounded harness dependencies. No repeated application or billing audit.

Canonical checkout: `octoberBranch`, HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15`. This is a later checkout than the earlier A1–A10 audit; its receipts are not being presented as this D4 candidate's verification.

All three candidate hashes match the implementer receipt, at start and end:

| File | SHA-256 |
|---|---|
| `tasks/artifacts/d4-grants-2026-10-20/harness.py` | `7bd2f9803c5feb42c79cb93d671ee87bd6e2c76c3b138172618e508e03e96626` |
| `tasks/artifacts/d4-grants-2026-10-20/test_harness.py` | `e73b8c77bf6acdac9d5a0a23ccc5d45f1b266ffb72e8e4cf05041df416dddc0d` |
| `supabase/tests/data_api_grants.sql` | `d20ca21d8c4b5a0ce1b56d7cb102a1daf36e8c601f94a210c77dd6b93341424f` |

All **97 canonical migration hashes** match authority. The independently generated preflight is exactly equal to the supplied repair preflight, including **106 source hashes**, all stable at the closing check. Authority and migration bytes were not changed. See [start-integrity.json](start-integrity.json), [preflight.json](preflight.json) and [end-integrity.json](end-integrity.json).

## Review decisions

- **Order is preserved.** `harness.py:40–64` verifies contiguous unique canonical entries and hashes, pins defaults/reviewed grants at 89–90, and constructs prefix + pair + suffix. Runtime replay at `:186–196` follows **1–88 → 89–90 → 91–97**, then checks the observed first-pass order. Negative mode omits only 89–90; snapshot-only mode retains the whole chain. Reapplication is separate from the first-pass order.
- **All 66 stale expectations reconcile to denials.** The independent static comparison covers the full **1,596 table-operation assertions**: 76 tables × three roles × seven operations. Current expectations equal migration 90's explicit grants after its revokes and the saved v7 ACL bits. Recovering the historical expected boolean from the saved TAP outcome/ACL bit identifies exactly **64 allow→deny table expectations**, with **zero browser changes and zero expansions**. The other two are denied service EXECUTE on `promote_player_forecast_model_atomic` and denied sequence SELECT, retaining USAGE. Their descriptions exactly equal the 66 historical failures and the repair list. This is a TAP/ACL reconciliation; no untracked historical SQL source diff is claimed.
- **Least-privilege checks remain meaningful.** `data_api_grants.sql:88–94` still checks every allowed and denied table operation and RLS. All 46 RPCs retain browser EXECUTE denial and no inherited PUBLIC EXECUTE; exactly 45 allow service execution, and promotion remains explicitly denied (`:145–153`). Sequence UPDATE and browser sequence access remain denied (`:155–156`). Private-schema denial and INVOKER/DEFINER boundary checks remain (`:158–161`). The expected matrix remains **1,870 assertions**, not a reduced set that drops the failing cases. The existing runtime isolation/native-CAS/default-privilege companion suites remain in the harness; this review does not execute them.
- **Failure exemptions are gone.** `harness.py:210–226` requires a single matching TAP plan, exit 0, no `not ok`, and no bail-out. It retains the entire failure list/count; the old reviewed-deviation allowlist and 50-failure truncation are absent. The existing workspace fixture contributes to the overall gate. Failed overall status exits 1 (`:258`). Evaluating only these pure classifier statements against the saved v7 TAP rejects and retains all 66 failures; additional synthetic clean, formerly exempt, missing-plan, duplicate-plan, truncated-plan, nonzero-exit and bail-out probes all behave as expected.
- **Execution bounds remain explicit.** The harness snapshots input bytes before cluster creation, uses socket-only psql and a minimal environment, and has 60-second command/300-second run bounds. Lock acquisition fails rather than waiting on or deleting another worker's lock. Normal shutdown uncertainty retains the cluster/lock and forces failure. These are source observations; this pass did not exercise process startup, shutdown, timeouts or OS resource handling.

No additional fix is proposed by this review. The next useful action is runtime acceptance in a separately permitted isolated environment, followed by the platform-specific gates below.

## Checks actually performed

| Check | Result |
|---|---|
| Provided `test_harness.py` preflight regressions | **6 passed**, exit 0 |
| Direct `harness.py ... --check` | Passed; exact repair preflight match; no run directory created |
| Independent migration/matrix/TAP reconciliation | Passed: 97 migration hashes; 76 tables; 45 service RPC grants; exact 66 historical reconciliations |
| Pure TAP classifier probes | **8 cases matched expectations**, including historical v7 rejection |
| Python syntax via `ast.parse` | Passed for harness and test file; no bytecode generated |
| Focused `git diff --check` | Passed |
| Final candidate/authority/source integrity | Stable |

Reproduction commands and limits are in [COMMANDS.md](COMMANDS.md). The independent parser initially matched across semicolon boundaries in migration SQL; correcting that reviewer-only parser resolved its assertion failure. No candidate change or unexplained failing check resulted. The reconciliation code and results are retained for inspection.

## Open gates and exact blocker

**Fresh SQL replay remains blocked; it was not retried.** The historical action was `/opt/homebrew/opt/postgresql@17/bin/initdb -D /private/tmp/fhfh-d4-_g17pzx7/data -U postgres -A trust --no-locale -E UTF8`. The macOS sandbox denied `shmget(..., size=56, ...)` with “Operation not permitted.” This was runtime sandbox enforcement, not automatic approval-review rejection. The saved v9 receipt has `passed:false`, `postgres:null`, `firstPassOrder:[]`, `steps:[]`, `tests:{}`, `clusterStopped:true`, `clusterRemoved:true`. No application bootstrap/migration/test SQL ran. This pass made no new initialization, database connection, escalation or bypass attempt.

Before calling the harness runtime-accepted, obtain fresh positive and negative runs in a permitted disposable cluster with the same pinned inputs. Positive acceptance needs all four TAP suites (expected **1870, 34, 10, 205**), workspace fixture exit 0, unchanged ACLs after reapplication, exact first-pass order and confirmed cleanup. Negative acceptance needs the intended chain/tests to complete and D4 failures to be reported with exit 1; initialization failure is not a successful negative control.

**PG15/platform-extension parity, real PostgREST/JWT requests, hosted catalog checks and hosted/application acceptance remain open.** Homebrew PG17 stand-ins and the documented view-definition exception cannot close those gates. No migration publish, production action, schedule-RPC implementation or payment work is authorized by this review.

This read-only review is complete. Only the separate review artifact directory and task diary were written. Application code, candidate harness/tests, migration authority, all migrations, historical receipts and concurrent work were preserved.
