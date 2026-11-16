# W1 goalie starters peer review

- Scope: Independently verify Fable W1-5 findings, append corrections/context in a separate review. No implementation or remote actions.
- Where: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, initial HEAD `f6cdee012b8c16d330362cb88f81435d17f975ff`.
- Owned files: this diary and `tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/goalie-starters.md`.
- State: Read repository instructions and W1-5 prompt; original audit and owner decisions next. Existing worktree changes are unrelated and preserved.
- Checks: none yet. No DB/provider requests planned.
- Next: Inspect original claims against targeted source, create bounded local reproductions if useful, and write a complete review.
- Blockers: none.

## Checkpoint
- Re-read all 20 packet entry targets and primary probability consumers. Core defects in same-day history, score amplification, three-candidate mass, stale timestamp payload, accuracy outcome, and model expiry remain in source.
- Important corrections: native forecast serving precedes the two legacy Start Chart paths; real TOI is not a credited-start label; updated_at alone does not preserve historical snapshots; season share is correlated with L10, not a third identical L10 input; mixture residual is intentional unknown mass.
- Checks passed: 87 tests across goalieStarterMixtures, buildGoalieGameV2, goalieInventory.sources. Executed actual probability/context functions in an isolated Node/TypeScript harness with an in-memory DB double: three-candidate mass 1.009987747, 70% -> 89.531474%, 80% -> 96.709945%; longer reliever chosen as starter. Harness first needed a permitted pure import and then the mock's missing `or` method; no product/test failures.
- No production, DB, or provider calls. Next: save review with empirical limitations and repair-order recommendations.

## Completed
- Saved the additive review at `tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/goalie-starters.md` (156 lines), with eight corrections/context sections, all 20 entry dispositions, fixture results, repair sequence and explicit empirical limits.
- Newly verified correction: all ranked candidate probabilities are serialized into uncertainty metadata; current code also has a stricter frozen pregame dataset contract. W5's "only top probability stored" limitation is too broad.
- Validation: read back report, checked all 20 unique IDs and whitespace; HEAD remains unchanged. No source, shared audit or owner-decision files modified, no commit/push.
- Result delivered to parent; no remaining review work or blocker. Implementation and production validation remain outside this task.
