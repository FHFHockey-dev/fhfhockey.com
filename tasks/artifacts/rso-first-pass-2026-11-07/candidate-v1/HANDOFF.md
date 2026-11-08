# RSO first-pass correction candidate

## Result

A 16-file correction candidate is prepared against release #414 and is ready for review. Exact-candidate verification passed: 2,292 regression tests, 63 Chromium acceptance cases, full TypeScript and scoped lint. Nothing is published or deployed.

- Base commit: `00ea36b39ee0c541fd6050b79703d2c054e97f1d`.
- Source correction commit: `2c20b5669c738f13d97daa55e4c93381908120a0`.
- Candidate whole-tree identity: `50766b2d31d6f5a6b9cbbcc3565be91152080c9e` (reconstructed without Git writes; base reconstruction verified).
- Candidate commit: none. Git index/refs remain with the release owner.
- Patch: `CORRECTIONS.patch`, SHA-256 `0036f083d55833f90f05269c0c5fe4a4a19ed2e48d7f0c9f9b6168bd870e0efb`.
- Full path/blob/SHA-256 pins: `CANDIDATE.json`.
- Local verification export: `/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/fhfh-rso-first-pass-20261107-rq7qrip0`. This is not another editing checkout/worktree.

## Correction scope

Retains the already implemented November 4 fixes: missing historical lineup locks fail certification; puck-drop equality is locked; future-observed schedule evidence is rejected; unsupported rules fail legality; healthy/ineligible reserve stashes block adds rather than the existing active lineup; stale-snapshot reacquisition is rejected; direct-to-reserve additions and unverified cross-reset waiver accounting are explicitly unsupported; season-long Yahoo points/roto is rejected rather than inventing cap rules.

Contains runtime changes and their existing unit/Chromium assertions only. Excludes the source commit's Roster Autopsy, Trade Analyzer, Yahoo scheduler assertions, task documentation and unrelated CSS. Preserves #414's released presentation work. Canonical application files are unchanged.

## Actual verification

- Combined RSO/Yahoo/forecast-use tests: **104 files, 2,292 passed, zero failed or skipped**. Of these, **61 RSO files / 1,517 tests** passed.
- Full TypeScript: passed, exit 0.
- Scoped ESLint on all 16 paths: passed, exit 0.
- Reverse patch application check: passed without mutation.
- Producer impact: no overlay path intersects the 195-module producer closure named by the base's verified receipt. This is impact analysis, not a new scientific qualification or validation of the entire base release.
- Browser: **63 passed, zero failed or skipped (2.4 minutes)** across `roster-schedule-optimizer.spec.ts`, `rso-acceptance.spec.ts` and `rso-continuity.spec.ts`. Desktop/mobile, manual/connected fixture behavior, legal planning, refresh/Undo/reopen, account/league isolation, save conflicts, missing data, stale work and offline-misreport checks ran on the pinned candidate. See `browser-clean-react.json` and `.log`.
- Resolved verification issue: a copied nested dependency symlink made ESM QueryClientProvider use canonical React while the renderer used private React. Removing only the copied symlink fixed SSR; no application-source fix was necessary. Canonical dependencies are untouched. Exact stack and resolution: `SSR-ROOT-CAUSE.json` and `BROWSER-BLOCKER.md`.
- Cleanup: own listener stopped; port 3164 confirmed free and RSO heavy-slot ownership released.
- Local production build: not run; no build-specific change requires one.

Checks use Node 22.11.0, UTC, inert environment values and a Node outbound guard. The export contains no environment files; the original tracked files are untouched. Browser fixtures intercept provider/auth/data requests. No live Yahoo, production application/database calls or remote builds.

## Next

1. Parent/release owner reviews the exact patch and candidate. It extracts already implemented corrections, not a new product redesign. No local technical blocker remains in the performed checks.
2. Before any integration, reconcile against the then-current release base and preserve concurrent canonical work. If the base changes materially, verify that exact integrated candidate rather than reuse these results unchanged.
3. Agree the bounded current manual/Yahoo real-league acceptance window. The passing Chromium cases use fictional fixtures; they do not establish live forecast coverage or final user acceptance.
4. Obtain separate authorization for any release/push/deployment or live league access. Then verify the approved release with the agreed bounded smoke budget. Existing producer-closure impact analysis is not a new scientific qualification.

At handoff, `origin/master` still resolves to the pinned #414 base. Concurrent canonical `HEAD` advanced to `96cc64d631e6f6bda63d705e19e1117c8629fd22`; this lane has not changed or incorporated that work. Reconcile any new release-base changes before committing the candidate.
