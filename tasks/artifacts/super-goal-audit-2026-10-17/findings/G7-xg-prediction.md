# G7-xg-prediction findings (read-only audit, 2026-10-17, HEAD ceceb407a)

## (a) Coverage

- Completed rows in group: 596 ledger rows (49 accuracy + 118 main prediction + 64 roster/SOS + 35 baseline follow-ups + 36 baseline options + 16 exception resolution + 32 release remediation + 75 NHL API xG + 171 trending) plus 11 master rows. Every one is `[x]`.
- Rows audited in depth: 11 master rows + 45 ledger rows = 56.
- Selection: (1) all 11 master rows; (2) all rows that say P1 (15.0-15.2, baseline 7.0-7.2, NHL API xG 9.0-9.2, trending 25.0, 25.6, 28.0); (3) rows whose owning code changed after the claim date. Those are commits `5740289cc` (2026-08-29), `0c955aacb` (10-09), `f85167732` (10-10), `1f9c76e00` (10-04), `0dfca9027` (10-04), `1c4fbb0e4`, `f85ec7669`, `5e73150e2`, `b8678488d`; (4) a spread of rows across all nine sources.
- Not one path in this group appears in `accepted_base_overwritten`. The only matches there are `modeling/player_forecasts/*` files, which belong to another group.
- All the commits above are ancestors of production `457435eb`, so octoberBranch and production agree on this code.
- No uncommitted working-tree changes touch `web/lib/game-predictions`, `web/lib/xg`, `web/pages/api/v1/game-predictions` or the xG routes.
- Tests: none run. Chef's full-suite run covers the cited Vitest files. I read the tests to confirm they assert the claimed behavior.
- Migration `supabase/migrations/20260728235000_make_game_prediction_promotion_atomic.sql` exists. Its sha256 is `81ca86a1...c95d`, matching `migration-authority.json` and the final-summary table.

Master ledger lines: 3.14=439, 3.15=440, 3.16=441, 4.8=455, 5.5=498, 5.5.1=499, 5.5.2=500, 5.7.9=514, 5.7.10=515, 5.7.11=516, 5.7.12=517.

## (b) Verdict table

