# RSO objective toggle repair

Cause: planning supports comparison on the known part of a partially forecasted lineup (decision 132.1), but the Section 2 points button only accepted full recommendation eligibility. Switching to Most starts therefore prevented returning to an otherwise supported points objective.

Change: extract the existing partial-comparison predicate as `hasKnownPointsComparison` and use it in engine and button. No changes to forecast policy, numerical handling, unknown-player protections, scoring or production data. The disabled tooltip now describes the partial-coverage requirement accurately.

Verification: pre-fix repeated-toggle component regression failed on the disabled button. After fix 279 component/streaming tests passed. A type-correct test fixture then passed both targeted toggle tests. Scoped lint has zero errors and six existing hook warnings; diff check passed. Full-web TypeScript passed on the final code with 8 GiB heap. No browser E2E or production request was run.

Release: four source/test files in CANDIDATE.json. No commit, push, build or deployment. Preserve unrelated dirty checkout work. Release approval, exact commit and linked-project inventory remain for parent.
