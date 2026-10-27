# RSO layout + plan-from slider · receipt (2026-10-27)

TJ's three 10-27 layout asks, implemented offline on `octoberBranch` (base `4a81e3d41`). UI files only. Nothing pushed or deployed.

## Changes

1. **Team schedule day cells fill the row.** Each `.days` cell in `TeamScheduleContext` now has the class `.dayCell`: a flex column with the weekday label on top and the game box (`b`, `flex: 1`) stretching to the card's row height. `.days` stretches with `grid-auto-rows: 1fr`.
2. **Plan-from slider** (new `PlanFromSlider.tsx` / `.module.scss`; it reuses the By player day-slider look):
   - **Placement.** It sits in a row above the Mon–Sun date header in every schedule view: By position (`SlotWeekGrid` thead row), By player (a sticky `.dayControls` row above the `CompactSchedule` table, spanning day columns 2–8) and Itinerary (`StreamingGrid` thead row with fixed column widths). Each stop is centred over a day column.
   - **Re-planning.** Picking a day sets `workspace.context.startDate` (the "Planning setup" From date) to that day and keeps the end date. The lineup, add proposals and the streaming chain all bound their games by `context.startDate`, so the plan starts there.
   - **Clamping.** The slider stays between max(today, week start) and the range end.
   - **"Current week" auto-range.** The slider edits with range origin `"custom"`, so that effect (it only runs for origin default/current) leaves the chosen start alone. The page test covers this.
   - **Back to today.** A "Planning from … · Back to today" note appears while the start is shifted. Going back restores the week start, with origin `"current"` when that range equals the current range.
   - **Greyed days.** The views show the whole week. Days before the plan start are greyed:
     - `data-greyed` in By position, `.greyedDay` in By player and Itinerary.
     - Skipped days show no plan: no player buttons, no bench chips, no Filled count.
     - Elapsed days keep their recorded lineup, greyed.
     - In By player, days outside the range stay disabled.
   - **The week shown** comes from the matchup week ending on the range end. If none matches, it is the current range, then where the slider began (a ref).
3. **Bench Days:**
   - Every player shows by default; "Show fewer" folds the list to the top 5.
   - Columns are fixed: name `minmax(0, 92px)` | strip `minmax(0, 1fr)` (takes the spare width) | count `34px` | split `66px`.
   - A day-label row (Sun/Mon/…) uses the same grid and the same per-date strip columns. A date missing from one player's ledger keeps an empty cell, so every strip lines up under its labels.

## Planner check (no `lib/` edits)
`planning.ts` filters lineup games (lines 255, 636, 1204) and add-proposal dates (line 1240) by `snapshot.context.startDate`. `streamingChain.ts` starts at max(today, `context.startDate`). So a later start date is honoured for the lineup and acquisitions; nothing needed from `lib/`.

## Cost to know (not a blocker)
A new `startDate` changes the workspace context key (`accountKey`). The provider upkeep effect then runs its initial refresh, which is **one Yahoo provider snapshot per newly chosen start day**. Returning to an already-read key within the 5-minute upkeep interval does not re-read. The slider bounds this:
- A drag commits once, on pointer release.
- Keyboard and other changes commit once they have settled for 600 ms (`PLAN_FROM_SETTLE_MS`).
- No commit happens per drag tick.

The planning-hook current read (our `/data` route, or the private Yahoo read) is also per context, as for any range change.

