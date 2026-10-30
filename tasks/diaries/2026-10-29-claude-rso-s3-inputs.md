# 2026-10-29 Claude RSO S3 inputs (lane RSO-S3-SCENARIO)

- **Scope:** S3 of VORP: offline data side of the later-impact scenario (contract v2, sha256 2f31491a…). New `web/lib/rosterScheduleData/laterImpactInputs.ts`(+test), flag-off wiring in `rosterScheduleData/planning.ts`, scenario payload schema in transport/workspaceSchema, byte budgets, `VORP/S3/` harness + RECEIPT. Fixtures only; no commit.
- **Where:** `/Users/tim/Code/fhfhockey.com` on `octoberBranch`, base `9d70700ab`.
- **State:** all 12 tracked lease baselines verified OK (sha256) before any edit; the two new files and S3/ were absent.
- **Next:** read planning.ts / transport / workspaceSchema / futureImpact, design the inputs module.
- **Blockers:** none.
- **Gotchas:** `rosterScheduleOptimizer/planning.ts` read-only (S2 hook final). Never GIT_DIR in tests. tsc under `/private/tmp/fhfh-heavy.lock`.
- **Checkpoint (code written):** `laterImpactInputs.ts`(+test, 32 tests pass), scenario schema in `workspaceSchema.ts` (snapshot optional field), transport optional field, `forgeDailyBridge.ts` (`forgeNativeLine`, optional `capture` callback), `planning.ts` flag wiring, `futureImpact.ts` (`reconstruction: boolean|null`, exported `blocked`). Flag test in `planning.test.ts` passes.
- **Decisions:** `yahoo_matchup_weeks` has no league key → never league proof → assumed fallback (labelled); league-keyed rows or caller `leaguePeriods` give actual. FORGE lineup rows have no conditioning column → real data is `conditioning_unknown` (honest unknown); reserve rows → labelled conservative zero. Input cutoff/replay class only from captured input snapshots (prod capture off → `missing_timestamp`). `LATER_IMPACT_CONTRACT.accepted` stays false: app path still `scenario_contract_not_accepted`; tests use `offlineFixture`.
- **Bytes (fixture, full catalog):** scenario 477,780 B; base body 2,140,863; combined 2,618,666 (+120,000 margin) ≤ 4,000,000.
- **Next:** full touched suites, eslint, tsc (lock), S3 harness, RECEIPT.
- **Checks (18:16Z):** eslint 9 files exit 0; tsc under lock (18:15:13–18:16:29Z) exit 0 (currentNhl.test.ts error no longer present); first full suite 1852/1853 with the known 1000-player 13-day timing test failing while tsc ran concurrently (passes alone).
- **Harness:** VORP/S3/run-isolation-harness.sh (baseline 9d70700ab). Engine and bridge: 0 mismatches off/on. loadPlanningData: 3 off / 3 on mismatches in two runs, all after timed-out tests — straggler tripled loaders toggling the env flag; alone they match (baseline self-check true). Fix: harness testTimeout 120000; rerun pending.
- **Gotcha:** zsh `"$BASE:web"` is a modifier; use `${BASE}:web`.
- **Final (18:5xZ):** harness rerun at testTimeout 120 s: engine, bridge 0/0; loadPlanningData 1/1, the accepted-news test whose stateful mock makes baseline≠baseline (self-check). Full suite alone: 64 files, 1,853 passed. RECEIPT.md written with hashes. Nothing committed; the orchestrator commits. Diary kept until the orchestrator records the commit.
- **Next (orchestrator):** review the RECEIPT, commit the explicit paths, release the lease. Real-data numbers need source changes (FORGE conditioning tag, input snapshots, league-keyed periods), each needing owner approval.
