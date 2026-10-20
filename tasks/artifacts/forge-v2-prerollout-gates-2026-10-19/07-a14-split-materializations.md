# Patch 07: A-14, split skater and goalie materializations (2026-10-20)

**Status:** patch only. Built and tested in a scratch export of `f9b571f43` with 06 applied. Nothing was applied to the real checkout, and nothing was committed there. No network, hosted DB, provider, Vercel, NST or Yahoo call was made.

**TJ's decision (2026-10-20, via the Chef):**
- Split each day into two materializations, one for skaters and one for goalies.
- Keep the 1,500-input limit and the approved 20-game method.

## Apply

Apply 07 on top of 06, from the repository root:

```bash
git apply --check tasks/artifacts/forge-v2-prerollout-gates-2026-10-19/07-a14-split-materializations.patch
```

| Patch | sha256 |
|---|---|
| `06-v2-prerollout-gates.patch` | `6e24aaaaa05ee016585aa2c54ed8cb2c8c79c86809f6ee311308a10e5092766e` |
| `07-a14-split-materializations.patch` | `f1aa21a661b600e10ea1dfe88951cd49ef35ce3f769e1e02590f8ca84240ce7c` |

- On a fresh `git archive f9b571f43` export, 06 and then 07 pass `git apply --check` and apply cleanly. The result is byte-identical to the tested tree.
- Against the real checkout at `53457a139`, 06 passes `--check`, and none of the 11 files 06 and 07 touch has changed since `f9b571f43`.
- **Roll back:** `git apply -R` on 07, then on 06.

7 files change, +335 −98:

| File | Change |
|---|---|
| `nativeBaselineCadence.ts` | Adds `nativeCadenceSourceManifests`, `bindNativeCadenceSplitMaterialization` and the optional `inputSources`. Publish and observe check each part |
| `nativeCadenceOutputPreparation.ts` | Accepts `goalieMaterialization` and `{ skater, goalie }` proofs |
| `nativeDailyPipelineV2.ts` | Applies the bound per kind. Adds `NATIVE_DAILY_SOURCE_KEYS` and `buildDailyMaterializationRequestsV2` |
| `forge-daily-v2.ts` | `inputs-v2` writes two requests; `outputs-v2` takes `--goalie-proof` |
| `native-baseline-cadence.ts` | `validateCadenceCommand` takes two proofs; `prepare` and `publish` take `--goalie-proof` |
| 2 test files | See "Tests" below |

## How one day stays one issuance

1. **`inputs-v2` binds two requests.**
   - `native-daily-selected-inputs-skater` holds skater means and skater participation.
   - `native-daily-selected-inputs-goalie` holds goalie means, goalie appearance and goalie start inputs.
   - Each request has its own run ID and acquisition scope.
   - Both keep the whole universe as the acquisition roster and the same merged parents, so each closes on its own.
   - The bound is checked per kind before anything is written:
     - `participation_inputs_exceed_materialization_bound:<skater|goalie>:<n>`;
     - an empty part stops with `split_materialization_part_empty:<kind>`.
2. **One cadence scope binds both.**
   - Both closures carry the same `closureScopeHash`. It names both sources, both acquisition scopes, and the `inputSources = { skater, goalie }` mapping.
   - That mapping is hashed only when present, so every single-source scope keeps its identity.
3. **Each closure closes exactly its part.**
   - `nativeCadenceSourceManifests` splits the plan's inputs by class: skater or goalie player rows, and each participation entry's `playerClass`.
   - Every input must belong to exactly one part.
   - prepare (`prepared_plan_input_manifest_mismatch`), `validateCadenceCommand`, `observeClosedNativeCadenceSources` and `publishNativeBaselineCadence` (`native_input_manifest_mismatch`) each require every closure to match its own part.
   - Either closure alone is refused, and so is the same closure passed twice. A closure that reports the other part's revision is held.
4. **One plan, one slot journal, one catalog head.**
   - `outputs-v2` builds one plan, with `requiredSources` set to both keys and both `producerReceiptIds`.
   - Outputs must be issued after the later closure.
   - The journal still records the whole plan's input revision, and `publishObservedNativeBaselineCadence` still makes one CAS on one head.

The single-request path (v1 `outputs`, the cadence `prepare` and `publish` with one `--proof`) is unchanged.

## Live command changes

