# FORGE rolling 14-day participation: staged patches (2026-10-17)

Read [METHOD-NOTE.md](METHOD-NOTE.md) first.

## In the canonical checkout now

These files are new and untracked. They import only from frozen files and edit none of them.

- `web/lib/player-forecasts/rollingWindowParticipation.ts` holds the three method versions, the window function and the limitations text.
- `web/lib/player-forecasts/rollingParticipationFrame.ts` builds the history frame from original receipts:
  - schedule and boxscore URL plans
  - per-player histories
  - manifest evidence
  - materialization parents
  - coverage.
- Tests: `rollingWindowParticipation.test.ts` (113) and `rollingParticipationFrame.test.ts` (19).
- Refreshed 2026-10-17 after TJ released the 8 walk-forward games: the frame no longer has any sealed-game handling, and the limitations text no longer mentions sealed games. Patch 02 is byte-identical; patch 01 changed only its `index` line, because its base file changed.

Before the patches, the rolling kernel reuses the exported finite estimator and ports about 40 lines of the internal frozen-window wrapper. Patch 01 removes that port.

## Patches (apply after 2026-10-20 17:00 UTC, in this order)

| Patch | sha256 | Files | Purpose |
|---|---|---|---|
| `01-kernel-export.patch` | `37150f8291d7bcfe1562a1de6887fa545fd948ce632a9488287cfc17f1a23d05` | 3 | See below |
| `02-integration.patch` | `75233836e7c2a515ce6bccdf4f53441f8bf58ccdce618f595371f080916f3778` | 20 | See below |

**01: kernel export.**
- `modeledSkaterParticipation.ts` splits the frozen kernel's frame check from its body and exports the body as `buildDatedWindowSkaterKernel`.
- `modeledGoalieParticipation.ts` exports `buildGoalieStartKernel` and widens its receipt parameter.
- `rollingWindowParticipation.ts` then calls both kernels, so it no longer needs its own copy.
- Behaviour is unchanged. Every existing participation test and every rolling equivalence test passes.

**02: integration.**
- Stores: datasets, release keys and loaders (`loadRollingWindowSkaterParticipation`, `loadRollingWindowGoalieParticipation`, `loadRollingWindowGoalieStarts`).
- The `participationMethods` list in publication.
- The accepted input versions in the materializer, and the builder map in output preparation.
- Catalog-head pin groups. They are optional, so earlier heads still parse with an unchanged hash, and a selection without rolling pins is byte-identical to before.
- Accepted versions in contributions, planning contributions, the transport and workspace snapshot schemas, and the Start Chart contract.
- The planning loader, with its checksum and source label. The checksum is unchanged while rolling is disabled.
- Tests that extend the nearest existing cases.

02 also applies cleanly without 01. Both passed `git apply --check` against the working tree at `octoberBranch` `ceceb407a` on 2026-10-17.

### Base blobs (`git hash-object`) the patches were cut against

`workspaceSchema.ts` and its test contain another session's uncommitted edits (consumer-test-fixes). If those change first, re-check 02's single enum hunk.

```
01  fa662ad96eec8ff9b8f74418ff30fc791e5da9f9  web/lib/player-forecasts/modeledGoalieParticipation.ts
01  17feca7da105a43e2e4f734270fd92c110c87c7c  web/lib/player-forecasts/modeledSkaterParticipation.ts
01  d4180b4f6e71312c353e4409b1e86413dbdc8fe1  web/lib/player-forecasts/rollingWindowParticipation.ts   (new file)
02  a08a393a607139c3b89e9954542bf8a1e52b86aa  web/lib/in-season/workspaceSchema.test.ts            (working tree)
02  965bef395a05ad45002da8a16ed2fa2215989344  web/lib/in-season/workspaceSchema.ts                 (working tree)
02  ab48ca96751bfdf74e7a6242891855773d0c98da  web/lib/player-forecasts/contributions.ts
02  31111f69732a9663dd8b799fcb08a67683af085a  web/lib/player-forecasts/gameExpectations.test.ts
02  2b7a3b811d519b45f90676a49efc8e26dfb940cd  web/lib/player-forecasts/modeledGoalieParticipationStore.ts
02  379f5c10e20e806968ce1ad55afeaad52783c272  web/lib/player-forecasts/modeledSkaterParticipationStore.ts
02  a86bd80ea8bac9f3627b237a5125208873494008  web/lib/player-forecasts/nativeBaselinePublication.test.ts
02  1d48011d391b02c7c5565f19adb5b41c78886fa4  web/lib/player-forecasts/nativeBaselinePublication.ts
02  fbc4e2c459ff5cabd3f3753ebb2edd495904284d  web/lib/player-forecasts/nativeCadenceOutputPreparation.ts
02  e4bcbbd9db78835aac91ac0d8ceaafc90b4b0b7f  web/lib/player-forecasts/nativeCatalogHead.ts
02  907c4a4ec812d0e902c3bbb38776a2de6cb0898c  web/lib/player-forecasts/nativeInputMaterialization.ts
02  3872c70b5e5381e272cee30da2e2a91678b79f22  web/lib/player-forecasts/planningContributions.test.ts
02  348b9eca7f895726731e892d085e308206219321  web/lib/player-forecasts/planningContributions.ts
02  04b0e95b8135715d1fe9156b24293d66f9b2b903  web/lib/player-forecasts/rollingWindowParticipation.test.ts  (new file)
02  47bf2a6b8a3dc35d810ab9298a43ecfbbf22f2b5  web/lib/projections/startChartContract.ts
02  b30fff1cada03b5ee64f1b3bc8e4139e020ed82f  web/lib/rosterScheduleData/planning.test.ts
02  cc76828c0eef7bba2ae82718da89f6fab76c765d  web/lib/rosterScheduleData/planning.ts
02  1d4abac7400b89ea0ff651c7ef482a26a3a85f4e  web/lib/rosterScheduleData/planningDataTransport.ts
```

