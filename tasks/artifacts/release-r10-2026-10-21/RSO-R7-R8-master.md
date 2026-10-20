# R10 candidate piece: RSO R7 + R8 (retention caution, W2 ownership provenance, whole-swap category gains)

**Status:** patch only. Built and verified in a scratch `git archive` of `origin/master` = `b5e801d8f` (R9, live). Nothing was committed, pushed or deployed.

| File | sha256 |
|---|---|
| `RSO-R7-R8-master.patch` | `a6a68f97e797430cedcf68424f0b8c3b22dd7c50e559956f9bd0b5d9cd59b9e7` |

Source: octoberBranch `dad7c619f`. The patch is 27 files, +717 −87. The PNGs are not included.

## How it was built
- **20 files taken whole from `dad7c619f`:** `rosterScheduleOptimizer/*` (except `planningTypes.ts` and `dailyDecisionReplay.test.ts`) and the RSO components and their tests. On master each of these is byte-identical to `dad7c619f^`, or is new.
- **7 files whose master version differs from `dad7c619f^`, ported hunk by hunk:**
  - These applied cleanly: `RosterScheduleOptimizer.tsx`, `in-season/workspaceSchema.ts`, `workspaceSchema.test.ts`, `workspaceRoutes.test.ts`, `rosterScheduleData/planning.ts`, `dailyDecisionReplay.test.ts`, `planningTypes.ts`.
  - `rosterScheduleData/planning.test.ts` had different context on master. Its single new W2 test was inserted by hand after `publicOptions`.
- **What `rosterScheduleData/planning.ts` changes:** only the ownership parse and the stale-evidence lines.
  - Master's `consumerRevisionAdmission` imports are unchanged.
  - Nothing comes in from the branch label gate, the ISO hash or native admission.

## Checks (scratch export + patch; Node 22.11.0, no `GIT_DIR`)
| Check | Result |
|---|---|
| `git apply --check` / `git apply` on a fresh `b5e801d8f` export | PASS. The tree is identical to the tested candidate (`9f54e996d`) |
| Vitest: `lib/rosterScheduleOptimizer/`, `lib/rosterScheduleData/`, `lib/in-season/`, `components/RosterScheduleOptimizer/`, `__tests__/components/RosterScheduleOptimizer/`, yahoo `rosterPlanning`, `lib/player-forecasts/` | 47 files, 1298 passed |
| `tsc --noEmit` (8 GB, under `/private/tmp/fhfh-heavy.lock`) | exit 0 |
| CSS Modules pure check (`CandidateCard.module.scss`, `RosterScheduleOptimizer.module.scss`) | PASS |
| ESLint on the hand-ported files | 0 errors. The 6 warnings in `RosterScheduleOptimizer.tsx` already exist on master |
| G1 guard §3 (`G1_BASE` = the export commit), checks 1, 2 and 4 | `G1 GUARD PASS` |
| G1 check 3 | PASS. The patch touches none of the 15 listed reader files |
| G1 check 4 / cache paths | none |
