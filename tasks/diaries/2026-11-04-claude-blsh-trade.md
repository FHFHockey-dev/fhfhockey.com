# BLSH trade comparison (decision 4), Claude, 2026-11-04

## Scope
Separate, forecast-labelled trade view, dev-only. Owns: web/lib/buyLowSellHigh/trade.ts + trade.test.ts,
web/pages/buy-low-sell-high/trade.tsx, web/components/blshTrade/*. Branch octoberBranch (sole checkout).

## Decisions
- Forecasts: Sko fixture interpretation records (forge-game-expectations-v1 shape) via fixtureRecords(horizon). No live read
  (the /api/v1/forge/forecasts route reads production Supabase; needs TJ approval + an NHL-id join to BLSH evidence).
- BLSH evidence: synthetic DisplayProfile fixtures (display contract type only), keyed to fixture player ids.
- Retrospective fallback: recorded FHFH Standard FP per game from the BLSH FP track; only under FHFH Standard scoring.
- Goalie under skater-only points scoring was a silent zero in compareTrade -> new blocking `unscored_player` issue.

## State
- trade.ts: FHFH_STANDARD_SCORING, forecastQualification, playerScoredValues, unscored_player issue, per-player qualification +
  participation, `experimental` flag. Components: BlshTradeComparison, retrospective, fixtureEvidence, BlshTrade.module.scss.
- Checks: vitest trade + blshTrade + market 40/40 pass; eslint clean on owned files; CSS pure check OK;
  `npm run typecheck` exit 2, all errors in files not owned (currentProcessEvidence.server*.ts untracked lane, retainedBlsh.test.ts).
- Isolated dev server :3112 (PLAYWRIGHT_ISOLATED_NEXT=1), Playwright screenshots desktop 1440 + phone 390, 0px overflow,
  no console errors; PNGs in tasks/artifacts/blsh-trade-2026-11-04/ (gitignored, local only). Server stopped by PID.

## Next
- Live forecasts: /api/v1/forge/forecasts reads production Supabase -> needs TJ pop-up approval with a bounded request, plus an
  adapter from the game-expectations view to the fields compareTrade reads and an NHL-id join to the BLSH display snapshot.

## Gotchas
- `.next-playwright` is shared by every isolated server; check for other isolated servers before starting one.

## 2026-11-03 evening: display mapper v3 (lists lane 42a6752ae)
- Fixture updated to v3: track ids fantasy_points/goals_plus_assists/wigo_game_score with roles, score.positionRank/positionTopN/
  headline/directionWithheld*. fx-d1 (0 games) and fx-d3 (12 games) show "Direction withheld".
- Bug found: retrospective looked up track "FP"; real tracks use "fantasy_points". Now reads score.headline (null, never 0).
- Checks: blshTrade + trade tests 24/24; typecheck exit 2, errors only currentProcessEvidence.server* and retainedBlsh.test.ts.
- Lists lane 956de01e2 added DisplayProfile.opportunity: fixture uses the contract's opportunityNotAttached() (explicit
  unavailable, never zeros). The trade view does not display opportunity. Tests 24/24; typecheck errors only in other lanes' files.
