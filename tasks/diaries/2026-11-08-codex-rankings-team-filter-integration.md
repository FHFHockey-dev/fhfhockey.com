# Rankings team-filter integration

## Scope
Integrate the isolated Snapshot/Comparison team-token parity patch on canonical octoberBranch. Own exactly the five source/test paths listed below. No styling, rankingUrlState, shared parser, scoring, source/cohort arithmetic, Git commit, push, or deployment.

## State
- 2026-11-08T23:30:36.502327+00:00: HEAD aab92b7a60ccd8fd71d93b7767d23152d3b1b13c. Five target files are clean, identical to packet base, and have no matching lease in the Claude/Codex ownership registers. Claude Rankings UI and rankingUrlState changes remain owned by Claude and untouched.
- Supported Space transfer completed; patch applies cleanly.

## Owned files
- web/lib/rankings/comparison.ts
- web/lib/rankings/snapshot.ts
- web/lib/rankings/comparison.test.ts
- web/lib/rankings/snapshot.test.ts
- web/__tests__/pages/api/v1/contextual-rankings-matrix.test.ts

## Next
Apply the checked patch, run seven focused suites, scoped lint and full typecheck under the free shared heavy slot; review exact diff and preserve concurrent changes.

## Blockers
None. No release authority.

## Verification checkpoint
- 2026-11-08T23:31:46.344591+00:00: Patch applied unchanged. Seven focused suites / 55 tests passed on Node 22.23.4, Vitest 3.2.6, canonical configuration with inert Supabase values. Scoped ESLint passed. Full typecheck is running with incremental output disabled under the shared heavy slot. No backend arithmetic/source-cohort correctness claim.

## Handoff
- 2026-11-08T23:32:53.581104+00:00: Completed local integration. All 55 focused tests / 7 suites, scoped ESLint, full TypeScript (`npm run typecheck -- --incremental false`) and target diff whitespace checks passed. All five final hashes match the packet. All 28 protected Rankings UI/style/URL-state files are unchanged from the pre-apply snapshot.
- HEAD is aab92b7a60ccd8fd71d93b7767d23152d3b1b13c after an unrelated mailbox-only Claude coordination commit; this lane made no commit. The six core matrix/calculator/query files remain clean. Shared heavy slot released.
- No build, browser test, remote service request, database action, push or deployment was performed. This is team-token parser consistency, not certification of the matrix arithmetic, cohort coverage, goalie/team metrics or production state.
- Next: parent delivers the result and retains these five uncommitted files for local candidate review. Broader matrix vetting remains a separate task.
