# Schedule cron — master patch (R9) + octoberBranch cron line

- Scope: Chef ticket. Build tasks/artifacts/release-r9-2026-10-20/SCHEDULE-CRON-master.patch on origin/master c2ed28384: daily route + test, witness slice, D3/R4, vercel.json `52 8,14 * * *`; add the same cron line to octoberBranch working tree. No commit/stage.
- Where: octoberBranch HEAD e24b43712 (D3/R4 in 25b63771d). Scratch export under the session scratchpad.

## Decisions
- planningInputs: port hasScheduleCoverage + source_metadata column + coverage problem; EXCLUDE the scheduleRevision ISO-hash hunk (from 7f094c8e6 big commit; master issuedContext hashes raw start_time — G1 §1 hazard H).
- recurring.ts is absent on master (added by 7f094c8e6) but the daily route imports it → ship as new file, unchanged (it has no native-admission content; its "Proposal only" comment is stale — flagged, not edited).
- normalize.ts/normalize.test.ts identical on master → no hunks.
- Vercel crons 27 → 28 in both trees; inventory/audit-wrapper test counts bumped per tree.

## State / checks (done; nothing committed)
- Patch: tasks/artifacts/release-r9-2026-10-20/SCHEDULE-CRON-master.patch, sha256 d564f55953191691e53bfcf74352a04404174e7d1de6d2d1dd77b07d9012d067, 17 files, no generated paths.
- Extra master-only test edits needed for green: planning.test.ts (port octoberBranch witness tests + freshness-test rewrite), start-chart.test.ts (stamp witness in sharedAdmissionInputs; else incomplete_refresh double-counts 2≠1).
- Master export: apply-check OK; 337 files / 4131 tests pass, 1 fail = update-line-sources needs a tasks/ fixture (fails identically on pristine master). tsc exit 0 (lock).
- octoberBranch: vercel.json cron added; combinedCronInventory 28/86, cron-audit-wrappers 28/19/15; 87 inventory tests pass; tsc exit 0.
- G1 guard on temp-index candidate 5203d80ba: PASS with G1_BASE=c2ed28384; default R6f base FAILS check 4 only on node_modules/.vite/vitest/…/results.json already tracked in master c2ed28384 (pristine master fails the same).
- Next: Chef decision on Start Chart degraded-until-first-run behaviour and the stray master cache file; then release.

## Gotchas
- Master start-chart.ts calls loadPlanningInputs; with serving on, a slate date without fresh witnessed rows records incomplete_refresh → forecast_admission_incomplete (degraded). Serving of admitted players unchanged in tests.
- Release order: once master readers require the witness, production RSO schedule shows "coverage unverified" until the first daily run (08:52/14:52 UTC) or a manual refresh writes witnessed rows.