## Files (sha256)
```
9b2829a06a338485c969de101ec88834c2cd20edc9c972ed67e82d6a456738df  web/components/RosterScheduleOptimizer/PlanFromSlider.tsx
da8c9fbbf548057e99102c35fe637e78e6491686f472eab6e59b1716ed432538  web/components/RosterScheduleOptimizer/PlanFromSlider.module.scss
ff387930e5ad225c1df2fc5fcdc8770a3f0e5ee0195e9a902e38b329b7bfe12f  web/components/RosterScheduleOptimizer/PlanFromSlider.test.tsx
7ed25e2eac13bf10848eb9d529dc2974cd9010ce93a12264adbde673362d15c1  web/components/RosterScheduleOptimizer/TeamScheduleContext.tsx
d8882afdbbe7c993887741f0c073a5d20610a2c7ed06936d60a42a4a5514ea4d  web/components/RosterScheduleOptimizer/TeamScheduleContext.module.scss
16baeefd56b2378976bc75450b1b9a653b2767c800ae916fcee576d5cf3bee63  web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx
1772cb962b0d0a7b2f83472178e65d3596c167249fe1f102d3c5cef664972704  web/components/RosterScheduleOptimizer/BenchDays.tsx
db559b4fe5c54d1da614653c9047acebfeb2fae84c5aa33aa63b2a77749a57a3  web/components/RosterScheduleOptimizer/BenchDays.module.scss
08641fce2d69e58d57ca24dc6536d6ff24b5f1ecde5995ee1e9a0b8c40577cdb  web/components/RosterScheduleOptimizer/BenchDays.test.tsx
f37e334e1d77259cec38c5fbabf817b831c9bc10ec4a79f021b7075ed95cdf6d  web/components/RosterScheduleOptimizer/CompactSchedule.tsx
484785efa99c28d4b5800c7319023a563dd6b36f062c51765f1515d9d8672e75  web/components/RosterScheduleOptimizer/SlotWeekGrid.tsx
46b446183399b7f7f2c8d34ceb74ae88e3bdc6a3f7f1ab0a09f9a213c681d34a  web/components/RosterScheduleOptimizer/SlotWeekGrid.module.scss
41e40380effe8fa83dbd19a8949de911a2bf9a14ef262357c0299a9f11fd354f  web/components/RosterScheduleOptimizer/SlotWeekGrid.test.tsx
2be24667d7bf515bd82ba7cb89a724f55bd80d8f1b4095c5486e112bff5fdca7  web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx
33f7fcafbe0c0d31441391cd0fe265486027c08ca9e6a95ed800d3a193d9e9f5  web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss
f0ba0fa754871a330812655a95c3c5ad3c67d86971b3a494762dbd068d3bb7b3  web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx
```

## Commands and results (all run from `web/`, `GIT_DIR` unset)
| Check | Result |
|---|---|
| Focused tests: `PlanFromSlider`, `BenchDays`, `TeamScheduleContext`, `SlotWeekGrid` component tests; RSO page test `-t "plan-from slider"` | passed (29 + 1) |
| `TZ=UTC npx vitest run components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer lib/rosterScheduleOptimizer` | passed: 45 files, 1045 tests |
| The same with `TZ=America/New_York` | passed: 45 files, 1045 tests |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, under `/private/tmp/fhfh-heavy.lock` (taken with noclobber, then released) | passed (rc 0) |
| `npx eslint` on the 11 touched TS/TSX files | 0 errors; 6 pre-existing `exhaustive-deps` warnings in `RosterScheduleOptimizer.tsx` (lines 348–751, none in new code) |
| CSS Modules pure check: sass, then Next's `postcss-modules-local-by-default` `{ mode: "pure" }` on all 5 touched `.module.scss` files | passed. The check was confirmed to reject a planted impure selector. |

New or updated tests:
- **Full-height day cells:** class and structure, plus the SCSS rules.
- **Slider:**
  - It snaps and greys the track.
  - A drag commits once, on release.
  - The keyboard commits after it settles, and never before today.
  - It hides when no day is plannable.
- **By position greying:** elapsed days stay, skipped days are empty and greyed.
- **Page:**
  - The slider re-plans the From/Through range.
  - The auto-range doesn't snap it back.
  - The slider is in all three views.
  - "Back to today" restores the week.
- **Bench Days:**
  - All players show by default; "Show fewer" folds and "Show all" unfolds.
  - The label row lines up with each strip, including a missing date.
  - The column template.

## Limits
- **Not browser-verified.** I ran no preview: even manual mode reads schedule data from the shared Supabase project, which is a production call. Column alignment of the slider stops is by CSS arithmetic and is not visually checked. The Itinerary grid switches to `table-layout: fixed` (96px slot column, `min-width: 720px`) while the slider shows.
- **Bench Days** still lists only today-onward dates (elapsed days are left out, as before), so its label row covers the remaining days, not a fixed Mon–Sun.
- **Elapsed in-range days** stay selectable in By player as a view of the recorded lineup. They are greyed, but this is viewing, not editing.
- **A shifted start persists** like any custom range: a saved workspace reopens "restored" and is not auto-advanced. This is existing behaviour for custom ranges.
- No production calls, Yahoo reads, pushes, deploys or migrations were made.

