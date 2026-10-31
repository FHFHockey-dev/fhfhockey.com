# SS lane B: skater boards (3.0, 7.0)

**Scope:** BSH Board, Category Blueprint, Nightly Floor and Cardio Masters as post modules. Write set per LANES.md.

**Where:** `octoberBranch`, canonical checkout. Files: `web/lib/socialShare/modules/{bshBoard,categoryBlueprint,nightlyFloor}*`, `lanes/skaterBoards.ts`, the three cards plus `BshBoardCard.module.scss`, `web/e2e/social-share-skater-boards.spec.ts`. Receipt: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/b-skater-boards.md`.

**State:** built; 47 lane tests, eslint, pure check and `--list` pass. Real reads logged in the receipt.

**Decisions:**
- Min GP means season GP in all three posts, so a filter above the window length does not silently empty the board.
- Risers and fallers need a full recent window and a baseline at least that long. L10 vs previous 10 needs 20 GP, so that default is empty early in the season.
- Shared window, cohort and coverage helpers live in `bshBoard.ts` and `bshBoard.sources.ts` because the write set allows no extra file.
- Blueprint has no overall rank: each category ranks alone and "Top N" is a filter on those ranks.

**Gotchas:**
- PostStudio shows old data under new labels until Refresh and lets it export. The lead fixed the export side at `839aa7af4`. These posts keep `data.applied` so the card also asks for a refresh.
- `yahoo_nhl_player_map_read` joins on `player_key`, not `player_id`; many NHL ids hold several Yahoo ids.
- `tsc` runs out of memory on the default heap; use `NODE_OPTIONS=--max-old-space-size=8192`.

**Next:** the lead runs the E2E spec and the full-season loaders at the render step.

**Blockers:** none.
