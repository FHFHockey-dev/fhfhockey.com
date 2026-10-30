# F3 receipt: stable method approval separated from per-issuance lineage (Astra audit F3)

- **Lane:** RSO-MANUAL (lease pinned 15:46Z). **Date:** 2026-10-26.
- **Base HEAD:** `5a19f1def`, which includes F2 `978134e22`.
- **Status:** not committed. The orchestrator commits.
- **Unchanged:** `planningTypes.ts`, `rsoUsePolicy.fixtures.ts`, the binding schemas
  (`in-season/workspaceSchema.ts`, `rosterScheduleData/planningDataTransport.ts`) and every F2 file.

## ⚠ FORGE producer closure

`web/lib/player-forecasts/rsoUsePolicy.ts` **is inside the FORGE producer import closure** (193 modules,
`scripts/forge-producer-closure.ts --json`). Editing it was unavoidable: the F3 defect is in that file by name
(`rsoUsePolicy.ts:74`). `rosterScheduleData/planning.ts` is **not** in the closure, and `planningTypes.ts` was not
edited.

| Closure, computed on the working tree | `closureSha256` |
|---|---|
| with `rsoUsePolicy.ts` at HEAD | `6613c9ef43129584230e5c6f70adc2691b3af501edcc8574d297d23b10920616` (`f3-closure-head.txt`) |
| with the F3 `rsoUsePolicy.ts` | `4c06fd9e2b5a5d880f594cb2668b81eaa0c54553de525a73f477d4eebf909993` (`f3-closure-after.json`, 0 findings) |

**Caveat:** both values include other lanes' uncommitted working-tree edits, for example Yahoo, projections and
player-cards files. The only difference between them is the F3 `rsoUsePolicy.ts`. **Re-verify the closure on the
integrated commit.** It will not equal the allowlisted `0e98762…` entry.

## File list and hashes

| File | HEAD sha256 | New sha256 |
|---|---|---|
| `web/lib/player-forecasts/rsoUsePolicy.ts` | `917d4a7463d05f75d5527261da779241e5e075c5e8bc121fc72d0e5c2aada54c` | `23fe44ea3d664f2303fea72caa748596fa7a7ef83de8be0bc59f909ad96c4375` |
| `web/lib/player-forecasts/rsoUsePolicy.test.ts` | `9fa2e1e368d4c34c24edaf48635c8f6f4b2f27c22809abfe79325fafc2270cb9` | `270148df973fd6d70035956d39eca61db1a17558ca47c0e5a7428f72121c7c7c` |
| `web/lib/rosterScheduleData/planning.ts` | `4482731bb70801e50ee2d5b0b22c954c48706b7f65e78541640ca2285cf87062` | `465c7e7f432b33120eec27452dfae816abd0cd9e925c7243555f9f110e15a0b6` |
| `web/lib/rosterScheduleData/planning.test.ts` | `553d41b25bcd39ab9fadd21827822d9fd26c85d656f1a215ebc43d7f006a34c0` | `37d1abe88abf7566a4a18d451586bc5271a37ec8bf96f0928219406b06e1fcaf` |

Diff: 4 files, +117 / −7.

The `web/lib/rosterScheduleData/forgeDailyBridge.ts` change in the working tree is **not mine**; it belongs to another
lane.

## Change

### Lineage format (`rsoUsePolicy.ts:53-65`)

A native participation lineage is now `<stable method>@<issued revision>`, for example
`forge-issued-participation-v1:skater@<revisionId>`.
- New export `ISSUED_PARTICIPATION_METHOD = "forge-issued-participation-v1"`.
- New export `issuedParticipationLineage(sourceKind, revisionId)`.
- A lineage without `@` is compared whole, exactly as before. This covers fixtures, older saved rows and the audit's
  `revision-one:participation` format.

### Method approval (`resolveRsoTargetUse`, `:81-83`)

- The review is matched on the **method** half only. The `@issuance` half never takes part in approval, so one review
  of a method admits every later revision issued under it.
