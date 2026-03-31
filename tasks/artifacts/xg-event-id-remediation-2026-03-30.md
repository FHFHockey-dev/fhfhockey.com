# Event ID Remediation - 2026-03-30

## Scope

This artifact records the completed remediation for task `1.0` in `tasks/tasks-xg-release-remediation.md`.

Problem addressed:

- the sampled release validation previously reported zero matching event ids between raw `play-by-play` payloads and stored normalized `nhl_api_pbp_events` rows

## Root Cause Summary

Root cause reference:

- `tasks/artifacts/xg-event-id-root-cause-2026-03-30.md`

Summary:

- the parser and ingest path were already preserving upstream `play.eventId`
- the failure came from the release-validation path
- `nhl_api_pbp_events.event_id` is stored as `BIGINT`
- the ad hoc validation harness used raw `pg` queries, which return `BIGINT` values as strings by default
- `web/lib/supabase/Upserts/nhlXgValidation.ts` filtered ids with `Number.isInteger(...)`
- string-valued normalized ids were discarded, causing a false zero-match result

## Fix Applied

Updated file:

- `web/lib/supabase/Upserts/nhlXgValidation.ts`

What changed:

- added integer-like string coercion for validation comparisons
- normalized ids and sort-order values are now accepted when they arrive as:
  - numbers
  - integer-like strings from raw `pg` `BIGINT` results

Fields now normalized before comparison:

- raw payload `id`
- raw payload `eventId`
- normalized `event_id`
- normalized `sort_order`
- duplicate-detection inputs derived from those fields

## Affected Versions

- `parser_version = 1`
- `strength_version = 1`
- `feature_version = 1`
- `parity_version = 1`

Important version note:

- this remediation did not require a parser-version or ingest-version bump
- it fixes the validation layer, not the stored normalized event contract

## Regression Coverage

Updated file:

- `web/lib/supabase/Upserts/nhlXgValidation.test.ts`

Added coverage for:

- normalized rows shaped like raw `pg` `BIGINT` results, where `event_id`, `sort_order`, and `game_id` arrive as strings

Focused test result:

- `1` file passed
- `6` tests passed

## Representative Re-Ingest And Validation Evidence

Representative sample re-ingested:

- `2025021018`
- `2025021103`
- `2025021003`
- `2025021140`

Re-ingest result:

- all `4` games completed successfully
- each game stored `4` raw endpoints
- normalized row counts matched expected counts

Focused raw-vs-normalized validation result after the fix:

| gameId | raw events | normalized events | matching event ids | result |
| ---: | ---: | ---: | ---: | --- |
| `2025021018` | `389` | `389` | `389` | pass |
| `2025021103` | `318` | `318` | `318` | pass |
| `2025021003` | `366` | `366` | `366` | pass |
| `2025021140` | `336` | `336` | `336` | pass |

Across the full representative sample:

- `0` missing normalized event ids
- `0` extra normalized event ids
- `0` duplicate normalized event ids
- `0` duplicate normalized sort orders
- `0` type-count mismatches

## Conclusion

Task `1.0` remediation status:

- raw event identity alignment is no longer blocked by the false zero-match validation failure
- representative raw-vs-normalized validation now passes event-id reconciliation as intended

Remaining release work continues in later remediation tasks, especially the exact-subset parity drift investigation in task `2.0`.
