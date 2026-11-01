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

**Gotchas:**
- PostStudio shows old data under new labels until Refresh and lets it export. The lead fixed the export side at `839aa7af4`. These posts keep `data.applied` so the card also asks for a refresh.
- `yahoo_nhl_player_map_read` joins on `player_key`, not `player_id`; many NHL ids hold several Yahoo ids.
- `tsc` runs out of memory on the default heap; use `NODE_OPTIONS=--max-old-space-size=8192`.

**Next:** the lead runs the E2E spec and the full-season loaders at the render step.

**Blockers:** none.