- **`inputs-v2` writes `materialization-request-skater.json` and `materialization-request-goalie.json`** in place of `materialization-request.json`. `preparation-command.json` gains `goalieMaterialization`.
- **Materialize runs twice:** `native-baseline-cadence.ts materialize` once on each request. These are two hosted materializations, each under the standing bounds.
- **`outputs-v2`:** `--proof <skater stage.json> --proof-sha256 H --goalie-proof <goalie stage.json> --goalie-proof-sha256 H`. A split command without the goalie proof stops with `split_materialization_proofs_required`.
- **Publish:** `native-baseline-cadence.ts publish … --proof … --goalie-proof …`.
- **This applies on every v2 day, including frozen-window days (Oct 21–26).** I read TJ's "two materializations per day" literally. If the Chef wants the split only on rolling days, that needs a change in `inputs-v2`; the library supports both paths.
- **The offline replays** (`v2-replay-20261021-publishdry.ts`) also need updating for two requests and two proofs, on top of the updates 06 already requires.

## Tests (written failing first; scratch commit `6753699` before the implementation)

- **`nativeDailyPipelineV2.test.ts`**
  - **The per-kind bound:** 1,240 skater + 280 goalie inputs pass. 1,501 of either kind stops. An input with no class stops.
  - **End to end on a synthetic rolling day:** 62 skaters and 7 goalies, 20 games each, **1,520 inputs**, real rolling-frame histories. The day:
    - splits into 1,240 + 280;
    - shows that the unsplit request is refused by the materializer;
    - materializes both parts and prepares **one** plan of 1,520 participation entries;
    - checks that each closure's manifest equals its part;
    - passes `validateCadenceCommand` with both proofs, and fails it with one proof or with the skater proof twice;
    - completes `observeClosedNativeCadenceSources` with both closures, and fails with one;
    - publishes **`dry_run`**, and is **held** when the revisions are swapped.
  - **Per-kind overflow:** 62 skaters × 25 games (1,550) still stops offline.
- **`forge-daily-v2.test.ts`:** `outputs-v2` refuses a split command without `--goalie-proof`. This test was added after the implementation, then checked against 06's `forge-daily-v2.ts`, where it fails.
- **06's test change:** the A-14 test now asserts the per-kind bound instead of the total `…:1520`.

## Limits

- **Duplicated parents.** Both requests carry the full merged parent set and the acquisition receipts.
  - The shared rows are content-addressed, so the second materialization finds them and does not write them again.
  - Each request still carries their bytes.
  - The skater request (1,240 rolling inputs) is close to today's 1,260-input frozen request (about 38 MB of the 64 MiB bound). No real rolling day has been measured.
  - Trimming each part's parents to the ones it reaches is a possible follow-up.
- **Other per-request bounds are unchanged:** 1,024 parents and 320 rows.
- **Not verified:** CLI-level `inputs-v2` and `publish` runs with real files, and any hosted run.

## Checks (scratch tree = `f9b571f43` + 06 + 07)

| Check | Result |
|---|---|
| New/changed tests before the implementation (06 tree) | The 3 A-14 tests **failed**; the CLI split test fails on 06's `forge-daily-v2.ts` |
| Same tests after 07 | **pass** |
| Vitest: the N2 focused list plus 06's 22-file list (38 files), under `/private/tmp/fhfh-heavy.lock` | **37 files pass**; 1,417 passed, 7 skipped. **29 failed, all in `scripts/qualify-native-players-offline.test.ts`** |
| That failing file on the plain `f9b571f43` export (no 06, no 07) | **The same 29 fail.** Blockers: `missing_export_column:rolling_player_game_metrics.toi_seconds_total_last5` and `Rolling skater history read incomplete`. This predates 06 and 07; not touched here |
| Full `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (lock 19:22:25Z–19:24:32Z) | **exit 0**, no diagnostics |
| ESLint, the 7 changed files | exit 0 |

## 06 versus TJ's answers

- **A-15** (keep 120 requests / 2 MB; stop; no raise flag): **matches.**
  - `capture-v2` passes no limits to the means collector and has no `--max-*` flag.
  - Too many boxscores throws `capture_budget_exceeded` before any boxscore request.
  - **Nuance:** going over the 2 MB *byte* budget mid-capture also stops, but the reason recorded is `total_byte_bound`, not `capture_budget_exceeded`.
  - The separate means CLI (`native-means-capture.ts`) still has its pre-06 `--max-requests` and `--max-bytes` flags, each requiring an `--approval-ref`. That is outside A-15's `capture-v2`. Left unchanged.
- **A-17** (exact coverage; per-run ref only): **matches.** The ceiling defaults to 0, any uncovered member stops the run, and `--means-uncovered-ceiling` requires `--means-ceiling-approval-ref` on each run.
- **A-18:** left as is: pinned, fail-closed.
