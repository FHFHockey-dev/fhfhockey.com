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
