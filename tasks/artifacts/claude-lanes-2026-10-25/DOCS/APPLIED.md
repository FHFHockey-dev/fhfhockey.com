# Applied doc fixes from STALE-POINTERS.md (2026-10-25)

No commit, no Git writes, nothing under web/ or tasks/artifacts/cross-platform/ touched. Both files were clean in `git status` before editing.

| File | sha256 before | sha256 after | Change |
| --- | --- | --- | --- |
| `tasks/tasks-prd-in-season-trust-clarity-decision-workflow.md` | `e4fc2b9ecdd0ac93dc93636a4ab0520fd499774f377fd70d7f77a9070591478b` | `d32c52dc5a9b83d425c949ff94de9f266f2b9548cd8158edc54ef84869470454` | line 8: `wigo-single-viewport.spec.ts` -> `wigo-one-page.spec.ts` (replaced in `4436789f1`); line 119: "WiGO viewport E2E" -> one-page E2E with spec path and `web/e2e/fixtures/wigo/` |
| `tasks/TASKS/wigo-single-viewport/report.md` | `b1b0fcf9316c8f03c851fb73782e53087d801fd297e8b0b0a6c59995be71ec7a` | `03686b745e98e6f60fbe884648060bc499772c2462c95ec7963622fee37e3880` | optional "spec deleted in `4436789f1`" note under `## Evidence` (2 lines added; body of the historical report untouched) |

Diff check: `git diff --stat` shows 4 insertions and 2 deletions across the two files; only the lines above differ.

Not applied (not fixes, or another lane's file): `tasks/tasks-prd-shareable-player-cards.md` Relevant Files addition (optional; player-cards lane is active), the `nhlSourceCapture.ts` and `RosterPlayerRow.ts` FYI items (need their doc owners to confirm).
