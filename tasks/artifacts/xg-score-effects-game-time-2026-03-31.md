# XG Score-Effects By Game-Time - 2026-03-31

## Scope

This artifact records baseline follow-up task `4.3` in `/Users/tim/Code/fhfhockey.com/tasks/tasks-xg-baseline-follow-ups.md`.

The goal of this step was to add score-effects-by-game-time interaction features to the shot-feature and training surfaces without yet declaring comparative model value.

## Added Feature Surface

The shot-feature layer now exposes these additional pre-shot score-effects fields:

- `scoreEffectsGameTimeSegment`
- `ownerScoreDiffByGameTimeBucket`
- `isLateGameLeading`
- `isFinalFiveMinutes`
- `isFinalTwoMinutes`

These are derived from the pre-event scoreboard, not post-event score updates.

Current segmentation rules:

- `early-regulation`
- `mid-regulation`
- `late-regulation`
- `final-five-regulation`
- `overtime`
- `shootout`

## Integration Path

The new fields now flow through:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlScoreState.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/xg/baselineDataset.ts`

They are available for explicit training selection and artifact persistence.

## Verification

Focused test coverage passed after fixing the late-game-leading fixture so it reflected pre-event score semantics:

- `web/lib/supabase/Upserts/nhlScoreState.test.ts`
- `web/lib/xg/baselineDataset.test.ts`
- `web/scripts/train-nhl-xg-baseline.test.ts`
- `web/lib/xg/deploymentContext.test.ts`

Training smoke verification also passed with explicit selection of the new fields:

- artifact root:
  - `/tmp/xg-score-effects-time-smoke/logistic_l2-s20252026-p1-st1-f1-cfg3cd008b9`

Saved dataset/model artifacts included:

- `isLateGameLeading`
- `isFinalFiveMinutes`
- `isFinalTwoMinutes`
- `scoreEffectsGameTimeSegment`
- `ownerScoreDiffByGameTimeBucket`

## Boundary

This task only adds and verifies the feature surface.

Comparative benchmarking against the current approved feature set remains task `4.4`.
