# RC14 gate: diet-off upkeep stopgap + visible confirm gate (2026-10-29)

- **RC:** `008f70c6bc87c2e3ffc4b52a09b2229eb040dd2a` (`refs/rc/2026-10-29-upkeep-confirm`), parent master `2126296d2` (#397).
- **Content:** the exact blobs of `c3cf52629`, 7 `web/` RSO files. Master matched the sync point `e4fb6f146` for all of them. The only new import is `vitest` in the test file.

## Gate (full-tree export, heavy lock held)
| Check | Result |
|---|---|
| tsc | exit 0 |
| eslint | 0 errors, 69 warnings (unchanged) |
| CSS-module pure check (2 touched `.module.scss`) | PURE |
| vitest UTC | 1141 passed, 6 failed, 3 skipped files. The 6 are the known baseline (none RSO). |
| vitest America/New_York | 7 failed. The extra one is `lib/rosterScheduleOptimizer/planning.test.ts` "evaluates the entire 1000-player population across 13 days": a 5,000 ms timeout under load. The RC doesn't touch `planning.ts`. Rerun in the RC export: 145/145 twice. |

## Expected effect
With the diet flag off, a visible, active RSO tab drops from about 780 to about 130 Yahoo reads per hour. Upkeep stops after 60 idle minutes. Load and manual Refresh are unchanged. Not browser-verified.
