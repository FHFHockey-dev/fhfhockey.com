# A7 R1 independent re-review — 2026-10-22

**Accept R1 and close the A7 consumer-admission hold. A7–A9 now have qualified independent acceptance for the pinned local packet.** This supersedes only the unresolved R1 finding/hold in [the prior review](../REVIEW.md); its established A8/A9 results and limits remain applicable. No new defect was demonstrated. Parent retains integration/release authority.

## Findings and admission semantics

The actual implementation delta is six predicate substitutions in three components, plus test changes. `.or("gp.neq.0,gp.is.null")` and its WGO equivalent preserve null and invalid nonzero exposure while excluding known zero-game rows. Existing team/season/date restrictions remain conjunctive; the OR does not broaden those bounds. The installed PostgREST client's `.or()` implementation was inspected locally: it appends the parenthesized expression as the `or` query parameter. No provider request was used.

Filtering precedes date ordering and the L10 limit. Consequently, zero-game rows cannot consume L10 slots, an unknown exposure inside the selected window invalidates that sample, and an older unknown outside the latest ten does not invalidate a complete L10 window. Negative exposure is admitted and then classified unknown by the existing aggregator, rather than silently disappearing or contributing a negative denominator. Current-team and peer-team unknown exposure withhold affected ranks. No new admission bias was found within these tested contracts.

The unchanged GameStateAnalysis score-state `.gt("games_played", 0)` belongs to its separately labelled observed per-game-average contract; it does not feed the corrected NST count aggregation. Entirely absent upstream game/team rows remain unprovable from these queries. This acceptance does not establish source completeness or provider snapshot consistency.

## Independent verification

Fresh isolated snapshot: `/tmp/fhfh-queue-check-0fldxdwq/isolation/snapshot/web`. Node **22.11.0**, npm **10.9.0**, cleared environment, synthetic placeholders, isolated home/tmp, socket/HTTP(S)/unmocked-fetch denial, installed dependencies reused. No canonical application files were edited or executed as the test root.

| Check | Actual result |
| --- | --- |
| Original two filter-aware failures | **2 passed**; PP/CF display em dash with incomplete-sample notes |
| Independent negative-exposure variants | **2 passed** |
| New cross-consumer admission suite | **10 passed** |
| Scoped TypeScript, 13 packet files and imports | **Passed**, exit 0 |
| ESLint, seven R1-changed files | **Passed**, exit 0, no warnings/errors |
| All 13 canonical/snapshot hashes, checked before and after | **Matched** |
| R1 patch reversed in a private copy | All 13 states match prior independent-review hashes/new-file absence |
| Cumulative patch reversed in a separate private copy | All 13 states match original-before hashes/new-file absence |
| A8/A9's four files | Byte-identical to prior independent review; no runtime rerun |

Evidence: [14-test log](admission-tests.log), [typecheck](typecheck.log), [lint](lint.log), [start hashes](hash-verification-start.json), [end hashes](hash-verification-end.json).

The original fixture's required assertions/data were preserved. Its query mock gained OR support; its diagnostic lookup uses `queryAllByText` because the corrected WGO rendering legitimately contains multiple incomplete notes. [Exact adaptation](review-fixture-adaptation.patch), [replayed fixture](reviewConsumerExposure.test.tsx), [negative-exposure fixture](reviewNegativeExposure.test.tsx). Earlier before-failure receipts remain in the prior review directory; unrelated suites and the owner's full 91-test selection were not rerun.

Tests ran through the packet's inspected `run-tests.sh` wrapper with `lib/reviewConsumerExposure.test.tsx lib/reviewNegativeExposure.test.tsx lib/stats/teamCountConsumers.test.tsx`. Typecheck used `npm exec --offline -- tsc --noEmit --project tsconfig.a7-a9.json`; lint used the seven-file R1 command from the implementation report, both through `run-check.sh`.

## Candidate identity and limits

- Branch: `octoberBranch`; independently tested/current HEAD: `d3f057c6c849d5d5474bc912a6f461f617c65b15` (unchanged during this re-review).
- Candidate manifest SHA-256: `9676ea6d91dc9602be94a4c6934e6ac69d368bc2aaac6febff6040ea34e1c227`.
- R1 patch SHA-256: `3780ca42acc106216aaf207ca076945ee20f64cbed3e5d57e971080c16d31bdc`.
- Cumulative patch SHA-256: `2a61cd0205a5a98c2a46df2ae900e1c0fa3b967e250046c2c7e7490a034cf7a8`.
- HEAD advanced from the prior review through a documentation-only commit; inspected `git show` confirms one task-list file changed. Packet acceptance is pinned to source hashes and does not qualify concurrent unrelated work.

Full application suites/typecheck, builds, live browser/provider checks, and production validation were not run. No application/worker-artifact changes, dependency installs, credential reads, network/production requests, commits, pushes, or deployments. No remaining demonstrated A7–A9 blocker; no denied, pending, or uncertain external action. Existing upstream completeness and A8/A9 qualification limits remain.
