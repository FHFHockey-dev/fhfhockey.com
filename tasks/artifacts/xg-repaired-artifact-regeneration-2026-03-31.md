# xG Repaired Artifact Regeneration

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `1.3`

## Scope

Regenerated the three baseline family artifacts on the repaired feature contract:

- `logistic_unregularized`
- `logistic_l2`
- `xgboost_js`

using the validated 10-game sample:

- `2025021018`
- `2025021103`
- `2025021003`
- `2025021119`
- `2025021171`
- `2025021140`
- `2025020982`
- `2025021172`
- `2025021170`
- `2025021169`

## Important Note About Artifact Tags

The artifact tags remained:

- `logistic_unregularized-s20252026-p1-st1-f1-cfg4c96cf20`
- `logistic_l2-s20252026-p1-st1-f1-cfg4c96cf20`
- `xgboost_js-s20252026-p1-st1-f1-cfg4c96cf20`

because the current config signature only reflects explicit CLI config, not the repaired default categorical feature set.

So the important verification is the saved content, not the unchanged tag name.

## Verified Clean Artifact Content

Direct verification checks confirmed:

- no regenerated artifact contains `shotEventType`
- no regenerated encoded feature key contains `shotEventType:*`
- the saved categorical feature set is now:
  - `shotType`
  - `strengthState`
  - `strengthExact`
  - `zoneCode`
  - `previousEventTypeDescKey`
  - `missReasonBucket`

## Regenerated Artifact Paths

### `logistic_unregularized`

- `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_unregularized-s20252026-p1-st1-f1-cfg4c96cf20/dataset-artifact.json`
- `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_unregularized-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`

### `logistic_l2`

- `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_l2-s20252026-p1-st1-f1-cfg4c96cf20/dataset-artifact.json`
- `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_l2-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`

### `xgboost_js`

- `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/xgboost_js-s20252026-p1-st1-f1-cfg4c96cf20/dataset-artifact.json`
- `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/xgboost_js-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`

## Immediate Consequence

The next benchmark and calibration rerun can now proceed on repaired saved artifacts rather than on the previously leaked feature contract.