---

## Follow-up: the slider reads nothing from Yahoo (Chef ticket, 2026-10-27)

This replaces the mechanism and the "Cost to know" section above. **The slider no longer edits `workspace.context.startDate`.**

**Mechanism now:**
- **What the slider changes.** It sets view state `planFromChoice = { key: accountKey, date }`. `RosterScheduleOptimizer.tsx` derives `planningSnapshot`, which is `inputSnapshot` with only `context.startDate` narrowed to that day and the id suffixed `:from:<date>`.
- **Who uses it.** `useRosterPlanning` (lineup, adds, streaming chain) and `CandidateBrowser`'s candidate metrics both run on `planningSnapshot`. Planning re-runs locally from the snapshot that was already read.
- **What stays unchanged.** The workspace context, `accountKey`/`workspaceContextKey`, provider upkeep, account workspace reads and the saved workspace are all untouched, so a slider move starts no provider refresh. No `lib/` edits were needed.
- **Private read.** While the start is shifted past today, `executionOptions.yahooPrincipalId` is `null`, so the planning generation uses the public `/data` read (our own route) and sets up no `yahoo-current-data` broker. This is safe because today is outside the narrowed range: `loadYahooPlanningConfirmations` returns early for a range that excludes today, so the private read has nothing to confirm.
- **Validity.** The choice holds only for the same `accountKey`, and only when the day is after both today and the range start, and on or before the range end. "Back to today" clears it.
- **Real range changes keep today's behaviour.** This covers "Current week", the From/Through dates and matchup week moves: they change the context key, which refreshes the provider.
- **Views.**
  - All views show the range's days, greyed left of the slider.
  - Skipped days (today up to the slider) can't be focused: By player's day buttons and the Itinerary date strip get only plannable dates.
  - Elapsed days still show their recorded lineup.
  - The focused day defaults to the plan start.
- **Persistence.** The choice is view state and is not saved; a reload plans from today again.

**Files (sha256):**
```
c44b21e623aae2b668e4cf118f3b2f6651705232d0f33158218a7475964b1365  web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx
8cb149865e60959c96a7f1fafe417c16c3754ea7bf8a1f8cc03fcb7c6752719b  web/components/RosterScheduleOptimizer/PlanFromSlider.tsx  (comment only)
3995c102815d86cb07b98bc411948c655da0ceda2a4ddb479e975fbd78b69e41  web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx
```

**Tests:**
- **Yahoo provider page test** (Wednesday; slider Wed→Thu→Sat):
  - No `/provider`, `yahoo-current-data` or `/workspace` fetch happens.
  - The provider read count stays at 1.
  - No `yahooPlanningReadBroker` is created. A pass-through `vi.mock` counts broker creations.
  - The `/data` reads carry `startDate` 10-15, then 10-17.
  - The planner gets `context.startDate` 2026-10-17.
  - Changing Through then refreshes the provider (reads = 2).
- **Manual page test:**
  - From/Through stay unchanged while planning runs from Friday.
  - Columns are greyed in By position.
  - The skipped Wednesday is disabled in By player, and Friday is focused.
  - The slider shows in all three views.
  - "Back to today" restores the full range.

**Checks** (from `web/`, `GIT_DIR` unset):

| Check | Result |
|---|---|
| `TZ=UTC npx vitest run components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer lib/rosterScheduleOptimizer hooks` | passed: 75 files, 1299 tests |
| The same with `TZ=America/New_York` | passed: 75 files, 1299 tests |
| `npx tsc --noEmit` (8 GB heap), under the heavy lock (taken with noclobber, then released) | passed (rc 0) |
| eslint on the 3 touched files | 0 errors; the same 6 pre-existing warnings |
| CSS pure check | not needed: no `.module.scss` changed in this follow-up |

**Limits:**
- Each settled slider move is one new planning generation. That means one `/data` read on our own route, shared with candidate metrics; there are no Yahoo reads.
- Still not browser-verified.
