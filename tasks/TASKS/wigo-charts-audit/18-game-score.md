# 18 — Brush/zoom Game Score

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; depends on 00 game coverage.

## Scope and evidence

get_skater_game_scores_for_season RPC calculates a linear weighted score from wgo_skater_stats. Baseline SQL includes goals .75, primary assists .7, secondary assists .55, shots .075, blocks .05, penalties drawn/taken ±.15, faceoffs won/lost ±.01, shot attempts for/against ±.05 and on-ice goals for/against ±.15. Null arithmetic produces null and SQL filters those games out. UI adds 5/10-game means and configures zoom without the local wrapper registering the zoom plugin.

- [index.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/GameScoreLineChart/index.tsx)
- [RollingAverageChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/GameScoreLineChart/RollingAverageChart.tsx)
- [formattingUtils.ts](/Users/tim/Code/fhfhockey.com/web/utils/formattingUtils.ts)
- [20260716112908_production_schema_baseline.sql](/Users/tim/Code/fhfhockey.com/supabase/migrations/20260716112908_production_schema_baseline.sql)

## Distinct implementation plan

1. Confirm the deployed SQL and intended score model/version; document included strengths and the definitions of every raw field. Reconstruct representative games, including negatives. Do not silently substitute another “Game Score” formula.

2. Compare returned game identities/count to canonical season logs. For incomplete inputs, decide field-by-field whether zero is valid or the score is unavailable; blanket COALESCE can fabricate scores. Preserve missing-game visibility and explicit rolling-window semantics.

3. Check endpoint latency and relevant player/season index/query plan before considering persisted scores. Reuse stable query keys and memoized chart datasets.

4. Ensure zoom plugin registration works when this chart loads independently; do not depend on another chart registering it first. Provide visible reset and preserve negative values and rolling lines.

## Verification and acceptance

Validate every weighted term with hand-calculated fixtures and compare expected versus returned games. Browser-check standalone chart initialization, negative scores, 5/10 windows and zoom reset. Acceptance: documented model, complete or explicitly incomplete game coverage, no silent shortening of “last 5 games”.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