- An empty issuance (`method@`) is denied.
- Every other binding field still has to equal the review exactly: component, model mode, code version, configuration
  and artifact hashes, target, horizon and conditioning. Reviews still need both evidence references, and revocation,
  review expiry and cutoff windows are unchanged.

### Per-issuance check (`issuanceIntact`, `:110-117`, applied in `restrictRsoForecast`)

The check runs on each row whenever the binding has an issuance half. Otherwise the row is treated as unbound and
every use is denied. It requires all of the following:
- **Revision-bound:** the issuance equals the row's own revision (`source.sourceId` for contribution inputs, otherwise
  `forecast.revisionId`). A binding copied from an earlier or foreign issuance is denied.
- **Issued context:** present, with `playerId` and `gameId` equal to the row's.
- **Issuance window:** `issuedAt <= now < expiresAt`.

These sit alongside the existing checks: code version equals model version, the cutoff is equal, and allowed-use
intersection.

### Producer (`rosterScheduleData/planning.ts:228`)

The native detailed row now emits `issuedParticipationLineage(<source kind>, forecast.revisionId)` in place of
`${revisionId}:participation`.
- The conditional producer keeps its own model identity: `conditioning: "conditional_playing"` or
  `"start_only_zero_relief"`, plus the code, configuration and artifact hashes.
- The participation method is named separately as the same-revision issued participation contract.
- The production catalog stays empty, so this admits nothing in production by itself.

## Tests

**`rsoUsePolicy.test.ts`**, new describe "stable method approval with per-issuance lineage":
- New revisions `rev-1` and `rev-2` under the reviewed method are admitted for totals and comparison, through both the
  resolver and `restrictRsoForecast`.
- **Changed method is denied:** another participation kind, a `v2` method contract, another configuration hash, and
  an empty issuance.
- **Stale or foreign issuance is denied on the row:** a binding from an earlier issuance, a foreign issued context, a
  missing issued context, an expired issuance, a future `issuedAt`, and another producer's code version.
- Revocation and the empty production catalog still deny.
- The audit's reproduction is kept: a whole-string `revision-one:participation` review does not admit
  `revision-two:participation`.

**`rosterScheduleData/planning.test.ts`**, new test in "FORGE model identity (D3)":
- `loadPlanningData` emits the new lineage.
- Under a fictional review of the stable method (totals and comparison only), revisions `issued-1` and `issued-2` are
  both admitted for totals and comparison, and assignment stays denied.
- A changed model configuration (`NHL_XG_MODEL_VERSION: "v2"`) is denied.

**Regression note:** against `git show HEAD:` copies of the two sources (fixed files restored, hashes re-verified),
the new tests fail. At HEAD the new API does not exist (`issuedParticipationLineage is not a function`), and the
behavioural gap at HEAD is the audit's reproduction, which the kept old-format test still covers.

## Checks (offline, from `web/`)

| Check | Result |
|---|---|
| RSO suites, `TZ=UTC`: `lib/rosterScheduleOptimizer lib/rosterScheduleData lib/player-forecasts lib/integrations/yahoo components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer` | **passed**, 94 files and 2,743 tests (`f3-suites-UTC.log`) |
| The same suites with `TZ=America/New_York` | **passed**, 94 files and 2,743 tests (`f3-suites-America-New_York.log`) |
| `lib/in-season` (binding schema consumers) | **passed**, 10 files and 428 tests (`f3-in-season.log`) |
| ESLint on the 4 changed files | **passed**, exit 0 (`f3-eslint.log`) |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (noclobber, released only by its owner) with `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | **passed**, exit 0 (`f3-tsc-full.log`) |

**Load note:** an earlier combined run that also included `lib/in-season` timed out once in the existing perf test
"evaluates the entire 1000-player population across 13 days" (5 s limit). Run alone, it takes about 2.5 s for that
file both with the F3 `rsoUsePolicy.ts` and with the HEAD version. The rerun of the suite set above was green.

No network, database, production, server, git mutation or `GIT_DIR` was used.
