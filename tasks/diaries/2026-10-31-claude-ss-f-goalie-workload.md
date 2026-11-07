# SS lane F: goalie workload (10.0, 12.0)

- **Scope:** `busyQuiet`, `goalieRescue`, `ratioImpact` five-file sets, lane barrel, E2E spec, receipt. Nothing frozen.
- **Where:** `octoberBranch`, canonical checkout, explicit pathspecs. Receipt: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/f-goalie-workload.md`.
- **State:** built and tested on fixtures, bounded reads logged. Lane tests, eslint, pure check and tsc on lane files pass. E2E `--list` only.
- **Next:** none in this lane. The lead reports the real render and all 4 E2E specs pass (spec changed at `108c68938`); footnote singular fixed after that render.
- **Decisions:** in the receipt. Window field on both goalie posts; Rescue ranks one selected category, with no combined score; pickup cards' Yahoo status rule applies.
- **Blockers:** none.
- **Gotchas:** NST goalie `toi` is minutes and arrives as a string. NST goalie `team` uses `N.J`, `L.A`, so bind team from WGO and join by goalie and date only. NST `shots_against` differs from WGO on 36 of 414 joined rows, so NST supplies only the danger-zone splits.
- **Busy and Quiet visuals:** side-by-side boards, neutral SA tile, per-game SA sparkline, tie cap 12. Rescue and Ratio Impact notes from TJ may follow. Fit needs the lead's render.
- **Rescue visuals:** grouped heads, per-column colour with GA and GAA flipped, selected-column highlight, dots for games left, tie cap 28. Fit needs the lead's render.
- **Ratio Impact visuals:** before and after tiles, sensitivity charts aligned to printed columns, entered mark, gaps for zero denominators. Fit needs the lead's render.

## 2026-11-01: Busy and Quiet third line

Replaced the HD SHOTS / TEAM SCA / HDCA text line with three tiles. Thin HD coverage prints a dash; the counts moved to `evidence.sample`. Row minimum is 65px and the tie cap stays 12. Checks: Vitest, pure CSS, eslint, tsc filter, spec `--list`. Next: the lead's render runs the spec's tile overflow check.

## 2026-11-01: Rescue column balance

Name column is `minmax(0, max-content)`, RK is `max-content`, and the ten `auto` columns take the stretch. Checks: Vitest, pure CSS, eslint, tsc filter, spec `--list`. Next: the lead's render runs the spec's name, overflow and alignment checks.

## 2026-11-01: Ratio Impact plain rewrite

Added headline, sentence, one what-if chart and the no-goalie state; removed tables and stacked charts. Blocker for the named headline: the frozen `contract.ts` and `PostStudio.tsx` must pass data to `headline`; the lead owns those. Checks: Vitest, pure CSS, eslint, tsc filter, spec `--list`. Next: lead's frozen change and render.

## 2026-11-01: Audit F6 and F7 on Rescue

Ownership freshness is per goalie; stale reads as unknown. GMS LEFT comes from the NHL feed because `games` has no state column. A test caught `null ?? 0` resetting a team's unknown count. Next: the lead's render exercises the loader's feed read, which this lane did not run.

## 2026-11-01: tsc correction

The lead found TS2322 on `date` in `657b6e699`. My `npx tsc --noEmit | grep` hid whatever happened and the exit status was never read. Gotcha: run `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit --incremental false` and read the exit code. Added the no-date rule.

## 2026-11-01: Period control

Added Matchup week and Custom to Busy and Quiet and Rescue; rolling stays the default and `window` stays a field for old links. Past dates hide GMS LEFT. Spec run: PLAYWRIGHT_PORT=3147 PLAYWRIGHT_ISOLATED_NEXT=1, invalid Supabase URL, fictional keys. Gotcha: a dense fixture found a clip the small fixture hid. Other lanes' uncommitted edits can add tsc noise, so re-run before reporting. Next: real-data render by the lead.

## 2026-11-01: Min starts by period

Lead's real Week 4 render showed 1 goalie. Added `minStartsWeek` and `minStartsRange`, default 2; rolling keeps 3. Real Week 4: Rescue 11 rows, Busy and Quiet 11 and 12. Rows fill from 4 up. A temporary loader test ran the real read and was deleted, uncommitted. Next: the lead's real render.

## 2026-11-03: Late feed rule

Applied `completeThrough` to Busy and Quiet and Rescue through a shared `cutLateNights`; Ratio Impact has no team-games reason. Six old tests had their gap on the newest night, so they now use an older gap. Gotcha: another session's Playwright run shares `.next-playwright` and killed my server on 3147; wait for it to finish. The spec's Refresh lines belong to ss-contract.

- Chef outcome (2026-11-07): this lane's work shipped in #402 (f17bea20d), #403 (295b384da) and #404 (354336347). Lane closed; diary can be retired.
