# Independent NST writer review request

Review the local candidate without editing it or starting any external work. Do not run production NST/provider requests, hosted DB operations, migrations, schedules, builds, pushes or deployments. Automatic catch-up must remain disabled. Do not duplicate Social Share task 13.7/job task-mvy1nmhp-12z7mu: this is a separate writer review packet, not a launched review job.

## Exact candidate and evidence

Start with `LOCAL-CANDIDATE.json` and verify hashes. `candidate/` contains frozen copies of all 67 pinned source/test files. `LOCAL-CANDIDATE.diff` contains 59 writer deltas against the original preserved owner baselines; `CONTINUATION.diff` contains the 26 changed files from this caller-qualification continuation. Do not substitute the large shared checkout's Git diff, which includes unrelated owners' work. The recorded HEAD is context, not a release candidate SHA. This lane has not staged or committed anything.

Read `CALLER-MATRIX.md`, `FINAL-CHECKS.json`, `preparation-tests.log`, `preparation-types.log`, `preparation-lint.log`, `PYTHON-CHECKS.json` and `python-tests.log`. The final 440 JS tests passed after a local formatting edit accidentally removed four if(error) branches; those branches were restored, then scoped TypeScript/lint and the 440 tests passed. The Python result is 104 tests. Existing deprecation warnings are retained in logs. Scope is mocked I/O, not live provider or whole-project validation.

The unchanged migration `supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql` has SHA256 `f28c7923d36de3c2adc1f49cc40c087acdc1067fa66a10068bb88875e4033fa1`. Its prior isolated PG15.19 proof is `../pg-check-11/RESULT.json`: 17 scenario groups, including real concurrent locking, output/receipt rollback, finality, progress, token fencing and persistent holds. It was not reapplied in this continuation. The mandatory accepted shared-admission prerequisite is `/Users/tim/Documents/Codex/2026-10-27/task/accepted-local-handoff/sql/20261027_nst_shared_admission_v1.sql`, SHA256 `aefd3c20f2ff76328ef8b27e19244e438ad69a22ea1f9b5ef3cc1d6068784dce`; it is outside this lane's edit scope.

Custody is documented in `ALLOCATION.json`, `GAMELOG-TEST-ACCEPTANCE.json` and the parent handoff receipts. The global audit wrapper/test remain with Repair cron reporting pipeline; both source pins plus all 13 immutable accepted artifacts match (`PROTECTED-PINS.json`). No custody conflict remains for this candidate. Use the sole canonical checkout only. If running checks, first verify current source pins and obtain the shared `/private/tmp/fhfh-heavy.lock` without stealing it; use the existing offline verifier. The frozen snapshots are for review, not an extra editing checkout.

## Review questions

1. Does prerequisite-first SQL preserve accepted admission semantics, RLS/privileges and transactional output+receipt guarantees? Are lock ordering, direct/goalie exclusion, idempotency, conservative reservations and persistent expiry/hold behavior sound?
2. Does official finality capture fail closed on wrong/stale/partial slates and preserve an exact atomic evidence/cohort/enqueue transaction? Are explicit no-game days, WGO/reference limits, relief appearances and identity ambiguity handled honestly?
3. Does whole-job clearance really cover every supported caller's provider work, parsing, DB/audit work and response? Examine lazy cache hits/misses, concurrent miss begin, pending admission, late permits, detached async work, swallowed failures, deadlines, Python main decorators and authenticated proxy child tokens. Consider public cache-miss availability and durable holds on failed parsing.
4. Does the route/runner make durable catch-up progress across invocations without falsely claiming all ten-table completeness? Does the progress RPC/report detect two closed no-progress windows, held/expired jobs and unknown/disabled state without treating silence as success?
5. Are the tests meaningful for these contracts? Identify any missing scenario or unsupported caller before activation. Distinguish private-function fixture proof from complete legacy route execution. Historical scripts remain unlaunched/manual; unchanged date ranges, old one-row skips and identity mapping are not newly qualified data repair paths.

Return severity-ordered findings with precise file/line and a concrete failure path, followed by missing evidence and a clear local-candidate verdict. Do not infer production readiness from passing local tests. No independent verdict exists yet.

## Remaining rollout gates (all pending)

- Decide/verify the actual deployed caller inventory, including any external hosts/keys and historical/compatibility invocations. The bounded repository inventory cannot prove no external caller exists. Deployment must pair the web/function versions and lifecycle configuration. No route is silently retired.
- Independent review, then explicitly approved bounded hosted schema/dependency/privilege reads. Confirm/install the accepted prerequisite before the exact disabled migration. SQL changes have never been applied to production by this lane.
- Explicit approval for an exact release SHA, linked web/functions/CMS build inventory and deployment targets. Deploy disabled first. No candidate SHA or remote build exists from this lane.
- Separate approval for qualification fingerprint/time, lifecycle flags/enforcement, bootstrap date, reconciliation of old jobs, and goalie activation. A timeout/unknown acknowledgement does not clear automatically; review operational reconciliation/rollback procedures before enabling. Reverting application code alone while enforcement remains active can block legacy requests.
- Separate schedule approval for replacing job99 direct writer with bounded preparation and using the existing conditional runner within 08:30–08:35/11:10–12:50 UTC, preserving seven steps/60 reserved attempts/day and global windows. Settle actual report delivery: the earlier bounded read showed report234 inactive, not a proven replacement. No schedules changed.
- Explicit bounded live finality/source-shape and ten-table coverage acceptance. Any NST canary/backfill needs its own exact date/request/retry/write/runtime budget; none is approved or run here. Production throughput is unmeasured; 24 dataset units/day is a conservative local ceiling for large cohorts, not a forecast.

Until these gates are met, keep `NST_JOB_LIFECYCLE_ENABLED` off, `nst_job_control.enforced=false`, and `nst_goalie_control.enabled=false`. No current live-state read was performed in this continuation. The earlier backlog assessment and ten-table dispositions remain the last evidence; a backfill decision needs fresh separately authorized coverage, not elapsed time alone.
