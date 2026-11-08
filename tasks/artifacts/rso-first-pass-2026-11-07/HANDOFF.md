# RSO first-pass correction candidate v2

## Result

The revised 16-file candidate is integrated into canonical source and ready for release-owner review. Both independent-review findings are corrected and re-reviewed. Exact-candidate checks pass: **2,301 regression tests, 63 Chromium cases, full TypeScript and scoped ESLint**. Nothing is published or deployed; current live-league acceptance remains separate.

- Base: `00ea36b39ee0c541fd6050b79703d2c054e97f1d` (#414).
- Original correction source: `2c20b5669c738f13d97daa55e4c93381908120a0`, plus the focused review correction below.
- Candidate tree: `4ba9b5dd1c6feb613f2f8e526fb280bb4b35c54e` (Git-free reconstruction; base tree independently checked).
- Candidate commit: none. No Git index/ref/commit mutation by this lane.
- Full #414-to-candidate patch: `CORRECTIONS.patch`, SHA-256 `f4d80f071a4d737ac90b2a872c7ac04ad98aabf5bbb0f555b52273ee937ef003`.
- Incremental review correction: `REVIEW-CORRECTION.patch` (planning.ts and planning.test.ts only).
- Full source/blob pins: `CANDIDATE.json`. Prior v1 identity/results are preserved in `candidate-v1/`; v2 supersedes them.
- Verification export: `/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/fhfh-rso-first-pass-20261107-rq7qrip0`. This is a Git-free verification copy, not another editing branch/worktree.

## Scope

Retains the existing November 4 correctness fixes: missing historical lineup locks fail certification; planning at puck drop is locked; future-observed schedule evidence is rejected; unsupported rules fail legality; healthy/ineligible reserve stashes block additions rather than the existing active lineup; stale-snapshot reacquisition is rejected; direct-to-reserve additions and unverified cross-reset waiver accounting are unsupported; season-long Yahoo points/roto is rejected rather than inventing caps.

The independent review found two incomplete edge cases in those existing corrections:

1. A non-reserve O/IR player whose game started could bypass missing-lock certification. Started occupants now require explicit active or bench evidence regardless of injury status. Known active/bench locks remain authoritative; unstarted out players and reserve occupants remain excluded.
2. A future acquisition effective exactly at puck drop could claim that game. Ownership must now begin strictly before game start; the transaction remains legal but that game is not credited.

Nine new regression cases cover O/IR × missing/active/bench locks and acquisition -1 ms/exact/+1 ms. On the old runtime, three reproduced the defects and six passed; all nine pass after correction. The reviewer independently passed ten focused cases, rechecked all source/tree/patch pins, and closed both findings. See `REVIEW-RESOLUTION.md`.

The candidate excludes the mixed source commit's Roster Autopsy, Trade Analyzer, Yahoo scheduler assertions, unrelated CSS and task documentation. It preserves #414 styling. The two reviewed planning files are now integrated as uncommitted canonical source changes. All 16 canonical candidate paths match the pinned release candidate. Other dirty files and canonical dependencies are untouched.

## Canonical integration

At 22:45 UTC, applied only `REVIEW-CORRECTION.patch` to the two clean canonical planning files after checking original blobs, current ownership and patch applicability. Scope: 55 insertions / 3 deletions; no index/ref/commit or branch changes. Fresh read-only GitHub check confirmed master remains #414. All 16 canonical paths now match the unchanged v2 candidate.

Fresh verification: 173 planning tests and two-file lint passed; all 4,794 tracked export files still match. Existing full checks below apply to the exact unchanged tree and were not unnecessarily repeated. See `CANONICAL-INTEGRATION.json` and `INTEGRATION-CHECKS.json`. Coordination handoff: `tasks/artifacts/codex-handoff-2026-11-07/09-rso.md`.

## Actual v2 verification

- Relevant RSO/Yahoo/forecast-use regression suite: **104 files / 2,301 passed, zero failed or skipped**.
- Full TypeScript: passed, exit 0.
- Scoped ESLint on all 16 paths: passed, exit 0.
- Chromium: **63 passed, zero failed or skipped (2.5m)** across `roster-schedule-optimizer.spec.ts`, `rso-acceptance.spec.ts` and `rso-continuity.spec.ts`. Covers desktop/mobile, manual/connected fixtures, legal planning, refresh/Undo/reopen, account/league isolation, save conflicts, missing data, stale work and offline-misreport behavior.
- Source integrity: **4,794 tracked export files match the expected candidate**, zero mismatches. Three copied environment files are deliberately omitted. Browser-generated next-env.d.ts was restored to its pinned source; scaffolding is not in the patch. See `SOURCE-PINS.json`.
- Reverse patch check passed without mutation. Independent reviewer also verified full tree and all 16 pins.
- Producer impact: zero overlay paths intersect the 195-module closure from the base-referenced receipt. This is impact analysis, not new qualification or admission of the entire base.
- Server stopped; port 3164 verified free; RSO heavy slot released.
- Local production build: not run, no build-specific need. No remote builds, application/production database calls, or live Yahoo requests.

Checks use Node 22.11.0, UTC, inert values, no environment files, Node outbound guard and browser fixture interception. The earlier SSR setup issue was a copied nested dependency symlink producing two React instances; only the copied link was removed. Application code did not need a React fix. Historical diagnosis: `SSR-ROOT-CAUSE.json` and `BROWSER-BLOCKER.md`.

Current receipts: `CHECKS.json`, `regressions-results.json`, `types.json`, `lint.json`, `browser-reviewed-v2.json`, and corresponding logs. Earlier browser-clean-react receipts refer to v1, not v2.

## Next

1. Release owner reviews the exact v2 candidate and the two integrated uncommitted files. `CORRECTIONS.patch` is based on #414. `REVIEW-CORRECTION.patch` has already been applied to canonical source; do not replay it there. Git custody remains with the current release owner.
2. Reconcile any changed release base while preserving concurrent work, then verify the exact integrated candidate rather than reuse old receipts unchanged.
3. Agree and authorize a bounded current manual/Yahoo real-league acceptance window. Passing fixture suites do not establish live forecast coverage or final user acceptance.
4. Obtain separate approval for any push/deployment/release or live league access. Verify the approved release within the agreed smoke budget. No such approval is implied by these checks.

Observed at handoff: canonical HEAD `45386c9a26178b33adc816daae8d479152085fa1`; local `origin/master` `00ea36b39ee0c541fd6050b79703d2c054e97f1d`. This lane changed only the two listed planning files; all concurrent work was preserved.
