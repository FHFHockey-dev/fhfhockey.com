# XG Release Gate Verdict - 2026-03-30

## Verdict

Release gate verdict for baseline-model training use:

- `release gate not satisfied`

Date:

- March 30, 2026

## Basis

This verdict is based on the current release-review set:

- `tasks/artifacts/xg-baseline-validation-2026-03-30.md`
- `tasks/artifacts/xg-release-blockers-2026-03-30.md`
- `tasks/artifacts/nhl-manual-audit-2026-03-30.md`
- `tasks/validation-checklist.md`
- `tasks/final-implementation-summary.md`

## Rationale

The gate is not satisfied because the current training-use blocker set is still open:

1. raw event identity is not aligned
   - sampled normalized `nhl_api_pbp_events.event_id` values do not reconcile to upstream raw `play-by-play` `eventId` values
   - the formal raw-vs-normalized validation failed for all sampled games on identity reconciliation
2. exact-subset NST parity is not passing
   - sampled parity comparison still shows hard drift on exact-count families, not only approximation families
   - representative failures include shots, `icf`, `iff`, faceoffs, hits, assists/points, and TOI
3. the release validation record is not yet complete enough
   - the final release artifact still needs the full validation metadata contract required by `tasks/validation-checklist.md`

## Approved Exceptions

Approved exceptions for training use:

- none

Approximation areas remain documented for later acceptance review, but they are not approved exceptions for this release gate because current blockers exist in identity and exact-parity surfaces.

## Allowed And Blocked Actions

Allowed:

- continue remediation work on parser identity, parity logic, TOI logic, and validation packaging
- continue documentation and validation-infrastructure improvements
- continue sampled non-authoritative investigation work

Blocked until the gate is satisfied:

- baseline-model training
- training-dataset publication as a release-approved artifact
- benchmark comparison between candidate model families
- any claim that the current shot-feature foundation is approved for formal xG fitting use

## Next Required Step

The next required step is task `1.4`:

- stop baseline-model work
- create remediation tasks that address the open blockers before any model-family work begins
