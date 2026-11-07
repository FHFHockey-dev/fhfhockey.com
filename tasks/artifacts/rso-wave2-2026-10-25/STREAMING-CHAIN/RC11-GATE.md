# RC11 gate: RSO streaming chain + last-10 FPts hint (2026-10-27)

- **RC:** `b5d4af6e8c6abe007e85e6ce6c1746c496a336d5` (`refs/rc/2026-10-27-streaming`), tree `def6f9809d37…`, parent master `93a55d4c4` (#394).
- **Content:** the exact blobs at `a7dfb06a1` of 13 files (the 979c05ae1 + a7dfb06a1 changes). It matches `a7dfb06a1` for all 13. Before these commits, octoberBranch matched master for these files.
- **Closure:** none of the 99 import specifiers resolves to the 45 unreleased octoberBranch web files (socialShare, SocialShare, teamLogos, one e2e).

## Gate (full-tree `git archive` export, node_modules symlinked, heavy lock held)
| Check | Result |
|---|---|
| `tsc --noEmit` (8 GB heap) | exit 0 |
| `eslint .` | 0 errors, 69 warnings |
| CSS-module pure check (`StreamingItinerary.module.scss`) | PURE |
| vitest UTC | 1140 passed, 6 failed, 3 skipped files; 14257 passed, 5 failed tests |
| vitest America/New_York | identical |

The 6 failing files are the same 6 that fail on the master full-tree export at RC10: `related.server`, `nativeGoalLedgerAudit`, `nativeIntervalReconciliation`, `researchGoalBaseline`, `reserveProjections`, `qualify-native-players-offline`. None of them is RSO. There are no new failures.

## Release risks
- Nothing has been checked in a browser. The itinerary has component tests only.
- The recent-form read pulls `wgo_skater_stats` and `wgo_goalie_stats` over 30 days, 20 columns, inside a 2 s budget. A timeout only drops the hint and chips. The partial `games_played = 1` date indexes exist. Check it in the RSO route timing in the Vercel logs on the next real use.
