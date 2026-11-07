# RSO-BRIDGE receipt 2: C7 R29 findings B1 and B2 (Claude, 2026-10-25)

Starts from `e5975452c`. Same lease (RSO-BRIDGE). Not committed: the orchestrator commits.

## Files (sha256)

| File | At `e5975452c` | Final |
|---|---|---|
| web/lib/rosterScheduleData/forgeDailyBridge.ts | c1d0c2f8f3689e1bf93a514b082c949875effe4d8bf206bfd8a82000bcf3c296 | f1604e34907082401a7bb2f68f106f94b8a467dd3f5df5d10344082e4c374b9b |
| web/lib/rosterScheduleData/forgeDailyBridge.test.ts | cac6bdcc677a0231a2455c8274a5fa3fbce691fc25ad3014aadcb667404de56b | b349bfed1fb64835b632e47e70b741fba78c3fad2ca3284e3497d2260b0cf7bd |

Diff: 2 files, +97 / −17.

## Behaviour

### B1: no renormalising past an unknown teammate
Chosen option: **the known goalies keep their raw shares.** Withholding the whole team's game would throw away real evidence. Raw shares claim only what was read, and the shortfall below 1 stays visibly unassigned.

- A team is **open** when any goalie on its current roster has no start probability yet. That includes roster goalies that aren't identified, and teamless goalies linked to the team (see B2).
- In an open team, every redistribution scales by `min(1, mass / total)`: known chances can be scaled **down** to fit, never **up**. This applies everywhere start chance is redistributed (one shared `rescale`):
  - the plain share split;
  - the remainder after FORGE's exact starter probability;
  - goalie news (ruled out and the likely/projected floors; confirmed still gives the others 0);
  - the back-to-back shift: the starter still drops to 55% of his chance, but what he loses stays unassigned instead of going to known teammates.
- With every goalie known, results are unchanged: they still sum to 1.
- When it happens it's declared in a comment and a limitation: "N team-games have a goalie with no start share; the others keep their own shares, never scaled up, so start chances there sum to less than 1." The line is counted only where the final chances do sum below 1.

### B2: goalies with no current NHL team
- New limitation: "N goalies have no current NHL team, so their start chances are unknown; the team their latest start row or FORGE line names keeps its other goalies' shares unscaled."
- Such a goalie is linked to the team named by his latest current-season `goalie_start_projections` row, or else his latest FORGE goalie line. That team is then open, so he can't inflate a teammate.
- **Remaining gap:** a teamless goalie with no current-season start row and no FORGE line can't be tied to any team. His former teammates can still renormalise to 1. The team-membership source (`planningInputs` rosters) can't name his team either.

## Tests (`forgeDailyBridge.test.ts`, "goalie start shares › never scaled up past a teammate whose share is unknown")

| Case | Baseline (`e5975452c`) |
|---|---|
| Two known shares renormalise (0.4/0.2 → 2/3, 1/3) | pass (pin) |
| One known + one unknown: 0.7 stays 0.7, never 1.0. Three goalies: 0.6/0.3 stay as read; 0.8/0.5 scale down to sum 1 | FAIL (1.0) |
| All unknown → no start chance | pass (pin) |
| FORGE starter 0.8 + known 0.15 + unknown → 0.15 (0.2 when all known) | FAIL (0.2) |
| Ruled-out news: teammate 0.3 stays 0.3 past an unknown (1.0 when all known) | FAIL (1.0) |
| Back-to-back: starter 0.6 → 0.33, teammate stays 0.3 past an unknown (0.67 when all known) | FAIL (0.6333) |
| Teamless goalie linked by his start row: teammate 0.7, not 1.0; limitation counts him | FAIL (1.0) |

Baseline log: `BRIDGE/baseline-failures-2.txt` (5 failed / 60 passed).

## Checks (from `web/`, GIT_DIR unset)
- **Passed:** `npx vitest --run lib/rosterScheduleData lib/rosterScheduleOptimizer/planning.test.ts lib/rosterScheduleOptimizer/gameForecastPoints.test.ts`: 8 files, 359/359. The bridge file alone is 65/65.
- **Passed:** scoped `tsc --noEmit` and whole-project `npx tsc --noEmit`, both exit 0. Both ran with an 8 GB heap under `/private/tmp/fhfh-heavy.lock` (created with noclobber, removed on exit). Log: `BRIDGE/tsc-2.log`.
- **Passed:** `npx eslint` on both changed files, exit 0.
- No production, DB, provider, Vercel or git-mutating actions.
