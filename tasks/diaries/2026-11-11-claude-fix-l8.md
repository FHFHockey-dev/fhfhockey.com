# Fix lane L8: lines, PP combinations, TOI API, shift charts (2026-11-11)

## Scope
Brief: `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L8.md`. Findings W2-P0-12 (line-card goalie), W2-P0-13 (`/api/toi` PP share), W2-6 D3-D8, BC M-FRG-058 display. Decisions 40, 59, 70, 71, 72, 86, 107, 108.

## Where
- Branch octoberBranch. Commits: 1e34edbdd (P0s + claim), 7deb81304 (PP clock contract + audit), 4126fed60 (D3 label, D5, D8).
- Claim appended (uncommitted) to `tasks/artifacts/cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md` as `CLAUDE-FIX-L8-CLAIM-20261111`; commit it with the first L8 commit (explicit pathspec).
- Codex mailbox last 60 lines checked: no Codex claim on L8 paths. All L8 owned files clean at start.

## State
- Read: _COMMON, L8 brief, RULES-DIGEST, decisions 40/59/70/71/72/86/107/108, WAVE2 §W2-6, L1 helper contract and L1 placeholder-null tickets.
- Resumed after usage limit (Chef: L5 overlap repair committed 2870d41cb; L6 and L4b wait on the PP clock contract).
- W2-P0-12 done: `LineCombinations/utilities.ts` now reads each goalie's own season appearances (one query, no line-game filter) and credited W/L/OTL from `wgo_goalie_stats` (decision 72); pooled SV% = Σsaves/ΣSA, GAA = ΣGA×3600/ΣTOI s; unknown TOI → GAA null, missing credited row → Record null; team `gameOutcomes` (unknown = WIN) no longer read. `GoalieCard.tsx`: no `|| 0`, "—" for unknown, "LAST 10 GP", "No appearances yet". Failing-first: shutout + 10-min relief gave .667 (old) vs .939/1.71 (new); old record "2-0-0" style from unknown=WIN.
- W2-P0-13 done: `/api/toi` serves `powerPlayToi`/`powerPlayToiShare` = null with `powerPlayStatus {available:false, reason}`; FORGE seconds reported as `modelPowerPlay` beside the official team clock; `exceedsTeamClock` flags, never caps; missing = null. TimeOnIceChart shows the reason instead of a PP line. PowerPlayCombos: FORGE failure or partial coverage → "—" (old showed 0); TOI cell labelled "Model TOI/GP". Old code failed every new test (swap-to-HEAD check).
- Checks: vitest 9 files 72 tests pass; eslint 0 errors (2 old img warnings); CSS pure check OK (TimeOnIceChart.module.scss, via scratchpad script with loadPaths); `npm run typecheck` exit 2, only in other lanes' draft files (lib/draft-pro/recommendations.ts, lib/draftDashboard/playerValues.ts, pages/fantasy-projections.tsx).

- PP clock contract committed (7deb81304); note in Chef side-session folder `L8-pp-clock-contract.md`. Clock NOT qualified.
- D3 labelled legacy; D5 DRM denominator named; D8 DRM shade + one-unit sort + weights documented (4126fed60). All new tests failed on HEAD versions.
- Deferred/blocked: D3 5v5 switch (team_unit_toi rebuild after L5b + disjoint-slot rule), D4 (decision-108 floor must be fitted from stored data, needs approved reads), D5 es_shifts (unowned `pages/api/v1/db/shift-charts.ts`), D6/D7 dormant (rule 6), D8 M-LINE-028/030 (`lib/sources`, unowned), M-LINE-043 (L5).

## Next step
- Chef: approve qualification reads for the PP clock; route tickets above.
## Earlier next-step notes
- PP clock contract (penalty-box sim → `TeamPpClock {seconds, source}` for L6, unqualified until validation), M-FRG-058 situation-code audit, D3-D8.
Old plan:
1. W2-P0-12: `web/components/LineCombinations/utilities.ts:91-101,241-259,506-559` and `PlayerCard/GoalieCard.tsx` (`|| 0`). Pool SV% = Σsaves/ΣSA, GAA = ΣGA×3600/ΣTOI s; honest window labels; record = goalie's own credited W-L-OTL; unknown outcome stays unknown (L4a migration 130 makes level score NULL). Test: shutout + 10-min relief → .939 / 1.71 (current .667 / 6.00).
2. W2-P0-13: `web/pages/api/toi.ts:88-95,136-154`: no 0 for missing, no cap at 100; withhold/flag share until the decision-71 clock is qualified; null `powerPlayToi` = unknown. PowerPlayCombos (`:439`) must show unavailable when the FORGE query fails.
3. Then D3-D8 and M-FRG-058 (adopt L1 `classifyTeamManpower` in `getPowerPlayBlocks.ts`). Write PP clock contract for L4b/L6.

## Blockers / gotchas
- Decision 107 (5v5 lines) depends on L5's `team_unit_toi` overlap repair; do not edit `web/lib/rankings/**`.
- 5 is not a PP ceiling (4v3 → 4, 6-skater PP → 6).

## 2026-11-12/13 follow-up: decision 137 (disjoint 5v5 units)
- Commit 79dedadf1: new `web/components/LineCombinations/fiveOnFiveUnits.ts` (+ `__test__/fiveOnFiveUnits.test.ts`), wiring in `utilities.ts` (`getLineCombinations(teamId, seasonId, { fiveOnFive })`, `lineSource`), Lines subtitle in `pages/lines/[abbreviation].tsx`, tests in `__test__/utilities.test.ts` and `__tests__/pages/lines/abbreviation-header.test.tsx`.
- Switch `LINES_FIVE_ON_FIVE_ENABLED = false` until the team_unit_toi rebuild (production step, Chef/TJ). Window = each game's own units (current and previous game, so line changes compare 5v5 to 5v5).
- Checks: 10 files, 77 tests pass; the 10 new tests fail on HEAD; eslint exit 0; `npm run typecheck` exit 0.
- Left alone: `ProjectedLineups.tsx` + its untracked test (someone else's uncommitted work), `shift-charts.ts` (Codex).
