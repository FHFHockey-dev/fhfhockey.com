# S-17 diary — exact-five PP groups (2026-10-18)

Session reports to Chef `local_08a0bf1c`. Local only: no commit, push, deploy, branch switch, hosted DB, provider or NST call, and no dev server. No heavy-lock jobs were needed. Only focused single-file Vitest, eslint and a targeted `tsc` on the new files ran.

## Done
- Read the handoff, the sprint register and the sibling-notes folder listing (no S-17 notes existed).
- Inspected the shift ingest (`projections/ingest/shifts.ts`), the stint builder (`nhlShiftStints.ts`), the matrix writer (`shift-charts.ts`, read only), the `team_unit_toi` migration and builder, the PP-combinations route, and the line-report types (`lib/lines/types.ts`).
- Did not edit `shift-charts.ts`, `relationshipPlayerPosition.ts`, DRM, IFTTT/line receivers or FORGE files.
- Created four new files under `web/lib/exactFivePp/` and this artifact folder. The design, results and decisions are in `proposal.md`.

## Results
- 30/30 tests pass. The oracle agrees on 8 included fixtures and 300 seeded noisy games.
- Mutation check: four real mutations are caught in 128–231 of 308 games. Skipping the union is an equivalent mutant for membership and is covered by the duplicate-seconds assertion.

## Negative findings preserved
- The current "PP units" in `powerPlayCombinations` are PPTOI-sorted slices of five, not observed groups.
- The coarse `pp` label includes extra-attacker 6v5 and merges 5v4, 5v3 and 4v3.
- The PBP manpower timeline is event-sampled and can lag a penalty expiry.
- `nhlShiftStints` has no `type_code` filter and a lenient end-time fallback, so it is not a validated base.
- `time_spent_with` is all-strength, pairwise, and summed over shift-row pairs.

## Not done or blocked
- No real-data run. The adapter needs a small export from `shifts.ts`, which this lane does not own.
- The stage-C coverage sample needs TJ approval.
