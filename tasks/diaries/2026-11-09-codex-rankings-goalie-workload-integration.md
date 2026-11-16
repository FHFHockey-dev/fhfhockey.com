# Rankings goalie workload integration

## Scope
Incremental traded-goalie/common-team-window correction after the integrated complete-window patch. Own only web/lib/rankings/goalieMatrix.ts and goalieMatrix.test.ts. Preserve all other backend/Claude UI changes. No commit, push, deploy, production request, source repair or SQL execution.

## Start
- 2026-11-09T00:47:08.507119+00:00: octoberBranch HEAD 483205af5338c6ba66765e5a88189e99ec0d2969. Both current target hashes match the previous integrated patch and the new artifact baseline. Patch applicability and whitespace checks pass. No conflicting lease; Claude matrix-flags diary acknowledges these files belong to this Codex lane.
- 39 other source/test/UI files pinned before integration. New matrixMetricRegistry and caveat-label changes remain protected.

## Next
Apply exact incremental patch, run focused/regression suites, scoped lint, full TypeScript, verify final hashes/protected paths and hand off.

## Limits
Whole-player event-type isolation, actual source/appearance coverage, matched per-metric minimums, projection age and latency remain separate acceptance gates. Claude diagnosis records missing NST and playoff-source issues; no backfill/repair action is authorized here.

## Verification checkpoint
- 2026-11-09T00:48:05.849742+00:00: Exact incremental patch integrated, both final hashes match. 151 tests / 13 suites pass on Node 22.23.4, including goalie workload/methodology, prior backend slices, metric registry and goalie/team component tests. Scoped ESLint passes; full typecheck is running with incremental output disabled. Protected-path drift: [].

## Handoff
- 2026-11-09T00:49:05.044810+00:00: Integration verified at HEAD 483205af5338c6ba66765e5a88189e99ec0d2969. Passed 151 tests / 13 suites, scoped ESLint, full TypeScript (`npm run typecheck -- --incremental false`) and target diff whitespace checks. Both final file hashes match the incremental artifact; all 39 protected source/test/UI files remain unchanged. Shared heavy slot released.
- Two touched source/test files remain uncommitted with prior accepted local patches. No Git index/ref change, build, browser run, push, deployment, production/provider request, database action or reference SQL execution.
- Parent can deliver the local integration result. Full matrix acceptance remains open; next separate work includes individual regular-season appearance coverage, missing/invalid source data, matched per-metric exposure, same-team projection freshness and bounded latency measurement.

## Superseded provenance gate
- 2026-11-09T03:32:18.903015+00:00: The two-file reader correction is integrated and verified in 2026-11-09-codex-rankings-goalie-provenance-hotfix.md. Accept wgo_game_team and wgo_season_team_alias as well as wgo_team_abbreviation, matching the canonical October resolver. Do not restore this diary's earlier final hashes or reapply the original bundle.
