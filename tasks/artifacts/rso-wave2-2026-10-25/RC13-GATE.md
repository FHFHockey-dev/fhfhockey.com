# RC13 gate: RSO batch (2026-10-28)

- **RC:** `cae4d72dbb0c60708d6021bf51ff5dcc89f56969` (`refs/rc/2026-10-28-rso-batch`), parent master `d35d82a21` (#396).
- **Content:** the exact blobs of 32 `web/` files at octoberBranch `439966985`, covering commits `15e86fcc2..439966985`:
  - small items;
  - goalie minimum, accept risk, blended ranking, drop candidates and waiver claims;
  - plan-from slider (no Yahoo reads), full week and the Full week reset;
  - collapsible Streaming Plan;
  - compact cards with L/PP chips and L5 stats.
- **Scope:** master matched the pre-batch sync point `4a81e3d41` for all 32 files. The 45 unreleased social-share, team-logo and e2e files are excluded, and nothing in the batch imports them (2 basename false positives on `types.ts`).

## Gate (full-tree export, heavy lock held)
| Check | Result |
|---|---|
| tsc | exit 0 |
| eslint | 0 errors, 69 warnings (same as RC11/RC12) |
| CSS-module pure check (7 touched `.module.scss`) | all PURE |
| vitest UTC | 1140 passed, 7 failed, 3 skipped files; 14298 passed, 6 failed tests |
| vitest America/New_York | identical |

Six of the failing files are the known baseline, the same as RC11/RC12 and master. None of them is RSO.

The seventh is `components/TeamStandingsChart/TeamStandingsChart.test.tsx` ("renders every division and team, supports bulk selection, and reaches game 82"). The RC doesn't touch it. It passed alone 3/3 in the RC export, on the master-tree export and in the checkout, so this is a timing flake under machine load (load average 50–120 during the run).

## Release-time cost notes
- The planning read adds two capped deployment reads: `lineCombinations` (≤600 rows) and `powerPlayCombinations` (≤1,280). Both run under the 2 s deadline, and a timeout or failure only drops the chips.
- Slider moves make no Yahoo reads (`fe5eecd9b`).
- Not browser-verified, including phone width.
