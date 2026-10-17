# Standard-speed checkpoint and selected comparison policy

Latest user instruction prohibits Fast/UltraFast and requires stopping substantial work when this active task cannot be verified as Standard through a supported control.

**Observed active-task speed: unavailable / not verified.** Available task/reviewer creation controls used in this session did not expose a Standard-speed control or a current-speed observation. No inference is made from the model name, reasoning level or service-tier terminology. No further code edits, tests, reviews or subthreads were started after the instruction. This operation saved artifacts only.

The user answered the existing policy question explicitly:

> Use the selected season’s regular-season aggregate; show rankings as unavailable for last-N windows and playoffs.

This resolves the earlier comparison-policy gate. The selected behavior has not been implemented. FRESH-02 and FRESH-03 remain open; their next implementation owner must preserve the reviewed empirical direction/finite-number correction.

## Preserved completed result

- Active source/test diff: `web/components/PlayerStats/PlayerRadarChart.tsx` and `PlayerRadarChart.test.tsx` only.
- Reviewed arithmetic/number correction: 30 radar tests passed; restored caller route's 3 tests passed; scoped lint, scoped real-dependency TypeScript and scoped diff checks passed.
- Independent read-only reviewer reported no findings for that bounded correction and isolation; report saved in `REVIEW.md`.
- Full-tree TypeScript exited 134 after default Node heap exhaustion. This remains an explicit verification limitation; no full-tree retry ran.
- `radar-correction.patch` and `pins.json` preserve the exact reviewed two-file patch and source hashes.
- The earlier three-prop caller wiring and its two regressions remain in `../statistical-scope-checkpoint-2026-10-15/caller-scope.patch`. The caller source/test currently match HEAD, resolving their undeclared-prop integration problem without an unused API.

## Exact resume action

After a supported control verifies Standard speed, resume with one owner. Implement the selected season in both existing schema-specific player/cohort query branches; display the same source value used for ranking. Explicitly withhold rankings for last-N and playoff selections; preserve missing/failed per-metric availability truthfully, avoid stale request completion, and extend offline fixtures. Reconcile the saved caller patch with its component implementation, preserving all arithmetic/finite-number tests. Any fallback-log and missing-season behavior must remain conservative and clearly labelled; do not fabricate comparison values or percentile estimates.

No production/database/provider requests, model data, Game Grid layout changes, commits, pushes or deployments occurred. No processes remain running from this owner or its completed reviewer. All current artifacts are preserved.
