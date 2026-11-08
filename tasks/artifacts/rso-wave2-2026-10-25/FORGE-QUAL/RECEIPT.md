# FORGE-PROV receipt (Claude, 2026-10-26)

Lane FORGE-PROV implements TJ's adopted decisions D3, D4 and D5 (`TJ-DECISIONS-RECORDED.md`).
- Base: `octoberBranch` at `4f9fb95c3`. The six lease files matched their lease baseline hashes at start.
- Code only, offline. Nothing is committed: the orchestrator commits.
- No production, DB, provider or Vercel actions, and no GIT_DIR.

## Extra files (TJ pop-up grant, 2026-10-26)

D5 makes the evidence refs required, so every inline test review needed two fictional strings. TJ chose "Required; grant 4 files" in a pop-up. Each of these files gets that two-field data edit only:
- `web/lib/rosterScheduleOptimizer/executionAdapter.test.ts`
- `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`
- `web/lib/rosterScheduleOptimizer/planning.test.ts`
- `web/lib/player-forecasts/planningContributions.test.ts`

## Files (sha256)

| File | Baseline | Final |
|---|---|---|
| web/lib/projections/run-forge-projections.ts | cb4cdbc68045dba3521405c9a3f832f894420af94ddf7e60c4ae0548eb81416e | c7614e43248455020a107f715cd2d3b6aaa9f3f11a6648f8772c1fce86fc34ce |
| web/lib/rosterScheduleData/planning.ts | e945135114e21ff631a1f23b486490323e569db0c30d67b6c565deb2a87f5306 | 4482731bb70801e50ee2d5b0b22c954c48706b7f65e78541640ca2285cf87062 |
| web/lib/rosterScheduleData/planning.test.ts | 4ac0ced587c384e74068a712d9d0d9e13b7cdd12dd3e6d52ce42013d37963a3b | edab69cc1235bc59ef3ec976b3aae15ccc98d750052f9d337237c0a25dd41eaa |
| web/lib/player-forecasts/rsoUsePolicy.ts | 3130a3cfb2bd028af42d0dc4a6bdaa72935a08823dc185aceaf830f330eb3215 | 917d4a7463d05f75d5527261da779241e5e075c5e8bc121fc72d0e5c2aada54c |
| web/lib/player-forecasts/rsoUsePolicy.test.ts | 234ae88abcae41182a9673aa31e99aeea0db50bd39de4c4b1002de596e643e07 | 9fa2e1e368d4c34c24edaf48635c8f6f4b2f27c22809abfe79325fafc2270cb9 |
| web/lib/player-forecasts/rsoUsePolicy.fixtures.ts | 4e75f0e7e90576fa5e2b29b300e715d28a7620d169d85a07eabe975ad9b37811 | 960c9863ac7a84dd5a001af89b0198ef1385089ed89d5a8cfce83a975b03a48a |
| web/lib/rosterScheduleOptimizer/executionAdapter.test.ts (grant) | 7c6cbd9971a9f228d4773b46e4040d9cf1c0e00fd72ca83bb596252f6c6238f7 | 6e45fb8c8d3344e99d162f6a5ef19050aebef6cf143d7f0d847d36c82a999982 |
| web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts (grant) | e30fae1be7b9d6490342445a723ec184fbd02d96c67ee6389e967a76ad30e326 | 6830e4a75a1ded1a5e5fc3a4b3c7a01ef6ae9fa5b9a0b5678a5af97066cb4ce2 |
| web/lib/rosterScheduleOptimizer/planning.test.ts (grant) | 82d8773d01bba424ecff709cb4628d17131aae8ab436285f161f3fcd7f446f5f | 56a5bba9454e57ded5d6cd85dae46391a31db6ca210c655bdce568d7ce9a33ee |
| web/lib/player-forecasts/planningContributions.test.ts (grant) | e69a921f9503504da870bc0a3f61d65043c4604042dd42fe95cb841850d69f01 | 650266d63b90ccb7493df5f9d509f3f66edacae5966baf5649fc6f67aa2cdc3f |
| FORGE-QUAL/scope.json (new) | — | 16b7092bea0ba307d07c1b8de3c4559533cc3a044a3af4264abd80dd397ffbe5 |
| FORGE-QUAL/tooling/check-readbacks.mjs | (FORGE-QUAL draft) | 1788c6549ae6f3a8bf3a24c6cfd82599fb349ef89fafc39f5528cd2277235e2e |
| FORGE-QUAL/tooling/check-readbacks.test.mjs | (FORGE-QUAL draft) | 479edbef96b5af789dd8809f04b8809d885c93fc9a2c423e513308ebf6b28230 |
| FORGE-QUAL/tooling/fixtures/issued.json | (FORGE-QUAL draft) | 30d4594a307ee521f47b2187a0640ce4c6d2cae787febbc523f19eddbe32aba7 |
| FORGE-QUAL/tooling/fixtures/scope.json | (FORGE-QUAL draft) | 701d6b8539fe0acfe480f747e39e1f81f84e1c475963416d9c80e43dadc63b70 |

