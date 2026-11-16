# Follow-up lane F3: Lines 5v5 switch (decision 137), 2026-11-13

## Scope
Brief: `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/FOLLOWUP-LANES-2026-11-13.md` § Lane F3. Flip `LINES_FIVE_ON_FIVE_ENABLED` (L8, commit 79dedadf1), update the pinned test, add a switched-reader test (disjoint units, unknown TOI stays unknown), local visual check of /lines. Owned: `web/components/LineCombinations/fiveOnFiveUnits.ts`, `utilities.ts` and their tests. Chef: local_016832c1-5630-43a9-9b8f-59627cb65bda.

## Where
- octoberBranch at 244645342 (start). Owned files clean at start.

## State
- Read: F3 brief + common rules, decisions 107/137, L8 brief/diary, production plan step 4 (team_unit_toi rebuild: latest snapshot 11-08, 292 games).
- Local dev `.env.local` points at production Supabase: the /lines visual check is a production read and needs TJ's pop-up approval (common rules).

- Code done (uncommitted): switch `true`; pinned test now expects on; utilities tests: default reader builds disjoint 5v5 board (overlapping units, unique ids, unknown goalie TOI → GAA null), partial latest snapshot → labelled legacy (not zero, not stale complete snapshot), explicit `{ fiveOnFive: false }` → legacy, no team_unit_toi read.
- Checks: vitest 4 files 31 tests pass (LineCombinations + pages/lines); 3 new tests fail with HEAD source (swap check, source restored); `npm run typecheck` exit 0; eslint exit 0.

- Committed ff873398d (4 owned files, explicit pathspecs, no attribution). Diary left uncommitted (not a release item).
- Visual check (TJ approved 2 pages): isolated :3100. EDM shows the labelled legacy board; TOR shows the 5v5 board, disjoint (18 distinct skaters). Server stopped by PIDs 97073/97094/97095. Note: side-session-notes `F3-lines-5v5-switch.md`.

## Next step
- Report to the Chef: recommend shipping in the release after the team_unit_toi rebuild. Retire this diary once the Chef records the outcome.

## Gotchas
- `pages/lines/index.tsx` (not owned) also calls `getLineCombinations` for all 32 teams: the switch adds one `team_unit_toi` query per team per ISR regeneration, and its promotions/demotions table carries no line-source label.
- Until the rebuild, each team's two latest Lines games are mostly after the 11-08 snapshot, so the reader falls back to the labelled legacy grouping.
