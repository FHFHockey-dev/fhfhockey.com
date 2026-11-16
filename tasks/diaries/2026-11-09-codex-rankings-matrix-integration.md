# Rankings goalie/team correctness integration

## Scope
Integrate two isolated correctness patches into the canonical octoberBranch checkout. No UI, style, URL-state, SQL, writer, data repair, commit, push or deployment. Exact owned source/test files:
- web/lib/rankings/goalieMatrix.test.ts
- web/lib/rankings/goalieMatrix.ts
- web/lib/rankings/teamMatrix.ts
- web/lib/rankings/teamMatrix.test.ts

## Start
- 2026-11-09T00:09:48.558814+00:00: HEAD 483205af5338c6ba66765e5a88189e99ec0d2969. Four targets clean, byte-identical to supplied baseline, with no matching Claude/Codex lease. Both patches pass git apply --check --whitespace=error-all. Space artifacts materialized through supported transfer flow.
- Protected files include Claude Rankings UI/style/URL-state and the five earlier team-token files. Existing work remains intact.

## Next
Apply both unchanged patches, verify final hashes, run relevant mocked suites, scoped lint and full typecheck under shared heavy lock, then review diff and hand off.

## Limits
Matrix acceptance remains open: real data coverage, goalie stint/workload, power-writer provenance and parity/performance are not certified by these slices.

## Verification checkpoint
- 2026-11-09T00:11:37.532699+00:00: Both patches applied unchanged; four final hashes match. 124 tests across 11 suites passed, including the earlier filter regressions. Scoped ESLint passed. Full typecheck is running with incremental output disabled. 34 protected files were compared; changed paths: [].

## Handoff
- 2026-11-09T00:12:25.099253+00:00: Local integration complete at HEAD 483205af5338c6ba66765e5a88189e99ec0d2969. All 124 focused tests / 11 suites, scoped ESLint, full TypeScript (`npm run typecheck -- --incremental false`) and target whitespace/diff checks passed. Four patched hashes match the supplied artifacts, and all 34 protected files remain unchanged. Shared heavy slot released.
- Four application files remain uncommitted. This lane did not change Git index/refs, run a build/browser test, make a production/provider/DB request, push, deploy or execute reference SQL/writers.
- Next: parent delivers the verified local integration result. Keep the source changes for candidate review; full matrix acceptance still needs goalie stint/workload correction, power-writer provenance, source/population coverage and parity/performance checks.