`rso.json`, `start-chart.json` and `settlement.json` fixtures are unchanged since FORGE-QUAL.

**Scope `protocolHash`** (canonical sha256 of `protocol`, fixed now): `49ae034acc864a291393dc27e86cc745697ca83e18cc2f9666508f07db46a4ef`.

## Behaviour

### D3: producer model identity, carried and bound

**Producer** (`run-forge-projections.ts`): new export `forgeModelIdentity(codeVersion, modelEnvironment)` returns
```
{ version: "forge-model-identity-v1", artifact: "no_fitted_artifact",
  configurationHash: sha256(canonical(modelEnvironment)),
  artifactHash: sha256(canonical({ codeVersion, configurationHash })) }
```
- The live captured run computes it once from the same `modelEnvironment` it records, and puts it at `snapshot.inputProvenance.modelIdentity`.
- `publish_forge_game_revisions` copies `inputProvenance` whole into every revision payload (`supabase/migrations/20260916012353_starter_board_game_revisions.sql:59`), so the hashes reach consumers with **no migration**.
- The historical-reconstruction snapshot is unchanged: it is never published.

**RSO binding** (`rosterScheduleData/planning.ts`): `revisionModelIdentity(payload)` replaces the hard-coded nulls.
- It accepts the identity only whole and self-consistent: version `forge-model-identity-v1`, artifact `no_fitted_artifact`, both 64-hex, and `artifactHash` equal to `sha256({codeVersion: payload.codeVersion, configurationHash})`.
- Anything else (an older revision without it, another code version's artifact hash, a malformed hash, a fitted-artifact claim) leaves **both** hashes null, so they stay unknown.
- The binding still denies every use, because `reviews` is still `[]`.

### D5: review evidence references
- `RsoTargetUseReview` gains required `prospectiveEvidenceRef` and `ownerApprovalRef`.
- `resolveRsoTargetUse` ignores any review where either is missing or blank. That matches the native store's `nonempty` rule (`contributionStore.ts:206`, `:222`).
- **No review was added:** `RSO_USE_POLICY.reviews` is still `[]`, and a test pins that.

### D4: predeclared scope
`FORGE-QUAL/scope.json` (`forge-qual-scope-v1`, status `draft_identity_unpinned`) contains:
- **identity:** target `SHOTS_ON_GOAL`, horizon 1. `method`, `codeVersion`, `configurationHash` and `artifactHash` are null until pinned from the first released revision that carries `modelIdentity`.
- **protocol**, hashed now:
  - the claim (Start Chart display; RSO totals and comparison; assignment and tie-break denied);
  - the sealed Oct 23–30 window;
  - population and the milestone (14 slates, ≥500 settled skater-games);
  - readback timing and settlement;
  - two baselines;
  - metrics and thresholds (|bias| ≤ 0.05, slope 0.85–1.15, ΔMAE upper 95% < 0.02, integrity 100%);
  - looks at slates 7 (stop for harm only) and 14 (decision);
  - the reset and no-tuning rules.

Checker changes:
- It reads the scope and refuses it (exit 2) if the protocol hash doesn't match, or if the identity is unpinned without `--allow-draft-scope true`.
- It uses the scope's identity and sealed window.
- It adds `use_beyond_scope`: an RSO readback allowing a use outside `protocol.claim.rsoUses` fails.
- It reports `scopeHash` and `protocolHash`.
- `configurationHash` joined the identity and required fields.

## Tests

| Case | Where | Baseline |
|---|---|---|
| Hash determinism: canonical (key order irrelevant); config follows env; artifact follows code version | rosterScheduleData/planning.test.ts › FORGE model identity (D3) | FAIL (`forgeModelIdentity is not a function`; log `baseline-prov-d3.txt`) |
| A revision's declared hashes are bound; with no review, no use is allowed | same | FAIL (same) |
| An older revision without identity → both null (×1), plus four inconsistent identities → both null | same | FAIL (same) |
| Production catalog empty; a valid-hash binding is still denied | rsoUsePolicy.test.ts | pass (pin) |
| A review counts only with both refs: `""`, `"   "` or missing, for each ref (6 cases) | rsoUsePolicy.test.ts | FAIL ×6 (log `baseline-prov-d5.txt`) |
| Scope: protocol hash matches; an edited protocol is refused; a draft is refused unless allowed; fixture and real scope share the protocol | tooling/check-readbacks.test.mjs | new |
| RSO readback allowing assignment → `use_beyond_scope` | tooling/check-readbacks.test.mjs | new |

## Checks (from `web/` unless noted; GIT_DIR unset)
- **Passed:** vitest, 16 files, 740/740 tests:
  - `rsoUsePolicy.test.ts`;
  - all of `lib/rosterScheduleData`;
  - rosterScheduleOptimizer `planning.test.ts`, `candidatePlanMetrics.test.ts`, `executionAdapter.test.ts` and `gameForecastPoints.test.ts`;
  - `planningContributions.test.ts`;
  - projections `run-forge-projections.resume.test.ts`, `run-forge-projections.local-attempt.test.ts`, `module-imports.test.ts` and `startChartPipeline.test.ts`.
- **Passed:** vitest `scripts/run-forge-local.test.ts` and `lib/projections/runProjectionV2.test.ts`: 199 passed, 7 skipped (pre-existing skips).
- **Passed:** node self-tests `tooling/check-readbacks.test.mjs`, 14/14 (run from the repo root).
- **Passed:** scoped `tsc --noEmit` (the 10 touched files) and whole-project `npx tsc --noEmit`, both exit 0. Both ran with an 8 GB heap under `/private/tmp/fhfh-heavy.lock` (noclobber, removed on exit). Log: `tsc-prov.log`.
- **Passed:** `npx eslint` on all 10 touched web files, exit 0.

## Findings to carry forward (not fixed: outside this lane)
1. **No live revision is admitted today.** Admission excludes any revision whose `inputProvenance.external_fantasy_input_contract` isn't the exclusion contract, with reason `use_not_approved` (`lib/projections/consumerRevisionAdmission.ts:88-90`). The live writer calls `buildForgeInputProvenance()` without `externalFantasyInputsExcluded` (`run-forge-projections.ts`, live snapshot), and no production caller passes it.
   - This is the deliberate external-fantasy exclusion, but it means the D2 target can produce **no positive readback** until the pipeline genuinely excludes external fantasy inputs and claims the label.
   - Lifting it is a model/input decision for TJ, not an identity change.
2. **The `inputProvenance` type** in `lib/projections/gameRevisions.ts:94-95` (not leased) doesn't declare `modelIdentity`. The producer adds it through a spread, and planning validates its shape at runtime. Declaring `modelIdentity?: { version; artifact; configurationHash; artifactHash }` there is a small typing follow-up.
3. **The pin step:** once this change is released and a `captured_live` revision carries `modelIdentity`, set `identity` (method = `modelMode`, `codeVersion`, both hashes) and `status: "pinned"` in `scope.json`. Don't touch `protocol`.
