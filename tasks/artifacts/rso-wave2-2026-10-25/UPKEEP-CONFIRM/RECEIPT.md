# RSO upkeep stopgap and visible confirm gate — receipt (2026-10-29)

Lane: `rso-upkeep-confirm` (Claude), started by Chef after TJ's 10-29 real-league test. Offline only: no production calls, Yahoo reads, pushes or deploys.

## 1. Timed upkeep stopgap (diet flag off)

**Change** (`web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx`):

- **Cadence:** a Yahoo league with the server's `yahooDiet` flag off now runs timed provider upkeep every **30 minutes** (`FULL_SNAPSHOT_REFRESH_INTERVAL`), not 5. Backoff after a partial or failed tick never drops below that interval.
- **Idle stop:** after the first load, a due tick is skipped once the page has gone **60 minutes** without interaction (`FULL_SNAPSHOT_IDLE_STOP_MS`).
  - Interaction means `pointerdown`, `keydown`, `focus` or `wheel`, captured passively on `window`. The `focus` listener also catches the window itself regaining focus.
  - The next interaction resumes upkeep through the same `refresh()`, so it never runs sooner than the cadence (`nextAutoAt`) allows.
  - A `visibilitychange` back to visible doesn't count as interaction.
- **Unchanged:**
  - the first load, manual Refresh provider, the visibility and online rules, and the single-tab lease (diet-on only);
  - the access poll, which only calls `/access`;
  - the flag-on cadence of 5 minutes with no idle stop.
- **Scope:** Fantrax keeps 5 minutes. The stopgap is keyed to `provider === "yahoo" && !yahooDiet`, because the diet flag and the 64 + d cost are Yahoo-only. Chef can widen it with a one-line change if wanted.
- **Events can't jump the cadence:** `visibilitychange`, `online` and interaction all go through `refresh()`, which checks `nextAutoAt` and `cooldownUntil` before anything else.

### Reads per hour (flag off, S = 64 + d ≈ 65 reads per snapshot; REAL-ACCOUNT-PLAN-2b "Per snapshot")

| Scenario | Before (5 min) | After (30 min + idle stop) |
|---|---|---|
| Visible and active, per hour | 12 ticks × 65 = **780** | 2 ticks × 65 = **130** (−83%) |
| 2-hour active session (incl. first load) | 1 + 24 = 25 snapshots ≈ **1,625** | 1 + 4 = 5 snapshots ≈ **325** |
| Tab left visible, untouched for 8 hours | 1 + 96 = 97 snapshots ≈ **6,305** | first load + 30-min tick, then stopped: 2 snapshots ≈ **130** |

With d = 6 (the week's last day), S = 70: active is 140/hour instead of 840.

## 2. Visible "Confirm planning inputs" gate

When unconfirmed inputs are the only blocker (not read-only, scoring entered):

- **Streaming Plan:** the reason "Confirm planning inputs to enable this streaming plan." sits beside **Use this streaming plan** (`#rso-streaming-reason`, wired through `aria-describedby` as before), with an inline **Confirm planning inputs** button.
- **Best Fit:** a prompt box at the top of the panel body reads "Confirm planning inputs to enable Preview swap." (`#rso-swap-reason`) and has the same button. Each disabled **Preview swap** now carries `aria-describedby="rso-swap-reason"`; the id is threaded through `CandidateBrowser` to `CandidateCard`.
- **Same action:** both buttons call `setReviewedInputs(reviewKey)`, like the button in League rules and scoring.
- **Confirming unavailable** (no snapshot, no roster): the prompt shows the `confirmUnavailable` text instead of a button.
- **Other blockers keep their own reasons:** read-only shows "Saved inputs are read-only."; missing scoring shows "Enter league scoring…"; both together show "Review and confirm…". Preview swap now has an accessible reason in those cases too. Select plan (alternatives) is unchanged.
- Styles: `.confirmGate` (`RosterScheduleOptimizer.module.scss`) and `.gate` (`StreamingItinerary.module.scss`).

## Tests

New, in `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`. The upkeep tests use fake timers and count mocked `/provider` fetches.

- **Diet-off upkeep:**
  - 2 hours visible and active: 1 initial + 4 timed snapshots, all `auto`.
  - Idle: snapshots at 0 and 30; the 60-minute tick is skipped and nothing runs through 3 hours. A visible return doesn't resume; a key press does (the snapshot is overdue). Further interaction gives no snapshot before the next 30-minute mark.
  - Flag on: 5-minute cadence and no idle stop (15 reads in 70 minutes).
  - Manual Refresh provider is immediate (`manual`), and the timed cadence restarts from it.
  - Hide/show, window focus and `online` inside the window add no snapshot; the tick still lands at 30.
- **Confirm gate:**
  - Unconfirmed: both prompts render, and the disabled Use this streaming plan and Preview swap are each described by their reason.
  - Clicking the Best Fit prompt enables both, removes the prompts and reasons, and Preview swap then selects the step.
  - No roster: the prompt shows "Add roster players before confirming inputs." and no button.
- **Adjusted existing tests:**
  - Seven generic scheduler tests (backoff, Retry-After, 403 pause, retired 429) now return `yahooDiet: true` bodies (`dietBodies`), so they keep testing the engine at its unchanged 5-minute cadence.
  - Three tests that click the rules-section confirm are scoped to `#rso-rule-settings` (`rulesConfirm()`), because a second button with that name now exists.
- **Harness:** the planning mock can return `planningState.metrics`, reset in `afterEach`.

## Checks

| Check | Result |
|---|---|
| RSO tests (`__tests__/components/RosterScheduleOptimizer`, `components/RosterScheduleOptimizer`, `lib/rosterScheduleOptimizer`), `TZ=UTC` | passed: 45 files, 1072 tests |
| Same, `TZ=America/New_York` | passed: 45 files, 1072 tests |
| `npx tsc --noEmit` (8 GB heap, under `/private/tmp/fhfh-heavy.lock`) | passed |
| eslint on the touched TSX files | 0 errors; the same 6 `exhaustive-deps` warnings as HEAD |
| CSS Modules pure check (sass + `postcss-modules-local-by-default` pure mode) on both touched `.module.scss` files | passed |
| Browser preview | not run (no Yahoo sign-in allowed; covered by jsdom tests) |
