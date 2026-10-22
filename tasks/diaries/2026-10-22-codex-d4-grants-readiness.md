# D4 / October 30 grant readiness

- Scope: read-only local review of D4 explicit grants, isolated PostgreSQL evidence, hosted/PostgREST acceptance gaps, least privilege, and safe rollout; no production/credentials/paid calls, migration application, commits, or canonical-register edits.
- Where: canonical checkout `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, starting HEAD `a811b0762ffe29006c3df7eaa4c19bf18deecda3`. Preserve all existing changes, especially reviewed billing/forecast lanes.
- Start: read AGENTS.md; inspected Git status; located D4 artifacts and migration authority references. Supabase skill loaded for security boundaries, with user's local-only restriction controlling this review.
- Next: inspect current handoffs, migrations 89–90, caller matrix, and isolated receipts; report exact remaining acceptance blockers to parent/ledger owner.
- Blockers/approvals: hosted execution is outside scope and not requested; no action denied or attempted.
- Gotcha: payment/invoice work belongs to TJ and is separate from October 30 grant readiness. No further workers.

## Checkpoint
- Authority has 97 entries; D4 orders 89–90 still `pending`, both source SHA-256 values match authority. All 88 SQL hashes from October 20 still match current files.
- Independently recounted stored TAP: v7 operational 205/205, defaults 34/34, RSO 10/10, older matrix 1804 pass + 66 reviewed failures; v8 negative control has 121/34/72 failures respectively. v7 ACL snapshots are byte-identical after reapply. These are historical PG17.11 receipts, not tests executed today.
- New local blocker: harness.py:35 requires D4 at ledger tail; current 97-entry authority makes that condition false. Must support in-place 89–90 replay plus 91–97, not reorder ledger. Older matrix still emits 66 `not ok` lines; align it with reviewed narrowing for ordinary pgTAP acceptance.
- Acceptance not proved: real PG15/Supabase/PostgREST/JWT behavior, current callers after October 20, hosted defaults/ACL/ownership/memberships/exposed-schema settings. Creator defaults cover only postgres; global PUBLIC function revoke reaches every schema. Schema CREATE and other creators require explicit assessment.
- Later canonical object-creating migrations 92/95/97 include explicit RPC/table/view grants. Sandbox billing SQL also explicitly gates RPC execution and uses DEFINER grant writes; no edits or payment diagnosis performed.
- Existing source gap persists: schedule refresh calls commit_recurring_roster_schedule, defined only in a task draft, absent from canonical migrations. Record as schema/caller reconciliation, not evidence of hosted outage.
- Next: finish a bounded read-only consistency check and return acceptance checklist and local next work under existing D4; no new canonical task IDs/register changes.

## Handoff
- Review complete; D4 stays open for refreshed isolated acceptance, real PostgREST/JWT tests, and separately authorized hosted catalog checks/application of orders 89–90.
- Today's checks: source hashes match (88 historical + 2 D4 authority hashes); stored TAP counts and ACL reapply equality verified; static harness-tail condition proved false; targeted `git diff --check` passed. No DB, test harness, application suite, credentials, network, production, deployment, or paid action executed.
- Source spot-check: current workspace API uses server-derived user/context/version filtering and only SELECT/INSERT/UPDATE. `workspaceRoutes.test.ts` has mocked boundary tests; these do not prove HTTP/hosted acceptance. Historical v7 ACL CSV confirms 178 relations still have all seven browser privileges; live exploitability/RLS is not established.
- Recommended rollout: fix harness at canonical insertion point, reconcile old expected matrix, test current chain and exact role behavior in disposable stack, bind candidate hashes, separately authorize metadata-only hosted diff and exact two migrations (89 then 90), preserve exact pre-change ACL/default inverse, stop on any schema mismatch or timeout. Do not use a generic push of all pending migrations (71/77/88 also pending).
- Parent receives findings in final response; ledger owner retains canonical register ownership. No action was denied, pending in a tool, or left with uncertain execution. Hosted work was intentionally not attempted under the local-only instruction. Diary retained because acceptance is unfinished/handed off.

## Local implementation authorized
- Parent follow-up authorizes D4 harness/tests/artifacts repair plus a bounded fresh disposable local replay; no existing database, migration source/authority edit, network, credentials, installs, schedule RPC implementation, or hosted action.
- Starting HEAD remains `a811b0762ffe29006c3df7eaa4c19bf18deecda3`. D4 owned files have no new tracked modifications; 97 migration hashes all match authority. Existing PostgreSQL 17.11 tools are available, and the heavy lock is absent.
- Plan: enforce the exact 89–90 contiguous pair and prefix/suffix ordering, hash-bind replay/test inputs, reconcile 66 matrix expectations to the reviewed narrowing, remove failure filtering, and run fresh positive/negative socket-only clusters with bounded commands and cleanup receipts. Keep historical receipts untouched.

## Repair checkpoint and handoff
- Implemented exact-order/hash guards, prefix/D4/suffix replay, read-only preflight, no failure filtering, complete failure receipts, bounded commands and cleanup checks. Reconciled matrix to migration 90: 64 table expectations + promotion EXECUTE + sequence SELECT; no browser change or privilege expansion.
- Passed 6 read-only preflight regressions, syntax, focused diff checks; offline comparison confirms 76 table expectations and 45 RPC grants match migration 90 and the changed set equals all 66 old v7 failures. All 97 migration hashes remain intact.
- Fresh run-v9 blocked in initdb by sandbox `shmget` permission denial, before any SQL; stopped/removed true, lock absent. Negative SQL replay not attempted because the same initialization would fail. No escalation/automatic approval review was invoked.
- Review artifacts: `tasks/artifacts/d4-grants-2026-10-20/repair-2026-10-22/REPORT.md`, `verification.json`, `preflight.json`; fresh failure receipt `run-v9/receipt.json`. Harness SHA `7bd2f9803c5feb42c79cb93d671ee87bd6e2c76c3b138172618e508e03e96626`; matrix SHA `d20ca21d8c4b5a0ce1b56d7cb102a1daf36e8c601f94a210c77dd6b93341424f`.
- Next: independent review, then fresh positive/negative replay in a local execution context permitting PostgreSQL shared memory and Unix sockets. PG15/PostgREST and hosted gates remain open. No migration, authority, application, billing/forecast or schedule-RPC edits; no commits/network/credentials/hosted actions.
