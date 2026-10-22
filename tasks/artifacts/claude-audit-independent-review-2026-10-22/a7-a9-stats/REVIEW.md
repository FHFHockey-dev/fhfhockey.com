# A7–A9 independent review — 2026-10-22

**Decision: A8 and A9 qualified acceptance; A7 helper changes pass, but hold full A7 consumer acceptance for the P2 gap below.** No new regression from the packet was demonstrated. The original three defects reproduce before and pass after. Integration remains with the parent; this is no release/deployment approval.

## R1 — P2: consumer queries discard unknown game exposure before the new completeness check

`web/components/TeamDashboard/AdvancedL10Metrics.tsx:148` filters WGO rows with `.gt("games_played", 0)`; line 176 does the same for NST `gp`. Thus a matching stored game row whose exposure is null never reaches `aggregateWgoTeamGames`/`aggregateNstTeamCounts`. The new helper correctly returns unknown if it receives that row, but the actual consumer silently calculates a smaller observed sample.

Independent fixture [reviewConsumerExposure.test.tsx](reviewConsumerExposure.test.tsx) applies the production equality/range/greater-than/order/limit predicates, including exclusion of nulls by greater-than. For two otherwise matching dated game rows, one with unknown exposure, the pinned candidate displays:

- WGO: `Power Play20.0%`, without an incomplete-sample note.
- NST: `Corsi For %33.3%`, without an incomplete-sample note.

Both required-unknown assertions fail. See [candidate receipt](adversarial-tests.log). The same two cases fail against verified before production bytes ([before receipt](consumer-exposure-before.log)), so this is an **unresolved repair gap**, not an introduced regression. The new component tests miss it because their query mocks make `.gt()` a no-op and deliver null-exposure rows that the real query excludes.

The same predicate remains in `web/components/GameStateAnalysis/GameStateAnalysis.tsx:199` (strength rows), `web/components/TeamDashboard/TeamDashboard.tsx:443` (season WGO), and `:757`/`:771` (league comparison rows). Those paths were statically traced, not separately executed with filter-aware fixtures. Main TeamDashboard NST data is read without this predicate, while its ranking input excludes null exposure; this can also give display and ranking consumers different admitted samples.

This is narrower than the implementer's stated limitation about upstream ingestion failing to supply all expected games: these rows exist in the queried source and are deliberately filtered away. To complete the chosen unknown-exposure contract, retain unknown exposures in affected count-aggregation reads (exclude only known zero-game rows), or establish and visibly disclose a different observed-sample contract. Parent should assign the bounded query/mock follow-up; no implementation was made during this review.

## Verified behavior

- **A7 supplied-row aggregation:** missing numerator/denominator/count/TOI values do not independently disappear from sums. Unknown or invalid game exposure invalidates the supplied sample; known zero-game rows are excluded; valid zero values survive. Unrelated complete metrics remain available. Three consumers propagate returned nulls, and aggregate ranks with missing supplied values are withheld. The query-admission gap above limits end-to-end acceptance.
- **A8:** repeated 429 at first/middle/final pages, short pages, malformed metadata and changed totals withhold all chart windows and show the unavailable alert. Verified-empty results remain distinct. Retry recovery, two attempts, eight-page concurrency, and no refetch on span changes pass. Review covers the tested transport failures/cardinality metadata, not independent upstream dataset completeness, duplicate/corrupt row identity, or provider snapshot consistency.
- **A9:** original A→B→A case passes; success/empty/error/finally, filter/season ownership, and hidden-tab behavior pass. Three independent tests retain the real `fetchAllSupabasePages` implementation and resolve a stale full 1,000-row games or shots page, or reject stale shots, after returning to cached A. All pass: A persists, loading/error stay current, and no additional Supabase query is issued. Existing query semantics, including the unused game-type predicate, were not changed or certified by this packet.

## Pinned bytes and reproduction

- Repository: `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`, HEAD `a811b0762ffe29006c3df7eaa4c19bf18deecda3`.
- Patch SHA-256: `83183df3c5f7ecb0c2d9498baed688af521f9c9683494bf6597d3d2df5867872`.
- All **12** canonical after hashes match CANDIDATE. Reverse-applying the patch in a private directory reconstructs **all 12** declared before states/hashes, including the absence of the two added files. All six historical baseline production files match; its six test-file states differ because that scratch directory contains later regression tests. It was therefore not treated as an immutable original baseline. See [start verification](hash-verification-start.json) and [end verification](hash-verification-end.json).
- Fresh final snapshot: `/tmp/fhfh-queue-check-48vr9l03/isolation/snapshot/web`.
- Fresh before-code runtime: `/tmp/fhfh-a7-a9-review-red-p4tae9s2/isolation/snapshot/web`, with only the six production files replaced by hash-verified before bytes. Original audit repros are unchanged.
- Node **22.11.0**, npm **10.9.0**. Used the original queue's isolated-copy recipe and inspected wrappers: cleared environment, synthetic service placeholders, isolated home/tmp, socket/HTTP(S)/unmocked-fetch denial, and existing installed dependencies. No tests executed in the canonical checkout; no installation or credential/environment-file reads.

| Check | Independent result | Evidence |
| --- | --- | --- |
| Eight nearest test files | 111 passed | [log](focused-tests.log) |
| Original A7/A8/A9 before | 3 failed, 5 unrelated skipped | [log](original-repros-before.log) |
| Original A7/A8/A9 after | 3 passed, 5 unrelated skipped | [log](original-repros-after.log) |
| New consumer predicate fixtures | 2 failed before and after | [before](consumer-exposure-before.log), [after](adversarial-tests.log) |
| New real-pagination ownership fixtures | 3 passed | [source](reviewShotOwnership.test.tsx), [log](adversarial-tests.log) |
| Packet-scoped TypeScript | Passed, exit 0 | [log](typecheck.log) |
| ESLint on all 12 packet files | Passed, exit 0; 0 errors, 2 existing image warnings | [log](lint.log) |

Runs used `sh <packet>/run-tests.sh <snapshot> ...` with the eight paths in the packet report; original repro filter was `unpaired missing count|incomplete page set|obsolete team request`. New fixtures were copied into the private snapshot's `web/lib/`. Typecheck used `npm exec --offline -- tsc --noEmit --project tsconfig.a7-a9.json`; lint used the report's exact 12-file command. Retained fixtures and logs permit replay without modifying canonical source.

Full application typecheck/suites, build, browser runtime, provider/live-data validation, and release integration were not run. Production requests, remote builds/deployments, commits, pushes, and application/worker-artifact edits: **zero**. No denied, pending, or uncertain external action. The remaining blocker is the demonstrated A7 consumer completeness gap, not a tool permission block.
