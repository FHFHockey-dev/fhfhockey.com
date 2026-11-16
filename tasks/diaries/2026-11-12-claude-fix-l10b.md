# Fix L10b diary (2026-11-12)

## Scope
Season-settlement half of math-audit lane L10: W1-6 A3 + W3-5 F7/PR4 (proper aggregated skill, both settlement modules), PR5 (allocation base), PR1 (joint quantiles through publication), F6/PR3 (nullable readers + L13 sort ticket), F8/F9 page labels (decisions 122/123), L15 ticket (null primitives / expected_toi). Parent: fix-l10 (local_158880df).

## Where
octoberBranch, sole checkout. Owned: lib/fantasy-projections/** minus evaluator/contracts/seasonJobs; pages/fantasy-projections.tsx (+ its __tests__ page test); scripts/import-player-forecast-season-settlement.ts; lib/player-forecasts/settlement.ts.

## State
- Claim appended to CLAUDE-TO-CODEX.md (CLAUDE-FIX-L10b-CLAIM-20261111). No Codex claims on these paths in CODEX-TO-CLAUDE tail.
- Decision: Codex's playerForecasts.test.ts pins v1 `scoreForecast` (compositeSkillScore 75). Keep `scoreForecast` as a @deprecated v1 reproducer; writer moves to a new proper scorer + version `player-forecast-skill-v2` defined in settlement.ts (researchContract.ts is parent-owned, stays v1 for issued rows).

- Checkpoint 1 (settlement): new lib/fantasy-projections/properScore.ts (scoreProperForecast, aggregateProperSkill, properProbability, properInterval) used by both settlement modules. fantasy-projections/settlement.ts v2 (accountability-v2) + buildRemainingModelManifest / evaluateSeasonOutput; importer uses them (component_manifest + component_hash selected). player-forecasts/settlement.ts: scoreForecastProper + PLAYER_FORECAST_SETTLEMENT_SCORING_VERSION "player-forecast-skill-v2"; writer composite_skill_score null. Tests settlement.v2.test.ts (fp 7, pf 1): 8/8 fail with HEAD files swapped in, pass after.
- Checkpoint 2 (publication/readers): admin.ts numericRecord null-safe; publishedJointQuantiles carries stored joint bands, edits shift ±1-linear dependents, withhold others; validation allows a derived head with no band (partial still invalid). queries.ts v2 summary + nullable player records. publication.v2.test.ts 3/3 fail on HEAD (edited POINTS [38,72] vs joint [44,66]; TAKEAWAYS 0), pass after.
- Gotcha: importer reads outputs by run_id only; copy-on-write runs materialize only changed components, so a manifest component may be missing → published loss unscored ("published_allocation_unavailable"), fail closed. Follow-up for parent.

- Checkpoint 3 (page): v2 nullable expand/total, unknown totals "—" and sorted last both directions (points and category), drawer unknowns; decision 122 "Population prior" badge/section, "Role unknown", no role odds; decision 123 "Projected ice-time order", PP/PK withheld, tab "Team Ratings & Ice Time". Page test: 4 new cases fail on HEAD page (full payload showed 4.0 for the unknown total), 9/9 pass after.
- Checks: vitest lib/fantasy-projections + lib/player-forecasts + page test + preview-native-baseline: 39 files, 1402 passed / 1 skipped (Codex playerForecasts.test.ts green: scoreForecast kept as deprecated v1). npm run typecheck exit 2, single error in lib/rosterScheduleData/laterImpactInputs.ts:207 (L11's file, not mine). eslint on 13 changed files exit 0. No .module.scss edits.

## Next
Commit, report to parent fix-l10 (local_158880df).

## Blockers
None.