The two `modeled*Participation.ts` files are also touched by 02, at hunks that do not overlap 01. Their blob above is the pre-01 base.

## Apply (Chef, after the Monday run has finished and its files are released)

From the repository root:

```bash
git apply --check tasks/artifacts/forge-rolling-participation-2026-10-17/01-kernel-export.patch
```

```bash
git apply tasks/artifacts/forge-rolling-participation-2026-10-17/01-kernel-export.patch
```

```bash
git apply --check tasks/artifacts/forge-rolling-participation-2026-10-17/02-integration.patch
```

```bash
git apply tasks/artifacts/forge-rolling-participation-2026-10-17/02-integration.patch
```

To roll back, run `git apply -R` with 02 first, then 01.

## Post-apply checks (from `web/`)

```bash
npm test -- lib/player-forecasts/rollingWindowParticipation.test.ts lib/player-forecasts/rollingParticipationFrame.test.ts lib/player-forecasts/modeledSkaterParticipation.test.ts lib/player-forecasts/modeledGoalieParticipation.test.ts lib/player-forecasts/modeledSkaterParticipationStore.test.ts lib/player-forecasts/nativeBaselinePublication.test.ts lib/player-forecasts/nativeDailyPipeline.test.ts lib/player-forecasts/contributions.test.ts lib/player-forecasts/planningContributions.test.ts lib/player-forecasts/gameExpectations.test.ts lib/rosterScheduleData/planning.test.ts lib/in-season/workspaceSchema.test.ts __tests__/pages/start-chart.test.tsx scripts/run-forge-local.test.ts scripts/qualify-native-players-offline.test.ts
```

```bash
npx eslint lib/player-forecasts/rollingWindowParticipation.ts lib/player-forecasts/rollingWindowParticipation.test.ts lib/player-forecasts/modeledSkaterParticipation.ts lib/player-forecasts/modeledGoalieParticipation.ts lib/player-forecasts/modeledSkaterParticipationStore.ts lib/player-forecasts/modeledGoalieParticipationStore.ts lib/player-forecasts/nativeBaselinePublication.ts lib/player-forecasts/nativeBaselinePublication.test.ts lib/player-forecasts/nativeCadenceOutputPreparation.ts lib/player-forecasts/nativeCatalogHead.ts lib/player-forecasts/nativeInputMaterialization.ts lib/player-forecasts/contributions.ts lib/player-forecasts/planningContributions.ts lib/player-forecasts/planningContributions.test.ts lib/player-forecasts/gameExpectations.test.ts lib/projections/startChartContract.ts lib/rosterScheduleData/planning.ts lib/rosterScheduleData/planning.test.ts lib/rosterScheduleData/planningDataTransport.ts lib/in-season/workspaceSchema.ts lib/in-season/workspaceSchema.test.ts
```

```bash
npx tsc --noEmit
```

### Pre-delivery results (scratch mirror of `web/` with both patches applied; separate scratch git repo, no worktree)

- **After the seal-release refresh:**
  - The 12 Vitest files in the post-apply list (excluding the two CLI tests) passed: 787 tests.
  - A scoped `tsc` over the patched files exited 0.
- **Before the refresh, affected suites** (`lib/player-forecasts`, `lib/rosterScheduleData`, `lib/in-season`, `lib/projections`, `__tests__/pages/start-chart.test.tsx`, `scripts`): 2817 passed, 18 failed, 7 skipped.
  - The same 18 fail identically on the unpatched mirror.
  - They are CLI and migration tests that read repository files the mirror does not contain: `vercel-ignore`, `qualify-native-players-offline`, `run-forge-local`, `playerForecasts` migration, `yahooUniverse`, `nativeGoalLedgerAudit`, `nativeIntervalReconciliation` and `researchGoalBaseline`.
  - Two of those (`run-forge-local`, `qualify-native-players-offline`) are in the post-apply list above. Run them in the canonical checkout.
- **ESLint** on every patched file: clean.
- **Scoped `tsc`** over the patched files and their imports (167 source files): exit 0. A full-project `tsc` was not run on the patched tree; it is in the post-apply list.

## Not in these patches (Chef's driver integration)

- **`nativeDailyPipeline.ts` / `forge-daily.ts`.** Swap `reobserveHistoryWindow` and `buildDailyParticipationInputs` for the frame:
  1. Capture `rollingHistoryScheduleUrls(cutoffAt)`.
  2. Capture `rollingHistoryBoxscoreUrls({ cutoffAt, seasonId, clubIds, scheduleReceipts })`: the final window games of those clubs.
  3. Call `buildRollingParticipationHistories(...)`.
  4. Build one rolling input per player and game: `rosterEvidence = targetRosterObservation.evidence`, `history = histories.get(playerId)`. Goalies get an appearance input and a start input.
- **Two integration traps:**
  - `buildDailyMaterializationRequest` accepts only `roster|schedule` fresh receipts. Boxscore originals need a `gamecenter/…/boxscore` allowance, or must arrive as parents.
  - `frame.parents` already contains the schedule and boxscore originals. Pass only the derived ones (`!parent.original`) as `derivedParents`, or the materializer rejects duplicate hashes.
  - The patched materializer test proves that the frame's own parents satisfy the lineage checks.
- **Not done:** policy and approval rows, the first catalog-head selection with rolling pins, and any env, cron, deploy or push change.
