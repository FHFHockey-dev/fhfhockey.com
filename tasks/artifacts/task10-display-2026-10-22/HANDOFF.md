# Task 10 F7/F8 — integrated local candidate

Canonical checkout, octoberBranch, HEAD `84cb1229cd1c1cdd037c43e660d2a181304ada51`. No commit/push/deployment, production request, database mutation, paid call or coefficient change. Local display implementation is complete; separate combined qualification/review remains with root.

## Implementation

- `planning.ts::gameForecastPoints` returns complete applicable weighted totals or null. Reuses planner stat applicability and target totals permissions. Expected stats are already unconditional. Conditional FP comes directly from raw conditionalStats or selected per_start contribution means; never divides by probability. Per-appearance/unconditional contribution bases cannot become if-starts values.
- `RosterScheduleOptimizer.tsx` now calls that helper only with the current admitted display snapshot and selected forecastInputs. No saved/raw numeric fallback was added.
- `SlotWeekGrid.tsx` renders the ForecastPoints component, shows unavailable values as em dashes, and uses expected FP alone for lineup tiers. Legend and visible goalie labels distinguish expected from conditional if-starts FP. Recorded past-day actual values keep their original path.
- Goalie rows have a separate bottom points row and sufficient height for both labels. An offline actual-grid screenshot exposed name collapse at narrow widths; the corrected layout preserves names and values.
- Nine files are pinned in `candidate.json`; `implementation.patch` contains task10 changes only. `after/` freezes exact candidate source. Both UI files matched P07 release pins before editing. All eight P07 R2 files and the other 30 P07 candidate pins remain unchanged.
- The planner mismatch P07 reported was this task's earlier helper: SHA256 `09918cdb16f2eeee00554448b953c16f773b2e3f42455e213dac7e4f38ec5474`. It was identified, preserved, and not edited during UI integration. No other planner hunk changed.

## Verification

- Node v22.11.0, npm/Vitest. `FINAL-TESTS.log`: **243 passed, five files** (19 scorer, 3 renderer, 6 grid, 6 new full mounted RSO, 209 existing RSO cases).
- Full mounted cases run the actual UI/hook/adapter/policy with external fetches stubbed: complete/missing weighted keys, goalie expected/if-starts labels, zero/missing probability without division, one shared current read, and denied unreviewed native numbers.
- After layout correction: **15 repeated component cases passed**, `POST-LAYOUT-TESTS.log`. Not added to the distinct count.
- Focused ESLint: exit 0, no errors; six existing hook warnings outside edited hunks in RSO. `LINT.log`.
- Scoped diff whitespace check passed.
- Full shared-tree TypeScript under `/private/tmp/fhfh-heavy.lock`: **failed with two external diagnostics only**, `web/scripts/forge-skater-candidate-ablation.ts:115,136` (Buffer not assignable to BinaryLike). The task10 fixture's prior 11 diagnostics were corrected using a fully typed snapshot/player fixture and explicit scoring-weight type. No production types or unrelated files changed. Lock acquired by atomic mkdir and own lock released. `TYPECHECK.log`.
- Offline browser layout: actual SlotWeekGrid server markup plus compiled SCSS, all page requests aborted; 700 px and 1100 px screenshots inspected. All 14 mobile cells fit; goalie name area increased from 0 to 71.7 px. `grid-mobile.png`, `grid-desktop.png`, `grid-layout.json`, `grid-fixture.html`. Logo fetches are intentionally blocked; this is a fixture layout check, not full application E2E.
- Initial sandbox Chromium launch failed at macOS MachPort permission; the approved escalated offline render succeeded. No uncertain/active browser process remains.

## Remaining ownership

Root should route the two ablation-script TypeScript errors to its owner and qualify this candidate alongside P07 R2 separately. P07 independent-review snapshots were not updated or relabeled. No predictive skill, native source approval, full browser E2E, or release claim is made. All own operations finished; no pending lease or denied action remains.
