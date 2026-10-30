# FORGE-PROV diary (Claude, 2026-10-26)

## Scope
D3: producer configuration/artifact hashes into the revision payload; RSO binding binds them. D5: review evidence fields (no review added). D4: hashed scope.json + checker reads it. No commit.

## Where
- Lease FORGE-PROV: run-forge-projections.ts, rosterScheduleData/planning.ts + test, rsoUsePolicy.ts + test + fixtures. Baseline hashes matched the lease.
- Base octoberBranch 4f9fb95c3.

## Decisions / findings
- The revision payload is built in SQL (publish_forge_game_revisions, supabase/migrations/20260916012353:27-83). It copies snapshot `inputProvenance` whole, so the hashes ride in `inputProvenance.modelIdentity` with no migration.
- The `inputProvenance` type lives in gameRevisions.ts (not leased). The producer adds the key via a spread, and planning validates the shape at runtime. Follow-up: declare the key in that type.
- FINDING: every live revision fails admission at consumerRevisionAdmission.ts:88 (no caller passes externalFantasyInputsExcluded to buildForgeInputProvenance; run-forge-projections.ts:518). That is the deliberate external-fantasy exclusion, so no positive readback is possible until it's lifted. Report it; don't fix it here.
- D5 blocker: 4 unleased test files build RsoTargetUseReview inline (optimizer executionAdapter/candidatePlanMetrics/planning tests, planningContributions.test). Required refs would break them. Ask TJ.
- TJ pop-up (2026-10-26): D5 refs REQUIRED, and granted 4 extra test files for a data-only edit (two fictional ref strings per inline review): rosterScheduleOptimizer/{executionAdapter,candidatePlanMetrics,planning}.test.ts, player-forecasts/planningContributions.test.ts.
- D3 done: forgeModelIdentity in run-forge-projections.ts; planning.ts revisionModelIdentity binds or nulls; planning.test.ts 114/114.
- D4 scope.json written; protocolHash 49ae034a…; checker 14/14.
- D5 implemented (required refs, nonempty rule); fixture + 4 granted files updated; rsoUsePolicy 6 new tests failed on baseline, now pass.
- Checks: 740/740 focused + 199 producer-adjacent; scoped + whole tsc 0; eslint 0; checker 14/14.
- Receipt: FORGE-QUAL/RECEIPT.md. Not committed. Next: the scope identity pin after release; lifting the external-fantasy exclusion is TJ's decision.
