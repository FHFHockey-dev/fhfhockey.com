# RSO later-impact publication clock

- Scope: local reader and focused existing test, canonical `octoberBranch` at `2493d5e9e`. Chef owns the bridge loader and shared fixture.
- Start: `buildBasis` sorts and emits issuance from `forge_runs.created_at`. Its persisted scenario schema requires a valid issue instant, so unproven issuance needs fail-closed exclusion and an explicit limitation.
- Next: use the loader's `succeeded_observed_at`, add ordering and missing-evidence coverage, and run the focused test. Keep captured-input cutoff, replay classification, and scenario gates intact.

- Checkpoint: reader normalizes observed success, uses it for ranking and payload issuance, and excludes unproven runs with an explicit limitation. Existing capture checksum, input snapshot, and scenario eligibility checks are retained. Tests cover inverted creation/success order and invalid/missing success.
- First focused run: 38 passed, with the full-catalog fixture failing because its run lacks `succeeded_observed_at`. Chef owns that shared fixture and has the required timing bounds. Exact-path `git diff --check` passed. Next: rerun after fixture integration.

- Handoff to Chef: after the shared fixture supplied observed success, focused Vitest passed 39/39 with all 1,088 expected basis and capture rows. Targeted ESLint and exact-path `git diff --check` passed. Integrate and independently review the two owned files alongside the bridge loader; no worker commit or release action.
