# XG Baseline Validation - 2026-03-30

## Scope

This artifact records the formal validation package run required by task `1.1` in `tasks/tasks-xg-baseline-options.md`.

The goal of this run was to test whether the current NHL API data foundation is ready for baseline-model training evaluation.

## Training Sample

Training-sample game IDs used for the run:

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

Legacy-overlap games used for sampled parity comparison:

- `2025021018`
- `2025021003`
- `2025021119`
- `2025021140`
- `2025020982`

## Validation Package

Validation sources and helpers used:

- `web/lib/supabase/Upserts/nhlXgValidation.ts`
- `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts`
- `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts`
- `web/lib/supabase/Upserts/nhlNstParityMetrics.ts`
- `tasks/artifacts/nhl-manual-audit-2026-03-30.md`

Validation dimensions executed:

- Raw-vs-normalized event checks
- Sampled exact-subset parity checks against legacy NST tables
- Manual-audit reference review

## Raw Vs Normalized Results

Summary:

- `totalGames = 10`
- `passedGames = 0`
- `failedGames = 10`

Important detail:

- All `10` sampled games matched on total event counts.
- All `10` sampled games matched on event-type distributions.
- No duplicate normalized `event_id` values were found in the sampled set.
- No duplicate normalized `sort_order` values were found in the sampled set.

Blocking finding:

- `matchingEventIdCount = 0` for every sampled game.
- Raw `play-by-play` `eventId` values do not align with `nhl_api_pbp_events.event_id` in the current stored normalized rows.
- Because the raw-vs-normalized validator treats upstream event-id alignment as part of correctness, all `10` games failed the formal validation package even though counts and type distributions matched.

Interpretation:

- The normalized ingest is preserving event order and event taxonomy correctly for the sampled set.
- The stored `event_id` contract is still wrong relative to upstream raw payload identity, which is a release-gate issue for deterministic lineage, replay confidence, and event-level auditability.

## Sampled Parity Results

Sample families compared:

- `nst_gamelog_as_counts`: `144` rows
- `nst_gamelog_as_counts_oi`: `144` rows
- `nst_gamelog_goalie_all_counts`: `4` rows

Observed result:

- The sampled exact-subset parity comparison failed broadly.
- No sampled warnings were emitted; the sampled failures were hard parity errors.

Representative drift examples:

1. `nst_gamelog_as_counts:skater:8470621:2025020982:2026-03-05`
   - `faceoffs_lost`: legacy `1`, new `0`
   - `hits_taken`: legacy `1`, new `0`
   - `icf`: legacy `4`, new `0`
   - `iff`: legacy `4`, new `0`
   - `shots`: legacy `4`, new `0`
   - `toi`: legacy `936`, new `951`
2. `nst_gamelog_as_counts:skater:8471685:2025020982:2026-03-05`
   - `faceoffs_lost`: legacy `20`, new `0`
   - `faceoffs_won`: legacy `11`, new `0`
   - `first_assists`: legacy `1`, new `0`
   - `icf`: legacy `3`, new `0`
   - `shots_blocked`: legacy `3`, new `0`
   - `total_points`: legacy `1`, new `0`
3. `nst_gamelog_as_counts:skater:8475314:2025020982:2026-03-05`
   - `hits`: legacy `2`, new `0`
   - `hits_taken`: legacy `2`, new `0`
   - `icf`: legacy `11`, new `0`
   - `iff`: legacy `9`, new `0`
   - `shots`: legacy `6`, new `0`
   - `toi`: legacy `1102`, new `1199`

Interpretation:

- Current parity logic is not yet reproducing the sampled exact NST-era count surface closely enough for release.
- The failures are not limited to approximation-only families.
- Exact-count metrics and TOI-linked outputs still have material drift.

## Manual Audit Reference

Manual-audit reference used in this validation package:

- `tasks/artifacts/nhl-manual-audit-2026-03-30.md`

Manual-audit status:

- The existing human audit passed for sampled event parsing, strength mapping, and stint-based on-ice attribution.
- That is useful evidence, but it does not override the failing formal raw-id and parity checks above.

## Current Verdict For This Validation Run

The formal validation package was executed successfully.

The release gate is not satisfied based on this run because:

1. Stored normalized `event_id` values are not aligned with upstream raw `eventId` values for the sampled games.
2. Sampled exact-subset parity outputs still drift materially from legacy NST baselines.

This artifact should be treated as release-gate evidence for the next review step in task `1.2`.

## Execution Notes

Validation was run live on March 30, 2026 against the current Supabase-backed NHL API tables and current in-repo TypeScript modules via an ad hoc execution harness.
