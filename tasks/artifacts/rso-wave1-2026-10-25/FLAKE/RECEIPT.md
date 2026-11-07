# RSO-FLAKE receipt (2026-10-25, Claude)

File: `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` (only file changed; not committed)
- sha256 before: `4970f2c79e66483aa9c341468ba38fdfaa8ab25e9007cf2aef9b0a753b4c48a4`
- sha256 after:  `bede9e5ffefcc8e9c563b30ac01d3752baf674616fac059a443279730c84f32e`

## Root cause (test-only ordering race, not a product bug)
Test: "stored Yahoo eligibility while provider verification is pending > recomputes provisional assignments from a fresh database receipt before Yahoo returns, then uses live league positions".

The test holds two fetches open: `/provider` (assigns `releaseProvider`) and `/eligibility?` (assigns `releaseCache`). It waited only for `releaseProvider`, then called `releaseCache` right away.

The two requests come from independent paths in `RosterScheduleOptimizer.tsx`:
- Provider: auto-refresh effect → `refreshProvider` → `authHeaders()` → fetch `/provider`.
- Eligibility: `useYahooEligibility(..., enabled = yahoo && usingRetainedRoster && !!data && ...)` (`hooks/useYahooEligibility.ts`). `data` only exists after the mocked `executeRosterPlanning` resolves `/data`, runs `planRoster`, then `setLoadedData` → re-render → hook effect → fetch `/eligibility?`.

Probe timing (alone, unloaded): access 58.8 ms, workspace 59.1, data 60.0, **provider 79.7, eligibility 81.4**, and waitFor passed at 109.7. The provider request is always issued first. Any waitFor check (interval or DOM-mutation triggered) that falls in that gap passes with `releaseCache` still unassigned → `TypeError: releaseCache is not a function`. Full-suite worker contention and GC pauses widen the gap. A module cache collision was ruled out: player id 8157 appears only in this test, and Vitest isolates modules per file.

The product behaviour is intended: the eligibility read is designed to wait for the current `/data` generation. Nothing in product code needs changing.

## Fix
Wait until both held requests have been issued before releasing either:
`await waitFor(() => { expect(releaseProvider).toBeTypeOf("function"); expect(releaseCache).toBeTypeOf("function"); });`
No assertion was removed or loosened. Provider is still held, so "before Yahoo returns" is still exercised.

## Repro and runs (local, `web/`, Node via npx vitest 'run')
| Condition | Before fix | After fix |
|---|---|---|
| Targeted test, 32 node CPU burners on 16 cores, 6 runs | 6/6 pass (load alone did not reproduce) | n/a |
| Targeted test, temporary 80 ms delay on `/data` (injected, then reverted) | **FAIL: `TypeError: releaseCache is not a function`** | 5/5 pass |
| Whole file, 32 CPU burners | n/a | 5/5 pass, 209/209 each (67–74 s) |
| Whole file alone | 209/209 (per orchestrator: 3× earlier) | 209/209 (24.1 s) |
| `npx eslint <file>` | n/a | clean (exit 0) |

Injected-delay edits were applied to a temporary copy of the owned file only and restored. The final sha was verified to match "after" above.
Not run: full `npm run test:full` suite (not required; the deterministic injected-delay repro covers the failing ordering). tsc was not run (change is a waitFor body only).
