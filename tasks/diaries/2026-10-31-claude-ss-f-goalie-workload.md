# SS lane F: goalie workload (10.0, 12.0)

- **Scope:** `busyQuiet`, `goalieRescue`, `ratioImpact` five-file sets, lane barrel, E2E spec, receipt. Nothing frozen.
- **Where:** `octoberBranch`, canonical checkout, explicit pathspecs. Receipt: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/f-goalie-workload.md`.
- **State:** built and tested on fixtures, bounded reads logged. Lane tests, eslint, pure check and tsc on lane files pass. E2E `--list` only.
- **Next:** lead runs the loaders and the E2E spec at 13.0.
- **Decisions:** in the receipt. Window field on both goalie posts; Rescue ranks one selected category, with no combined score; pickup cards' Yahoo status rule applies.
- **Blockers:** none.
- **Gotchas:** NST goalie `toi` is minutes and arrives as a string. NST goalie `team` uses `N.J`, `L.A`, so bind team from WGO and join by goalie and date only. NST `shots_against` differs from WGO on 36 of 414 joined rows, so NST supplies only the danger-zone splits.