| row id | ledger line | verdict | evidence | note |
|---|---|---|---|---|
| 3.14 A-PRED | 439 | STALE-EVIDENCE | The ledger holds 118 main rows, not 115, so the master's 228/228 should be 231/231 (49+118+64). The 3 extra rows are NEW 15.0-15.2. | Outcome holds. The "zero production rows" part is unverifiable offline (see (d)). |
| 3.15 A-XG-TREND | 440 | STALE-EVIDENCE | The master says 170/170. The ledger has 171 rows (28.0 was added later). | The leak-free challengers and flurry raw invariance are verified below. The active champion is still the pre-fix artifact (see Top problems #2). |
| 3.16 A-XG-REL | 441 | STALE-EVIDENCE | The master says 47/47 combined. The ledger has 16+32 = 48 (NEW 5.0 was added). 5.7.11 correctly says 48/48. | The v2 artifact content is verified (C0009). |
| 4.8 B-XG-EX | 455 | VERIFIED | The exception-resolution source has 16 rows, all `[x]`. The v2 artifact has 956+65 = 1021 approved-exception mismatches and 0 blockers. | The "training PASS but not production cutover" boundary is documented. |
| 5.5 C-XG | 498 | VERIFIED | Sub-rows 5.5.1 and 5.5.2 are verified. | |
| 5.5.1 | 499 | VERIFIED | `web/lib/supabase/Upserts/nhlRawGamecenterRoute.ts`: `MAX_RAW_INGEST_GAMES_PER_REQUEST=25` (line 24), limit parsing in `resolveRequestedGameIds`, range overflow rejected at :144, partial failure returns HTTP 500 `NHL_RAW_INGEST_PARTIAL_FAILURE` at :464. Test: `__tests__/pages/api/v1/db/update-nhl-shift-charts.test.ts:566,604,641`. | Both routes share this helper. The play-by-play route test covers only a single game. |
| 5.5.2 | 500 | VERIFIED | `web/lib/xg/baselineDataset.ts:239-244`, `web/scripts/train-nhl-xg-baseline.ts:1664-1672`, `baselineDataset.test.ts:373-378`. | |
| 5.7.9 C-DYNAMIC-A-PRED | 514 | CONTRADICTED | The P1 fixes are real (see C0117 and C0118). The "inactive cron readiness" part is false. `web/vercel.json:91` schedules `/api/v1/game-predictions/forecast` daily at 11:45 UTC, and it was already in production in `457435eb`. `cron-schedule.md` JSON (lines 563-610) lists pg_cron jobs 383-386 (forecast h7/h3/h1/h0) and 387 (`score-recent`) as `active: true`. | See Top problems #1. |
| 5.7.10 C-DYNAMIC-A-XG-REL | 515 | VERIFIED | `web/lib/xg/releaseArtifactReference.ts` rejects paths outside the repo. `web/scripts/run-nhl-xg-release-validation.ts:446-451` uses it. The v2 artifact content matches the claim. | |
| 5.7.11 C-DYNAMIC-B-XG-EX | 516 | VERIFIED | The 16+32 = 48 rows agree with the claim. The exception families are enumerated in the v2 artifact. | |
| 5.7.12 C-DYNAMIC-A-XG-TREND | 517 | CONTRADICTED | The registry lifecycle guards are verified (C0171). The "leakage remediation / future promotion safeguards" part is not. No gate in the approval or registration path rejects the forbidden post-event features. The 2026-05-22 approved artifacts (`cfg9bac2706`, `cfgf81a5112`) still list `missReasonBucket` and `isShortSideMiss` and are `approvalGradeEligibility.isEligible=true`. | See Top problems #2. |
| `SRC::nhl-game-prediction-model/tasks-prd-nhl-game-prediction-model.md::C0116` (15.0) | 2983 | STALE-EVIDENCE | The text says "migration remains unapplied". `tasks/TASKS/repository-audit-remediation/migration-authority.json:167-173` says `deploymentState: applied`, backed by the 2026-08-01 Production snapshot. | The code is correct. Only the status text is stale. |
| `…::C0117` (15.1) | 2984 | STALE-EVIDENCE | SQL verified: advisory lock, `for update`, one-production unique index, candidate CAS (`v_candidate_rows <> 1` raises P0002), revoke/grant service_role. `workflow.ts:186-205` fails closed on a bad receipt. `workflow.test.ts:672-735`. | Same "unapplied" staleness. |
| `…::C0118` (15.2) | 2985 | VERIFIED | `latest.ts:71-73` returns 503 with a stable code. `__tests__/pages/api/v1/game-predictions/latest.test.ts:147-153` asserts no leak of dependency text. | |
| `…::C0115` (14.0) | 2982 | CONTRADICTED | The text says "before activating cron or production", but the forecast and score crons are already active (see 5.7.9). | P2, same root as Top problems #1. |
| `…::C0104` (11.2) | 2971 | UNVERIFIABLE-OFFLINE | Code only creates `production` via the promotion RPC or the explicit `allowBaselineBootstrap` opt-in (`workflow.ts:756-766`). | Check in (d). |
| `…::C0109` (12.1) | 2976 | VERIFIED | `evaluation.ts:432-458` uses 200-ID chunks, `pp_timeframes` first, then `pbp_games`. `evaluation.test.ts:66`. | |
| `…::C0111` (12.3) | 2978 | UNVERIFIABLE-OFFLINE | The numbers (31 of 53 evaluated, 13 games, 7 completed) come from production tables. | The 2026-08-28 denominator correction is documented in the row. |
| `…::C0113` (13.1) | 2980 | VERIFIED | `workflow.ts` `ensureGamePredictionModelVersionForScoring` selects first and inserts a candidate only when the key is absent. | |
| `…::C0066` (9.2) | 2933 | UNVERIFIABLE-OFFLINE | Persisted v4 walk-forward metrics (369 games). | |
| `…::C0068` (9.4) | 2935 | UNVERIFIABLE-OFFLINE | The 53-row history SHA-256 was taken in production. | |
| `…::C0056` (7.5) | 2923 | VERIFIED | `publicPredictions.ts` takes factors only from stored metadata or snapshots (`extractTopFactors`). `publicPredictions.test.ts:209,365`. | |
| `SRC::…accuracy-improvement.md::C0003` (1.2) | 2818 | VERIFIED | `ingest-espn-odds.ts`, with crons at `vercel.json:79-89`. | The 10-04 change (`1f9c76e00`) only adds 502 mapping. |
| `…::C0007` (1.6) | 2822 | VERIFIED | `baselineModel.ts` lists `homeMarketNoVigProbability` in `CANDIDATE_ONLY_FEATURE_KEYS` (excluded by default). The snapshot reader at `featureBuilder.ts:1700-1735` and `:2835` is cutoff-bound (`captured_at < cutoff`). | |
| `…::C0014` (2.6) | 2829 | STALE-EVIDENCE | The behavior is tested (`featureBuilder.test.ts`), but `f85167732` (2026-10-10) changed recent-form windows to admit only `gp===1` rows. See Top problems #3. | |
| `…::C0029` (5.1) | 2844 | VERIFIED | See C0007. | |
| `…::C0023` (4.2) | 2838 | VERIFIED | `buildBaselineFeatureLeakageChecks` (`baselineModel.ts` ~L420-470). | |
| `…::C0044` (7.1) | 2859 | VERIFIED | `GAME_PREDICTION_FEATURE_SET_VERSION` is still `game_features_v5_accuracy_candidates` (`featureSources.ts:26`). | The semantics under that version have changed since (Top problems #3). |
| `…::C0041` (6.7) | 2856 | UNVERIFIABLE-OFFLINE | Promotion decision evidence. The gate code is in `workflow.ts`. | |
| `SRC::…roster-sos-model.md::C0061` (11.0) | 3049 | VERIFIED | `featureBuilder.ts:1103-1118` selects the opponent rating with `latestBefore(..., game.date, ...)` and requires `game.date < game.date(target)`. | |
| `…::C0062` (11.1) | 3050 | VERIFIED | Same code. The fixture test is in `featureBuilder.test.ts`. | |
| `…::C0063` (12.0) / `C0064` (12.1) | 3051 / 3052 | VERIFIED | Season-qualified standings in `featureBuilder.ts`. The regression is in `featureBuilder.test.ts`. | |
| `…::C0033` (6.2) | 3021 | VERIFIED | `featureBuilder.ts:604`, `accountability.ts:1085` carry the `roster_form_blend_v1_…` version. | |
| `…::C0051` (9.2) | 3039 | VERIFIED | `BASELINE_MODEL_VERSION=v6_roster_ctpi_sos_threshold_52` and the feature set is still v5. This matches the "compiled v6/v5" wording. | |
| `SRC::tasks-xg-baseline-follow-ups.md::C0033` (7.0 P1) | 4650 | VERIFIED | `baselineDataset.ts:239-244` forbids `shotEventType`, `missReasonBucket` and `isShortSideMiss`. The throw is at :324 and tested at `baselineDataset.test.ts:373-378`. Python also drops them (`train_nhl_xg_challengers.py:81-89`). | The forbidden-key check exists only at dataset build, not at artifact registration (Top problems #2). |
| `…::C0034` (7.1) | 4651 | VERIFIED | `5e73150e2` made the three contract refs repository-relative. No `/Users/tim` remains in the xG scripts or lib. | |
| `…::C0035` (7.2) | 4652 | VERIFIED | The three `xg-training-*.md` files exist at the canonical paths. | |
| `…::C0010` (2.3) | 4627 | VERIFIED | `train-nhl-xg-baseline.ts:506-509`, `benchmark-nhl-xg-baselines.ts:123`, `calibration.ts:158,191`. | |
| `SRC::tasks-xg-release-exception-resolution.md::C0009` (3.0) | 4703 | VERIFIED | `tasks/artifacts/xg-release-validation-2026-03-31-v2.md`: raw 10/10 PASS, parity WARN, blocking 0, exceptions 1021 (`nst_gamelog_as_counts_oi` 956 + `nst_gamelog_as_counts` 65), training-use PASS. | The sample is 10 games from one March snapshot. |
| `…::C0016` (5.0) | 4710 | VERIFIED | See 5.7.10. | |
| `SRC::tasks-xg-release-remediation.md::C0003` (1.2) | 4716 | VERIFIED | `nhlRawGamecenter.mjs:587` sets `event_id: play.eventId`. `nhlXgValidation.ts:356,384` reconcile event ids. | |
| `…::C0011` (3.0) | 4724 | VERIFIED | v2 artifact. | |
| `SRC::tasks-nhl-api-xg-model.md::C0073` (9.0 P1) | 4821 | VERIFIED | See 5.5.1. | |
| `…::C0074` (9.1 P1) | 4822 | STALE-EVIDENCE | The row says multi-game work "uses the existing sequential retrying best-effort helper". `0dfca9027` (2026-10-04) removed the game-level retry wrapper `ingestNhlApiRawGameWithRetry`. The helper now has fetch-level retry and a 1-retry budget on `NHL_NORMALIZATION_WRITER_BUSY` only (`nhlRawGamecenter.mjs:968-1035`, `:1118-1130`). | The 500 receipt and value-free body are intact. |
| `…::C0072` (8.6) | 4820 | VERIFIED | `fetchWithRetry` at `nhlRawGamecenter.mjs:142-195` still retries retryable socket errors. | |
| `SRC::tasks-xg-trending-model-completion.md::C0020` (4.0) | 4846 | CONTRADICTED | "Add daily xG feature and prediction scheduling". The only SQL is commented out (`cron-schedule.md:1569-1599`). No `update-nhl-xg-*` job appears in the JSON active-job inventory (jobs 383-387 are the game-prediction jobs, and no xG job is listed) or in `web/vercel.json`. | P2. Sub-rows 4.2-4.4 are documentation-only. |
| `…::C0025` (4.5) | 4851 | STALE-EVIDENCE | Smoke tests were done locally. "Before enabling full daily runs" never happened because nothing was enabled. | |
| `…::C0118` (19.6) | 4944 | VERIFIED | `lib/underlying-stats/xgExplorer.test.ts`, `__tests__/pages/underlying-stats/xg/index.test.tsx` and `operations.test.tsx` exist. | The page test files are not among the working-tree changes. |
| `…::C0134` (22.3) | 4960 | STALE-EVIDENCE | The only evidence is ad-hoc `curl --max-time 30` runs (task notes, line ~441). `pages/api/v1/underlying-stats/xg.ts` is bounded (preview reads). There is no repo test or script for the API timing. | |
| `…::C0136` (23.1) | 4962 | VERIFIED | `auditXgArtifactFeatureContract` (`shotFeaturePersistence.ts:261+`). | |
| `…::C0139` (23.4) | 4965 | VERIFIED | `migrations/20260601_create_nhl_xg_model_registry.sql` exists, and `modelRegistry.ts` builds the row. | |
| `…::C0149` (23.14) | 4975 | VERIFIED | `withXgExecutionLeaseApi` wraps predictions (`update-nhl-xg-shot-predictions.ts:591`), aggregates (`:555`) and features (`:552`). `executionLease.test.ts:5,12,19`. | |
| `…::C0155` (25.0 P1) | 4981 | VERIFIED | Dataset and builder leakage removed (C0157, C0033). Challenger rebuilds are documented. | |
| `…::C0157` (25.2) | 4983 | VERIFIED | `nhlContextualFeatures.ts:137-143` prefers the interval ending at the event. `nhlContextualFeatures.test.ts:174`. | |
| `…::C0159` (25.4) | 4985 | UNVERIFIABLE-OFFLINE | "Champion registry/prediction hash unchanged" means the pre-fix champion is still the serving artifact. | Check in (d). |
| `…::C0169` (25.6) | 4995 | VERIFIED | `register-nhl-xg-model.ts:132` and `update-nhl-xg-shot-predictions.ts:591` wrap `adminOnly`. Deployed 401 behavior is unverifiable offline. There is no route-level test for these two routes. | |
| `…::C0162` (26.1) | 4988 | VERIFIED | `aggregates.test.ts:35,235` (fail-closed coverage; raw xG unchanged). `flurryAdjusted.test.ts:5`. | |
| `…::C0163` (26.2) | 4989 | STALE-EVIDENCE | The migration `20260712234959` is no longer under `migrations/` or `supabase/migrations/`. It now lives at `supabase/migration-archive/pre-baseline-20260716/production-ledger/20260712234959_add_xg_flurry_adjusted_aggregate_columns.sql`. | Applied state is unverifiable offline. |
| `…::C0164` (26.3) | 4990 | UNVERIFIABLE-OFFLINE | Production materialization and raw-hash receipts. | |
| `…::C0168` (26.4) | 4994 | VERIFIED | `update-nhl-xg-aggregates.ts:555` wraps `adminOnly`. | |
| `…::C0167` (27.2) | 4993 | VERIFIED | `train-nhl-xg-rebound-heads-offline.ts:197,268` set `promotionAuthorized:false`. `reboundHeads.test.ts:5`. | |
| `…::C0171` (28.0 P1) | 4997 | VERIFIED | `modelRegistry.ts:126-146` (not eligible means no `approved`; promotion needs `approved` and `promotionConfirmed`; champion needs active). `register-nhl-xg-model.ts:119` maps the error to HTTP 409. `modelRegistry.test.ts:117,131`. | The route-level 409 is not tested. |
| `…::C0154` (24.3) | 4980 | UNVERIFIABLE-OFFLINE | The 77 absent row IDs and hash are production data. | |

## (c) Top problems

1. **P2 (operational and truthfulness). The prediction crons are active, contradicting "inactive cron readiness" (5.7.9) and "before activating cron" (14.0, C0115).**
   - `web/vercel.json:91` schedules `/api/v1/game-predictions/forecast?fromOffsetDays=0&toOffsetDays=0&limit=16…` daily at 11:45 UTC. The same entry exists in production `457435eb`.
   - `cron-schedule.md` JSON (jobid 383-386, forecast h7/h3/h1/h0; 387, `score-recent`) lists all five jobs as active.
   - The ledger also states production has zero `production` model rows. In that state `ensureServingModelVersion` refuses to persist unless `allowBaselineBootstrap=true` (`workflow.ts:756-784`, `servingModelVersionPersistenceAction` at :288-307).
   - `generatePregamePredictionsForWindow` catches each per-game error into `skippedReason` (`workflow.ts:1169-1180`), and `forecast.ts:82` still returns HTTP 200 `success:true`.
   - Today is 2026-10-17, in season. Every game day the cron will report green while writing nothing, and the public page stays empty.
   - Reconcile the claim, or deactivate or health-flag these jobs. Production `cron.job` evidence is needed (see (d)).

2. **P2 (data correctness risk). The leakage remediation does not gate promotion, and the serving xG champion is still the pre-fix artifact.**
   - `isShortSideMiss` and `missReasonBucket` are blocked only in `buildEncodedBaselineDataset` (`baselineDataset.ts:239-244,324`).
   - `buildApprovalGradeEligibility` (`train-nhl-xg-baseline.ts:471+`) and `auditXgArtifactFeatureContract` (`shotFeaturePersistence.ts:261+`) never check for forbidden keys.
   - `register-nhl-xg-model.ts` accepts any artifact whose `approvalGradeEligibility.isEligible` is true.
   - The approved 2026-05-22 artifacts `cfg9bac2706` and `cfgf81a5112` list both forbidden features and are eligible. `cfg9bac2706` is the artifact smoke-tested in the 4.x/3.x notes.
   - Row 25.4 states the champion registry and prediction hash were left unchanged. Its own 25.1 numbers (0 of 6,484 test rows with a miss reason are goals) show the leak exists in the served model.
   - A future `active=true&champion=true&confirmPromotion=true` registration of such an artifact would pass the 28.0 guards.
   - Add a forbidden-feature check to `auditXgArtifactFeatureContract`. Then run the production registry check in (d).

3. **P2 (version and feature identity drift). Feature-builder semantics changed under an unchanged `game_features_v5_accuracy_candidates`.**
   - `5740289cc` (2026-08-29) gates `homeMinusAwayCtpi` on `isTrustedRecentTeamFormPayload`. `f85167732` (2026-10-10) restricts recent-form windows to `gp===1` rows and changes `summarizeRecentTeamRows` to use `rows.length`. Both are in production.
   - Snapshots stored before and after these commits carry the same `featureSetVersion` and `modelVersion` but different vectors.
   - This undercuts the 5.7.9 "version/feature identity" and 7.1/9.1 "bump only with evidence" invariants.
   - The change is deliberate and tested (`featureBuilder.test.ts`, `baselineModel.test.ts`). It is not a correctness bug, but the identity promise is no longer literally true.

4. **P2 (completion claim). Row 4.0 (C0020), "daily xG feature and prediction scheduling", is documentation only.**
   - The cron SQL is a commented block, and no `update-nhl-xg-shot-*` job is in the active inventory or `vercel.json`.
   - xG features and predictions for new games therefore need manual runs. See (d) for the production check.

5. **P3 (counts and status drift).**
   - 3.14: 228 should be 231.
   - 3.15: 170 should be 171.
   - 3.16: 47 should be 48.
   - C0116 and C0117 still say the promotion migration is unapplied, but it is recorded as applied.
   - C0074 describes a game-level retry that was removed on 2026-10-04.
   - C0163 cites a migration path that has moved to the archive.
   - C0134 rests only on ad-hoc `curl`.

## Additional observations (not claim contradictions)

- `fetchPublicGamePredictions` (`publicPredictions.ts:545-551`) applies `.limit(limit)` (default 30, max 100) to `game_prediction_outputs` before the in-memory production-model filter (:388-405). If non-production serving rows share a date window, they can crowd production rows out of the page. The unit tests cover only the pure builder. This is P3, latent.
- `forecast?allowBaselineBootstrap=true` upserts the compiled baseline as `status:"production"` directly, bypassing the evidence-gated atomic RPC (`workflow.ts:756-766`). It is admin-only and documented as an opt-in, but it is the one path around the "no production without evidence" exception. P3.
- `register-nhl-xg-model.ts:35-44` resolves a caller-supplied `modelArtifactPath` to an arbitrary absolute path (admin-only). P3.

## (d) UNVERIFIABLE-OFFLINE checks needed (read-only)

1. `select jobid, jobname, active, schedule from cron.job where jobname ilike 'game-predictions%' or jobname ilike '%xg%';` This confirms whether jobs 383-387 are active (problem #1) and whether any xG feature or prediction cron exists (problem #4).
2. `select model_name, model_version, feature_set_version, status from game_prediction_model_versions;` This confirms the zero-production-row claim (C0104, 3.14).
3. `select count(*), max(computed_at) from game_prediction_outputs where computed_at > '2026-10-01';` plus the recent `cron_job_report` rows for `game-predictions-forecast`. This shows whether the in-season crons wrote anything and whether the 200-with-skips masking in #1 is occurring.
4. `select model_version, approval_status, is_active, is_champion, deployment_alias, feature_manifest_hash from nhl_xg_model_registry;` followed by a check of the champion's `selectedFeatures` for `missReasonBucket` / `isShortSideMiss` (C0159, problem #2). Also confirm which artifact `NHL_XG_MODEL_ARTIFACT_PATH` points to in Vercel env.
5. `select proname from pg_proc where proname='promote_game_prediction_model_version_atomic';` plus the unique index `game_prediction_model_versions_one_production_per_model`. This confirms the migration is applied (C0116 and C0117 staleness).
6. `select count(*) filter (where flurry_adjusted_xg_for is not null) …` on the six aggregate tables, and `\d` of the columns from `20260712234959` (C0163, C0164).
7. Evaluated-game counts in `game_prediction_model_metrics` for v6/v4 and the 53-row `game_prediction_history` hash (C0066, C0068, C0111).
8. Deployed 401 behavior for `register-nhl-xg-model`, `update-nhl-xg-shot-predictions` and `update-nhl-xg-aggregates` (C0169, C0168). Code-level `adminOnly` wrapping is verified.
