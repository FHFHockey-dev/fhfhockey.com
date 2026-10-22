# 2026-10-22 claude: fantasy-point projection valuation audit

## Scope
AUDIT ONLY. Trace FORGE per-stat projections -> FP in RSO / Start Chart / bridge on production (origin/master 248df9923, R20); check valuation errors; decompose measured FP bias by stat and tier. No code edits, no git state changes, no production calls.

## Where
- Report: tasks/artifacts/fantasy-point-audit-2026-10-22/REPORT.md
- Scratch: /private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/36e743be-fccb-484b-8982-5ef9e7a9ba43/scratchpad/fp-audit/ (master/ copies, scripts/extract.py, scripts/analyze*.py, rows.json, analysis-out*.txt)
- Inputs (read-only): prior audit scratch 0ab9b1ac.../recon/out/{a,b,a0,b0} + cohort/s3_actuals.json, s9_hits_blocks.json

## State
- Code trace done for: fantasyPointsConfig (weights = TJ league), startChartFantasyScoring, starterBoardScoring, start-chart GET, modeledHeadTotals, bridge skaterStats/goalieLine/emit, goalie stage + goalieModel, RSO playValue/playerAssignedPoints/projectedValue, SlotWeekGrid pointsFor, Yahoo stat-id + modifier parse.
- No arithmetic FP bug found so far: weights right, participation applied once (goalies p x per-start line; skaters conditional, implicit p=1).
- Backtest reproduced (2,074 rows): a bias -0.442, top decile 1.234; b -0.158, 0.975.
- Big input findings: 48% of rows have NULL ev per-60 rates (sog/hits/blocks last5) -> constant fallbacks 6/1/0.5 per 60; master conversion ignores position (F sh% 10.8 proj vs 13.8 act; D 10.4 vs 5.4).

- More: PP assists on per-two-goals scale (act/pred 1.83, -0.098 FP/pg); non-PP A -0.125; HIT/BLK null-rate fallbacks -0.156 FP/pg; role-stability multiplier is renormalized by team reconciliation (redistribution, not level); goalie win probs sum 0.974/game (0.73-1.15).
- Bootstrap (game-clustered, 2000 reps): master FP bias [-0.55,-0.34]; sum ratio [1.22,1.35]; top decile [1.07,1.40].
- Ledger: FP bias pools non-dressed (act 0) rows; decile10 ranks by exp goals.

## Next
- Write REPORT.md + appendix SQL (5-6 queries), then hand back.

## Blockers / approvals
- None. Production data only via appendix SQL for TJ.

## Gotchas
- STARTER_BOARD_SERVING_ENABLED=false in prod (TJ 10-18), so Start Chart GET serves raw run, goalie FP null.
