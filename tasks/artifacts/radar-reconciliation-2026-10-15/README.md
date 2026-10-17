# Radar reconciliation — local reviewed correction

Supersedes the unfinished active-state descriptions in the two October 15 radar checkpoints. This is a bounded FRESH-01 correction. **FRESH-02 and FRESH-03 remain open.** The user has now selected the policy recorded in `STANDARD-SPEED-CHECKPOINT.md`; its implementation is paused pending verified Standard speed.

## Delivered behavior and exact ownership

Active application/test diff is limited to:

- `web/components/PlayerStats/PlayerRadarChart.tsx`: lower-is-better favorable percentiles now count strictly worse peers, while competition rank continues counting strictly better peers plus one. All existing direction flags, strict-tie scoring and table-specific query filters are preserved. A focused numeric parser consistently excludes null, missing, blank, non-numeric and non-finite empirical values while preserving actual zero and numeric strings.
- `web/components/PlayerStats/PlayerRadarChart.test.tsx`: retains the stopped direction worker's complete 28 added regression cases and 2 original query-contract cases without further changes. Covers best/middle/worst, all six existing inverted metrics, normal points/save percentage, ties, all-equal/singleton cohorts, invalid values, empty cohorts and position/category/league season filtering.

For GAA values [2, 3, 4], favorable percentiles are now 67, 33 and 0, with ranks 1, 2 and 3. The established strict worse-peer definition remains; no midpoint-tie scoring was introduced.

Both checkpoint artifacts were read before edits:

- `../radar-direction-checkpoint-2026-10-15/CONTEXT-DIARY.md`
- `../statistical-scope-checkpoint-2026-10-15/README.md`

The stopped direction worker had only added tests; no arithmetic fix had been applied. This owner applied the correction and obtained a separate read-only review. See `REVIEW.md` for the completed report and its limits. The lead accepted that bounded review after inspecting the actual diff. No application source changed after review.

## Scope increment reconciled without choosing product policy

The earlier caller increment passed `seasonId`, `timeFrame` and `usedGameLogFallback` to a component that did not declare or implement those props. That was unfinished integration. After verifying exact checkpoint hashes and checking the inverse patch, this owner isolated only its own earlier caller/test changes from active code. Both caller paths now exactly match HEAD:

- `web/pages/stats/player/[playerId].tsx`
- `web/__tests__/pages/stats/player/playerId.test.ts`

The entire scope increment and its two regressions remain preserved in `../statistical-scope-checkpoint-2026-10-15/caller-scope.patch`, with originals, snapshots and pins in that checkpoint directory. Do not apply it alone: it still requires a product choice, the corresponding component implementation and scope/provenance tests. No unrelated dirty work was reverted.

### Exact unresolved options

1. **Selected-season comparison:** use the server-resolved selected season in both player and cohort queries and use the same fetched metric value in chart/tooltip/breakdown. The retained per-game views provide regular-season season aggregates. Last-N windows, playoffs and fallback logs would need an explicit unavailable ranking state unless a separately scoped cohort implementation is approved. This option follows the selected historical season but does not provide last-N/playoff ranking coverage.
2. **Separate current-season comparison:** keep the current-season regular-season player row and cohort as an explicitly separate comparison. All shown comparison values, tooltips, percentiles and labels must use that same source. Historical/window/playoff controls must clearly identify that they do not change this comparison. This option keeps the existing cohort source but changes the presentation contract; it is not approved by this patch.

The native async policy reply subsequently selected option 1: selected-season regular-season aggregate, with rankings unavailable for last-N windows and playoffs. That reply arrived together with a new requirement to stop if Standard speed could not be verified. No scope code was changed after the choice. The parent/source thread remains unreachable by `send_message_to_thread` (thread not found), so this packet is the authoritative continuation handoff.

FRESH-03 also remains: a partially failed/missing metric can still enter the existing heuristic fallback without per-metric provenance. The delivered numeric guards prevent fabricated empirical ranks; they do not establish truthful fallback/unavailable presentation. Future work must reconcile chart values, scope labels, partial-error states and late request completion together, with offline regressions, under the now-selected option 1 once Standard speed is verified.

## Actual checks and review

From `web/`:

- **Passed:** `npm test -- --run components/PlayerStats/PlayerRadarChart.test.tsx` — 30/30. Retained before-fix evidence was 14 failed / 16 passed, saved by the original worker in its `red.log`.
- **Passed:** `npm test -- --run __tests__/pages/stats/player/playerId.test.ts` — 3/3 for the restored active caller. Earlier 5/5 evidence applies only to the saved, isolated caller increment.
- **Passed:** scoped ESLint for the radar component and adjacent test.
- **Passed:** scoped TypeScript check for the radar/component test/caller/route test and their real transitive dependencies using inherited `web/tsconfig.json` options. Configuration is saved as `typecheck-scope.json`; reproducible command: `./node_modules/.bin/tsc --project ../tasks/artifacts/radar-reconciliation-2026-10-15/typecheck-scope.json`.
- **Failed — resource limit:** full-tree `./node_modules/.bin/tsc --noEmit --incremental false` exited 134 after Node exhausted its approximately 4 GiB default heap, before diagnostics. No full-tree type-check success is claimed. The follow-up narrowed compilation roots rather than rerunning the full tree.
- **Passed:** scoped `git diff --check`.
- **Completed independent review:** no findings for the bounded correction or isolation, with explicit retained FRESH-02/03 limitations. Review was read-only and did not duplicate the tests.

`verification.json` retains command outcomes and available tool output; the noisy component-test output was truncated by the tool, but its passing 30-test summary was observed. Node was 22.11.0; installed Vitest was 3.2.7. No browser, production build, full suite, database, provider, production, deployment or push was run.

The request for full-tree check coordination was sent to Scout but returned thread not found. Local process listing was blocked by the sandbox. This owner ran only one full-tree TypeScript check, with incremental output disabled, followed by the narrower check above; no shared cache/configuration was edited.

## Pins and next action

`pins.json` records base HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`, `octoberBranch`, the two reviewed active-file hashes, the two restored caller hashes, the exact patch hash and the preserved scope patch hash. `radar-correction.patch` is the complete two-file active diff against HEAD; it includes the prior worker's regression tests. This is not a whole-repository release-candidate SHA.

Once Standard speed is verified, the next owner should implement the explicitly selected option 1 and reconcile the saved caller increment with the component and per-metric availability/provenance behavior. Preserve the reviewed arithmetic tests and number guards. Full-tree TypeScript remains unverified because of the heap failure; coordinate any future aggregate run with the parent. No processes remain running from this owner or reviewer.
