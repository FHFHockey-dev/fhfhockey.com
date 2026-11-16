# Rankings goalie provenance hotfix

## Scope
Apply only goalie-provenance-hotfix.patch after the exact prior workload version. Own goalieMatrix.ts and goalieMatrix.test.ts; preserve all BEAST, Rankings backend, Claude UI and other concurrent work. No combined-patch reapplication, commit, push, deployment or production/database action.

## Start
- 2026-11-09T03:29:07.650678+00:00: octoberBranch HEAD bffe5ee5cb3ad6e4497d5c2fc206935372c13169. Both targets exactly match the incremental hotfix base and prior integrated workload hashes. No conflicting lease. Application/whitespace check passes.
- Source correction: the October resolver migration recognizes wgo_game_team and wgo_season_team_alias as well as wgo_team_abbreviation. The original workload version incorrectly rejected the first two; the hotfix keeps unknown and current-player fallback sources unverified.
- 57 unrelated source/test/UI files pinned. BEAST owns its composite methodology/writer and update route/tests; no changes there.

## Next
Apply exact hotfix, run focused/regression tests, scoped lint, full TypeScript, check own final hashes and protected-file drift, then hand off.

## Limits
This repairs provenance compatibility only. Actual data coverage, whole-player event isolation and remaining matrix acceptance gates are still open.

## Verification checkpoint
- 2026-11-09T03:30:22.014687+00:00: Only goalie-provenance-hotfix.patch applied; both final hashes match. 160 tests / 13 suites and scoped ESLint pass. Three allowed diagnostics independently checked against the canonical October resolver migration. Full typecheck is running. Protected-path drift: [].

## Handoff
- 2026-11-09T03:32:18.903015+00:00: Hotfix-only integration verified at HEAD 64b3431c38173b40b83daaee19e7045707751719. Passed 160 tests / 13 suites, scoped ESLint, full TypeScript (`npm run typecheck -- --incremental false`) and target diff checks. Both corrected file hashes match manifest. Heavy slot released.
- Protected-file comparison detected concurrent owner changes in ["web/lib/rankings/skaterCompositeWriter.test.ts", "web/lib/rankings/skaterCompositeWriter.ts"]. This lane did not edit them. The BEAST writer changed during the full typecheck, so that pass does not certify its latest moving revision. Other protected files matched at final inspection.
- Source files remain uncommitted. No combined workload patch applied, Git index/ref change, build, browser run, push, deployment, production/provider request or database/SQL action.
- Parent can deliver the correction. This supersedes the original workload reader provenance behavior, not the verified workload arithmetic. Broader matrix acceptance remains open.
