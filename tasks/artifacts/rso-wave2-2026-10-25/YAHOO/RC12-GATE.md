# RC12 gate: Yahoo matchup dates kept for the whole period (2026-10-27)

- **RC:** `e6bd4068e3002af3f67891a78e9f0a9fe6026a46` (`refs/rc/2026-10-27-matchup-dates`), parent master `3a2f115d4` (#395).
- **Content:** the exact blobs at `620ed5b66` of `web/lib/rosterScheduleOptimizer/workspace.ts` and `workspace.test.ts`. Master matched the pre-fix versions of both. The only new dependency is `localDate`, which the file already imports.
- **Gate (full-tree export, heavy lock held):**
  - tsc: exit 0
  - eslint: 0 errors, 69 warnings (same count as RC11)
  - vitest in UTC and America/New_York: 1140 passed, 6 failed, 3 skipped files. The 6 failing files are identical to the RC11/master baseline (none in RSO).
- **Cause and fix:** see WINDOW-RESULTS-2b-2026-10-27.md, R4 notes.
