# SS lane B: skater boards (3.0, 7.0)

**Scope:** BSH Board, Category Blueprint, Nightly Floor and Cardio Masters as post modules. Write set per LANES.md.

**Where:** `octoberBranch`, canonical checkout. Files: `web/lib/socialShare/modules/{bshBoard,categoryBlueprint,nightlyFloor}*`, `lanes/skaterBoards.ts`, the three cards plus `BshBoardCard.module.scss`, `web/e2e/social-share-skater-boards.spec.ts`. Receipt: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/b-skater-boards.md`.

**State:** built; 47 lane tests, eslint, pure check and `--list` pass. Real reads logged in the receipt.

**Decisions:**
- Min GP means season GP in all three posts, so a filter above the window length does not silently empty the board.
- Risers and fallers need a full recent window and a baseline at least that long. L10 vs previous 10 needs 20 GP, so that default is empty early in the season.
- Shared window, cohort and coverage helpers live in `bshBoard.ts` and `bshBoard.sources.ts` because the write set allows no extra file.
- Blueprint has no overall rank: each category ranks alone and "Top N" is a filter on those ranks.
- Layout pass for TJ: 20-row limit, rows stretch to fill the body, one legend line per card, other notes moved to evidence. Fit is unmeasured until the lead renders.
- Blueprint default moved from Top 100 (0 skaters of 633 on real data) to Top 250 (16), keeping the four categories. Reasoning and read R6 are in the receipt.

- BSH leaders: stacked B, S, H chart per game plus a HeatTile; 12 rows. Gaps cannot reach a ranked leader under the current unranking rule. Fit unmeasured until the lead renders.

- BSH risers and fallers: one `movers` view, side by side, 7 rows a side, charts spanning both windows with a recent-window mark. Fit unmeasured until the lead renders.

- Category Blueprint: cells coloured by rank share of the cohort on one scale; missing has no fill. Default Top 250 means no red cells. Fit unmeasured until the lead renders.

- Nightly Floor and Cardio Masters: per-appearance strip from the same outcomes as the count, % tile, 14 rows; red on unwanted views. Fit unmeasured until the lead renders.

- BSH: stacked per-game charts replaced by one segmented B, S, H bar on leaders and movers (TJ's reference). Fit by CSS only until the lead renders.

- Nightly Floor rework: metric label, average column, MISSING column removed. `floorHeadline` is wired through the lead's `headline` seam in `contract.ts` and `PostStudio.tsx`.

- Multi Cat Monsters replaces Category Blueprint (id unchanged); TJ overrode the no-combined-score rule for this card. The Points-First headline probably needs a smaller header size in frozen `PostStudio.tsx`.

**Gotchas:**
- PostStudio shows old data under new labels until Refresh and lets it export. The lead fixed the export side at `839aa7af4`. These posts keep `data.applied` so the card also asks for a refresh.
- `yahoo_nhl_player_map_read` joins on `player_key`, not `player_id`; many NHL ids hold several Yahoo ids.
- `tsc` runs out of memory on the default heap; use `NODE_OPTIONS=--max-old-space-size=8192`.

**Next:** the lead runs the E2E spec and the full-season loaders at the render step.

**Blockers:** none.

- Last Nights Standouts: new module, sources, test, card, panel, scss, E2E spec, plus the barrel. Reads are R8 and R9 in the receipt. Browser run and full-slate loader are the lead's. Rolling had 72 of 360 line slots for 10-31 at read time, so Line chips depend on that writer finishing.

- Standouts defects: lines now come from `lineCombinations`, rolling only as a dated fallback. NST holes on 10-05 and 10-06 explain the dashes. Spec run on port 3110 with the isolated build: 8 passed.

- Standouts sidebar: the studio's button style set a height and nowrap, which caused the overlap and phone width; a two-class selector overrides them. New assertions fail on the old CSS. PP: the source's unit is a rank of a wrong time on some teams, so a contradicted chip prints "PP —". The writer is the real fix and is outside this lane.

- Standouts review: average % default in the sidebar, last/STD/change on every chip, goalie chips ranked by GSAx (top 8). The loader now reads goalie season rows and NST for the goalies on the slate. Real render is the lead's.

- Standouts: per-stat STD floors in the average, stated in the rule and printed in the sidebar. Goalie TOI chip removed. Real render is the lead's.

- Standouts audit: unknown GSAx is unranked, coverage is per team game, and the spec downloads real PNGs. Real render and the freeze are the lead's.

- Period control (2026-11-01): BSH Leaders, Multi Cat Monsters, Nightly Floor and Cardio Masters take matchup and custom dates; `period=rolling` is the default so old `window` URLs keep their meaning. Min GP in a period: `minGpRange`, or blank is half the most played, rounded up, at most 5. Movers refuse a period. Standouts: own `slate` field, neighbours read from wgo, no-game date is `missing` with data so the chooser stays. Gotcha: the panel's `change` cannot load, so slate buttons wait for Refresh post; a one-line `apply` on the panel props would fix it, PostStudio and contract are frozen. Rostered % on an older slate is today's, and the card says so. Real render is the lead's.

- Review F3: slate existence and neighbours now come from scheduled games with team results, not skater rows. Off day, scheduled with no result and missing feed read differently. R20: same 33 dates on real data. Local only; TJ batches it with the next release.
