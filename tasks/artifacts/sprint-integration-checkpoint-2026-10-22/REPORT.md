# Accepted-packet integration checkpoint — held

**The requested fixed snapshot is preserved, but combined acceptance is held by 13 planner/bridge test failures.** Application-only TypeScript passes. Scoped lint passes with zero errors and nine warnings. No application source was edited during this checkpoint, and no existing failure or assertion was suppressed.

## Fixed candidate and provenance

- Observed canonical branch/HEAD at start and finish: `octoberBranch` / `b9f993b3522376805f82eeda1c84b7df39c7129f`. This mutable Git context does not identify the dirty candidate; the file hashes do.
- `CANDIDATE-PINS.json` inventories **110 accepted file pins** across A1–A10, NST R1, P07 R2 + task10 R1, supported task1 scoreboard work, P05 R1/mounted expiry, P02 + R1, S08, calendar date identity, search prefetch correction, billing relocation R1 and Luna R1. `PACKETS.json` binds their manifests and review reports. P05 acceptance also relies on the parent's explicit accepted-packet handoff; its owner manifests remain independently identifiable.
- `DEPENDENCY-PINS.json` records **244 retained dependencies**, including read-only SQL/registry fixtures. Dependency preservation is not new acceptance of their behavior. `SUPERSESSIONS.json` records eight accepted successor versions and the P05 dependency pins intentionally superseded by accepted P07 Yahoo consumer changes.
- The final **3,585-file** export is `export-completion/fixed-source.tar.gz`, SHA-256 **`09bd763bc9b740159f2d4aa5b0c97d19ce3839872b1ac27762b21cbd6596beff`**. Every final hash and all 110 accepted pins match at completion. `FINAL-INTEGRITY.json` is the receipt.
- The original 3,581-file export and failed first-run evidence remain unchanged: `fixed-source.tar.gz`, SHA-256 `29edb4e1833fd58308738a7d586a373a84d398214e81457d5365eab252a706cc`. The completed export adds only three missing migration-test inputs and a separate application-only compiler configuration. All original 3,581 pins remain unchanged.
- `PROVENANCE.json` identifies the retained historical dirty audit baseline through P07/task10, named accepted overlays and reviewed dependency sources. **The entire baseline is not accepted as a release tree.** `CANONICAL-COMPARISON.json` records 60 initial differences, including isolated review/configuration files. The two accepted source divergences are `skater-queries.ts` and its test: the snapshot retains accepted A1 bytes, not the newer held task2 versions.
- Newer canonical Claude tasks6/7/8/11 model/runner changes, unqualified skater experiments, active task2, and other foreign changes were not imported automatically. Canonical P03/timeline, CTPI, billing UI/route, admin and NST coordination changes remain outside this checkpoint's named accepted overlay. They are not adjudicated here.

## Verification actually run

Node **22.11.0**, npm **10.9.0**; existing dependencies; ordinary isolated source copy, no Git worktree. Cleared environment, synthetic `.invalid` service values, `envDir:false`, network-deny preload, one Vitest worker and private cache/home/tmp. The shared `/private/tmp/fhfh-heavy.lock` was acquired atomically for each verification phase and only this task's lock was released. It is absent at completion.

| Check | Actual result |
| --- | --- |
| One deduplicated 67-file regression selection | **1,925 passed, 16 failed**, 1,941 selected test cases, no skipped cases. `regressions.json` / `.log` |
| Three missing migration-test export inputs supplied; only that file rerun | **21/21 passed**. `export-completion/migration-fixtures.json` |
| Consolidated latest results across the original selection | **1,928 passed, 13 failed**. This replaces the original migration-file result; it does not add the repeated 21 cases or claim distinct semantic scenarios. |
| Actual relocation runner `--preflight` | **Passed**; seven pinned inputs, no DB/client/target load. `relocation-preflight.log` |
| Bounded Node relocation oracles | **14/14 passed**. `relocation-oracles.log` |
| Initial application configuration plus newly copied review fixtures | **Failed**, one TS2352 in external review fixture described below. Raw log preserved. |
| Application-only compilation, all production/application sources retained | **Passed**, no diagnostics. `export-completion/application-types.log` |
| ESLint on 97 accepted TS/TSX paths | **Passed**, zero errors, nine warnings: two raw-image warnings in GoalieShareChart, one in PlayerSearchBar, six hook-dependency warnings in RosterScheduleOptimizer. |
| Final source/archive integrity | **3,585/3,585 files and 110/110 candidate pins match**. No source repairs or full-suite reruns. |

