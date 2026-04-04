# Event ID Root Cause - 2026-03-30

## Scope

This artifact records the investigation result for remediation task `1.1` in `tasks/tasks-xg-release-remediation.md`.

Question investigated:

- why did the sampled release validation report that stored `nhl_api_pbp_events.event_id` did not match upstream raw `play-by-play` `eventId` values?

## Files Reviewed

- `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts`
- `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`
- `web/lib/supabase/Upserts/nhlXgValidation.ts`
- `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql`
- `/tmp/run-baseline-validation.ts`

## Findings

### 1. The Parser Preserves Upstream Event Identity

In `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts`:

- ordered events are built from `play.eventId`
- parsed rows are emitted with:
  - `event_id: eventId`
  - `sort_order: sortOrder`

This parser does not remap `event_id` to `sortOrder`.

### 2. The Raw Normalizer Also Preserves Upstream Event Identity

In `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`:

- normalized event rows are built with:
  - `event_id: play.eventId`
  - `sort_order: play.sortOrder ?? null`
- upserts target `nhl_api_pbp_events` on conflict key `game_id,event_id`

This ingest path also does not remap `event_id` to `sortOrder`.

### 3. The Database Column Is `BIGINT`

In `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql`:

- `nhl_api_pbp_events.event_id` is defined as `BIGINT NOT NULL`
- `sort_order` is defined separately as `INTEGER NULL`

That schema matches the intended contract:

- upstream event identity in `event_id`
- deterministic in-game ordering in `sort_order`

### 4. The Failing Release Validation Came From The Ad Hoc Runner, Not From The Parser

In `/tmp/run-baseline-validation.ts`:

- normalized rows were loaded through raw `pg` queries:
  - `select * from public.nhl_api_pbp_events ...`
- those rows were then passed directly into:
  - `validateNormalizedEventBatchAgainstRawPayloads(...)`

In `web/lib/supabase/Upserts/nhlXgValidation.ts`:

- raw event ids are kept only if `Number.isInteger(eventId)`
- normalized event ids are kept only if `Number.isInteger(event.event_id)`

Because the ad hoc runner used `pg` directly against a `BIGINT` column:

- `event_id` is subject to the normal Node `pg` int8 behavior, which returns `BIGINT` values as strings unless a custom parser is installed
- string-valued `event_id` entries fail the validator’s `Number.isInteger(...)` filter
- that collapses the normalized event-id set to empty for the ad hoc run
- the resulting symptom is exactly what was observed:
  - matching counts by total events and type distributions
  - `matchingEventIdCount = 0`
  - all raw ids reported as missing from normalized rows

## Root Cause

The sampled release-validation `event_id` failure was caused by a type-coercion bug in the ad hoc validation harness, not by evidence that the parser or ingest path rewrote event identity incorrectly.

More precisely:

- `event_id` is stored in a `BIGINT` column
- the ad hoc validator loaded normalized rows via raw `pg`
- `pg` returns `BIGINT` values as strings by default
- the validation helper filtered normalized ids with `Number.isInteger(...)`
- all normalized ids were therefore discarded from the identity comparison

## Implication For Remediation

The next fix should target validation input normalization, not an assumed parser remap.

Most likely correction options:

1. coerce `event_id` and `sort_order` to numbers before passing raw `pg` rows into `validateNormalizedEventBatchAgainstRawPayloads(...)`
2. harden `nhlXgValidation.ts` to normalize integer-like strings before comparison
3. prefer the typed parser output or Supabase client row shape for this validation path instead of raw uncoerced `pg` rows

## Conclusion

Current investigation result:

- no evidence found that `nhlPlayByPlayParser.ts` or `nhlRawGamecenter.mjs` rewrites `event_id` away from upstream `play.eventId`
- strong evidence found that the sampled release-validation failure was produced by `BIGINT` string handling in the ad hoc validation runner
