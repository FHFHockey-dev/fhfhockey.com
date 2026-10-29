# RC15 gate: RSO VORP S1–S3

Claude orchestrator, 2026-10-29. Offline gate only. No push, deploy or production action.

## Candidate

- `refs/rc/rso-vorp-rc15` = `54dc346f4b95e1a2abfea11c6f1a366e791b561c` (tree `57ef38a2`), parent `origin/master` `fec2ba2d2`.
- **Contents:** 19 `web/` files taken as exact blobs from `octoberBranch` commits `081fcb849` (S1), `9d70700ab` (S2) and `1a9aac33b` (S3). They show as 2,165 insertions and 31 deletions.
- **Base check:** for all 19 files, `origin/master`'s blob equals the `5453d2eca` blob, the commit S1 started from.
- **Import closure:** all 72 modules imported by the 19 files are identical to `origin/master`.

## Results (full-tree `git archive` export, `node_modules` symlinked, heavy lock held)

| Check | Result |
| --- | --- |
| `tsc --noEmit` (8 GB heap) | exit 0 |
| `eslint .` | exit 0 (0 errors, 69 warnings) |
| CSS-module pure check (RSO and StreamingItinerary SCSS; no SCSS changed) | pure |
| vitest, UTC | 1,143 files passed, 6 failed: exactly the standing 6-file baseline (related.server, nativeGoalLedgerAudit, nativeIntervalReconciliation, researchGoalBaseline, reserveProjections, qualify-native-players-offline) |
| vitest, America/New_York | The same 6, plus `RosterScheduleOptimizer.test.tsx` "reloads shared schedule data for manual" (load average 22–36) |

**The extra New York failure is a load flake, not a regression:**

- It is a 1 s `waitFor` on the re-plan after "Reload schedule data".
- **Run alone:** passed 238/238, then failed 1 at the peak load.
- **Isolated** (`-t`, 4 runs each): master 4/4, RC15 4/4.
- **Full file** (3 runs each): master 238/238 three times, RC15 238/238 three times.
- **Timing on the same load** (alternating, 3 runs): master manual 340–359 ms vs RC15 351–359 ms; yahoo 191–195 ms on both. S1's beam reserve does not slow it.
- The same test also flaked in the working-tree run under load before this gate.

## Behavior shipped

- **Visible (S1):** "Alternative · drop …" lines under Best Fit cards and in the streaming-plan picker. The primary recommendation and weekly numbers are unchanged.
- **Invisible (S2, S3):**
  - The later-impact engine stays gated at `scenario_contract_not_accepted`.
  - The scenario input path sits behind `RSO_LATER_IMPACT_SCENARIO`, unset in production, so it is off. With the flag off, the data response is byte-identical to the previous release.