Exact argument arrays, environment, working directory, timings and exits are in `COMMANDS.json`, `RESULTS.json` and the corresponding `export-completion/` receipts. The 67-file selection includes the original C08, R2 expiry/correlation checks and combined task10 UI/transport cases; none of those failed. `TEST-FILES.json` is the exact selection, not a claim that every repository test ran.

## Remaining integration failures

`FAILURES.json` preserves every original failure and stack. Thirteen remain after correcting the export:

1. **`web/lib/rosterScheduleData/forgeDailyBridge.test.ts:348` — one case.** “produces forecasts the planner accepts for league points” expects 7.5 but receives null. It passes literal bridge forecasts directly to `candidateHorizonPoints`, without a fresh current-read/runtime-authority context. Its nonzero `FACEOFFS_WON` weight also lacks a corresponding forecast input. Both contracts must be respected when aligning this regression; unknowns must not become zeros and authority must not be bypassed.
2. **`web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts` — twelve cases.** Fixtures construct native `modelVersion: "fixture"` rows and invoke numerical planner functions directly. They carry serialized `allowedUses`, but no trusted target review or current runtime admission. Expected numeric candidate ordering, exhaustive assignment values, drop losses and tradeoffs consequently fail. These fixtures need a narrowly reviewed way to exercise the approved quantitative path while preserving denial controls, original numerical assertions and the empty production approval catalog. This observation does not waive the failures or establish that production candidate behavior is correct.

No test or application correction was started: the parent requested no application edits and TJ requested an orderly checkpoint. Parent/next owner must establish the exact two-test-file lease and decide whether a test-contract correction suffices; any demonstrated runtime defect needs its own scoped correction and review. The production bridge remains untouched.

## Reviewer fixture TypeScript finding

`tasks/artifacts/p07-task10-independent-review-2026-10-22/p07Task10Serialization.test.ts:34` is the source of the copied isolated file `web/lib/rosterScheduleOptimizer/p07Task10Serialization.test.ts:34`. Its synthetic contribution dictionary is asserted as `Record<string, ResolvedContribution>` while missing `resolverVersion`, `game`, `targetKey`, `sourceKind` and seven other required fields (TS2352). The source belongs to the independent P07/task10 reviewer; its exact bytes were preserved.

The copied file is **not tracked and does not exist in canonical `web/`**. It is an artifact-only review fixture, not shipped application code. The initial error remains open in `application-types.log`. The separate application check excludes the three newly copied independent review fixtures, in addition to the previous four external-fixture exclusions; no application source exclusion was added. `export-completion/APPLICATION-TYPE-SCOPE.json` records exact membership. A reviewer-owned, versioned fixture typing correction is a tiny separate follow-up; do not modify the original receipt or imply a full exported-tree compiler pass.

## Independent holds and production gates

- **Task2 R2 remains outside this snapshot.** Parent reports 1,975 archive hashes matching, 393 passing cases and one reproducibility failure: `goalie/leagueSavePct.ts:82` warm cache skips a captured query, changing subsequent recorded reads from 100 to 99 despite identical forecasts/source hashes. It is outside the helper lease/inside Claude7 territory. No fix or new replay launched here. Evidence: `tasks/artifacts/forge-task2-2026-10-22/r2/HANDOFF.md` and its owner diary.
- Native target approvals remain empty; no predictive quality improvement or historical requalification is implied. Historical F/D, TOI/PP-TOI, independently complete coverage and vintage-valid hydration gates remain open.
- Luna remains default-off and offline; earlier-source projection reuse, paid/model accuracy and production integration are held. Calendar semantic/finality/WGO contracts remain held beyond accepted date identity. Browser/worker runtime qualification and the previous Chromium permission gate remain separate.
- SQL is retained only as test data. No migration, schema, DB repair, backfill, production read/write, NST/provider/model request, dependency installation, Git mutation, commit/push/merge, build, deployment or billing operation occurred. No denied or uncertain action remains. **Combined acceptance is pending; this is not release-ready.**

## Resume/reproduce

Current isolated source: `/tmp/fhfh-sprint-integration-u5ophe9k/snapshot`. Original evidence and completed export are immutable inputs for review.

```text
python3 tasks/artifacts/sprint-integration-checkpoint-2026-10-22/replay.py
```

This safe default extracts the completed archive into a new ordinary `/tmp` directory, verifies all 3,585 hashes, attaches existing dependencies, and prints the location. It does not run tests. When resuming the held regression investigation, append `--failed-planner`; use `--all-tests` only when a relevant later change justifies repeating the full selection. `--types` repeats the separately documented application-only check. Each executing replay uses a cleared offline environment and its own heavy lock, logs to the new directory, and preserves the old receipts. No new implementation lane is authorized by these replay instructions.
