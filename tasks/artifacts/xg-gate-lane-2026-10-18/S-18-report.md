# S-18: xG forbidden-feature gate and game-prediction feature-set bump (2026-10-18)

Local only, on octoberBranch at base `0de97e77d`. No commit, push, network, DB, model registration or training was done. Source: `tasks/artifacts/super-goal-audit-2026-10-17/findings/G7-xg-prediction.md`, problems 2 and 3.

## 1. xG leakage gate

### Shared definition (`web/lib/xg/baselineDataset.ts`)

- `FORBIDDEN_BASELINE_FEATURE_INPUT_KEYS` (`shotEventType`, `missReasonBucket`, `isShortSideMiss`) is now exported.
- `FORBIDDEN_BASELINE_FEATURE_KEY_PREFIXES` is now derived as `${key}:`. It covers `shotEventType:`, `missReasonBucket:` and `isShortSideMiss:`.
- New helper: `findForbiddenBaselineFeatureKeys(keys)`.
- The dataset builder's two existing checks now use the helper. Error text is unchanged.

### Approval gate (`web/scripts/train-nhl-xg-baseline.ts`)

- `buildApprovalGradeEligibility` now receives `selectedFeatures` and `featureKeys`.
- For both shot_goal and rebound_creation, it adds the blocking reason "Artifact uses forbidden post-event features: …".
- The result is `isEligible=false`.

### Artifact audit (`web/lib/xg/shotFeaturePersistence.ts`)

- `auditXgArtifactFeatureContract` emits a new issue code, `forbidden_feature`:
  - one issue per forbidden selected feature, with its feature group;
  - one combined issue for forbidden encoded `featureKeys` that are not themselves selected-feature names.
- The audit then returns `passed=false`.

### Effect on the real local artifacts (checked with a throwaway test, now deleted)

| artifact | before | after |
|---|---|---|
| `cfg9bac2706` | approved | fails the audit: `isShortSideMiss`, `missReasonBucket` + 6 encoded levels |
| `cfgf81a5112` | approved | fails the audit: `isShortSideMiss`, `missReasonBucket` + 5 encoded levels |
| `cfg2afcf561` (corrected candidate) | passes | passes |

### Champion status (code and records read only, production not queried)

The current champion is the pre-fix artifact `logistic_l2-s20252026-p1-st1-f1-cfg9bac2706`. Evidence:

- `tasks-xg-trending-model-completion.md` 24.1 names it as the "exact active/champion row".
- 25.4 records that the champion was left unchanged. The corrected `cfg2afcf561` was registered as inactive and non-champion.
- `web/scripts/audit-xg-registry-feature-coverage.ts:12` also points at it.

To confirm live, run the read-only registry query (d)4 in G7. Replacing the champion is TJ's decision; nothing was changed.

### Release consequence (TJ decides)

The audit also runs in the following places:

- the scoring path: `encodeFeatureVector` → `assertXgArtifactFeatureContract`;
- `update-nhl-xg-shot-predictions`, both the health check and `buildPredictionRows`;
- `register-nhl-xg-model`.

Once this ships:

- If `NHL_XG_MODEL_ARTIFACT_PATH` points at `cfg9bac2706`, xG scoring **fails closed**:
  - the health check returns 409;
  - scoring runs throw;
  - registering that artifact returns 409.
- Existing stored predictions and registry rows are not touched.
- Per G7 problem #4, no xG scoring cron is active, so nothing scheduled breaks. Manual rescoring with the old champion would stop.
- Options for TJ:
  - (a) release the gate and promote `cfg2afcf561` through the guarded registry path;
  - (b) release the gate and accept that rescoring is paused until a clean champion exists;
  - (c) hold the gate.

## 2. Game-prediction feature identity

- **Version bump:** `GAME_PREDICTION_FEATURE_SET_VERSION` changes from `game_features_v5_accuracy_candidates` to `game_features_v6_trusted_ctpi_single_game_form` (`web/lib/game-predictions/featureSources.ts`). A comment records the reason (`5740289cc` CTPI trust gate, `f85167732` gp===1 windows).
- **Test:** `featureBuilder.test.ts` pins the new literal on the snapshot insert.
- **Unchanged:** `BASELINE_MODEL_VERSION`.

### Effect once released (TJ approval required)

- **Serving.** `ensureServingModelVersion` / `servingModelVersionPersistenceAction` need a `production` row for `(model_name, model_version, feature_set_version)`.
  - Any existing production row is keyed on v5, so `forecast` refuses to persist (NoProductionModelVersionError) until a v6 model version is backtested and promoted through the atomic RPC.
  - The other route is the explicit `allowBaselineBootstrap=true` opt-in: `canBootstrapCurrentCompiledBaseline` now matches only v6.
  - G7 says production may already have zero production rows (unverified). If so, nothing changes operationally.
- **Stored snapshots.** v5 rows in `game_prediction_feature_snapshots` and the outputs, history and metrics tables stay as they are, under v5.
  - New snapshots are written under v6.
  - `existingFeatureSnapshotId` no longer matches v5 rows, so the next backfill rebuilds snapshots under v6 instead of skipping.
  - `buildPayloadForGame` in accountability throws for a non-current version that has no persisted snapshot. v5 backtests therefore still work from persisted v5 snapshots but can no longer be rebuilt live.
- **Comparisons.** Metrics, backtests and promotion evidence are keyed on `feature_set_version`, so v5 and v6 results no longer pool together.
  - A v6 candidate needs its own walk-forward evidence (≥ `minEvaluatedGames`, 100 by default) before promotion.
  - Pre-change vectors no longer share an identity with post-change ones, which is the intended fix.
- **Public page.** `publicPredictions` keys on model|version|featureSet. Outputs stay visible only when their v5 production model row still exists.
- **Stale docs, not edited (outside the lane):**
  - the usage string at `web/scripts/promote-game-prediction-model-version.ts:162`;
  - v5 literals in test fixtures (`promote-model-version`, `check-game-prediction-health`, `adminHealth`, `workflow.test.ts:676`). These are data inputs and still pass.

## Checks

- **Vitest** (lib/xg, lib/game-predictions, `__tests__/pages/api/v1/game-predictions`, and the three game-prediction script tests, plus the xG train script test): 47 files and 275 tests passed.
- **eslint** on the 7 changed files: clean.
- **`npx tsc --noEmit`** (run behind the heavy-job lock): passed with exit 0 and no errors. The first attempt hit the default Node heap limit; the rerun used `NODE_OPTIONS=--max-old-space-size=8192`.
