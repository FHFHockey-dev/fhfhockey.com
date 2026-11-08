# RC16 gate: RSO fixes and visual declutter

Claude orchestrator, 2026-10-29. Offline gate only. No push, deploy or production action.

## Candidate

- **Ref:** `refs/rc/rso-rc16` = `77234b790`. Its parent is `origin/master` `69ec142bd` (#399).
- **Contents:** 24 `web/` files, as exact blobs from `octoberBranch` commits `f3e95cf78` to `f552d0f4c`.
  - the reload-test fix;
  - the recent-form read fix;
  - calmer alternatives and the no-adds message;
  - ten TJ-approved UI-pass steps.
- **Base:** for every one of the 24 files, `origin/master`'s blob equals the `c91d8445f` blob.
- **Imports:** all 93 modules the files import, including SCSS `@use`, are identical to master.

## Results (full-tree `git archive` export, `node_modules` symlinked, heavy lock held)

| Check | Result |
| --- | --- |
| `tsc --noEmit` | exit 0 |
| `eslint .` | exit 0 (0 errors, 69 warnings) |
| CSS-module pure check, all 9 RSO stylesheets | pure |
| vitest, UTC | Failures are exactly the standing 6-file baseline |
| vitest, America/New_York | The same 6, plus the known 1000-player 13-day timing test (6.9 s at load 25–32). Rerun in the export: 148/148 twice. |

## Before the gate, in the working tree

- **RSO unit tests:** 422/422 on the final code.
- **End-to-end:** `e2e/rso-continuity.spec.ts` and `e2e/rso-acceptance.spec.ts` passed 19/19 on the final code. They ran on an isolated `:3170` server; `:3000` was not touched.
