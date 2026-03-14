# Backlog Track Grouping

Date: `2026-03-14`
Task: `5.4`

## Goal

Reduce the open pass-2 backlog from many item-level findings into a smaller number of implementation tracks that match ownership boundaries and rollout dependencies.

## Open Item Review

The remaining open or planned items cluster into a few repeat patterns rather than separate projects:

- TOI trust traceability
- PP provenance and PP coverage cautions
- ratio-support completeness and diagnostics visibility
- `gp_semantic_type` and legacy GP interpretation
- ratio / weighted-rate alias freeze and downstream compatibility cleanup
- `trendsDebug.tsx` payload / mismatch / performance follow-ups
- remaining PK source-tail freshness blockers

Treating each of those as independent projects would recreate the same sprawl problem the pass is trying to solve.

## Recommended Implementation Tracks

### Track 1. Validation observability and readiness

Purpose:

- make the validation console and repeatable diagnostics fully trustworthy

Grouped backlog items:

- per-row TOI trust trace
- mixed-source PP-share tracing
- PP coverage cautions when `ppTailLag = 0`
- ratio-support completeness visibility
- promote diagnostics to a first-class validation surface

Why these belong together:

- they all improve trust in validation
- they all touch the same ownership area:
  - diagnostics helpers
  - validation payload
  - `trendsDebug.tsx`
- they all feed the same operator question:
  - “Can I trust this comparison?”

Primary files:

- `rollingPlayerPipelineDiagnostics.ts`
- `rollingPlayerValidationPayload.ts`
- `rolling-player-metrics.ts`
- `trendsDebug.tsx`

### Track 2. Compatibility and semantic cleanup

Purpose:

- make canonical-versus-legacy meaning clearer and safer for downstream readers

Grouped backlog items:

- legacy ratio / weighted-rate alias ambiguity
- `gp_pct_*` semantic ambiguity and `gp_semantic_type` visibility
- trends page migration away from legacy-only suffix selection
- alias-freeze / later cleanup migration plan

Why these belong together:

- they are all about field meaning, not arithmetic
- they all depend on one compatibility policy surface
- they should be sequenced as one compatibility cleanup track, not piecemeal

Primary files:

- `rollingPlayerMetricCompatibility.ts`
- downstream readers
- schema / migration follow-ups

### Track 3. Validation-surface productization

Purpose:

- keep `trendsDebug.tsx` authoritative without letting it become a heavy or duplicated UI surface

Grouped backlog items:

- server-authoritative formula / contract / window metadata
- family-wide mismatch summaries
- validation-console overfetch reduction

Why these belong together:

- they are all about making the operator UI sustainable
- they depend on the validation payload shape
- they should be designed as one console-evolution track, not separate UI microprojects

Primary files:

- `rollingPlayerValidationPayload.ts`
- `rolling-player-metrics.ts`
- `trendsDebug.tsx`

### Track 4. Live-source freshness operations

Purpose:

- keep retained validation and production freshness trustworthy without expanding the cron surface

Grouped backlog items:

- current PK source-tail blockers for Corey Perry, Jesper Bratt, and Seth Jones
- documentation-consistency updates when fresh retained-player evidence supersedes older snapshots

Why these belong together:

- these are operational freshness issues, not code-contract issues
- they should remain a small runbook / repair track
- they should not be mixed into schema or UI work

Primary files:

- refresh/runbook artifacts
- upstream ingest surfaces
- retained-player verification artifacts

## Sequencing Recommendation

Recommended order:

1. Track 4 only as needed to keep retained validation evidence honest.
2. Track 1 next, because trustworthy observability improves every later audit and cleanup step.
3. Track 2 after observability is stable, because semantic cleanup is safer once validation is clearer.
4. Track 3 in parallel with or immediately after Track 1, because it depends on the same validation payload surfaces.

## Track Compression Result

Instead of treating the remaining backlog as a long list of separate pass-2 mini-projects, the repo should now treat it as four implementation tracks:

1. validation observability and readiness
2. compatibility and semantic cleanup
3. validation-surface productization
4. live-source freshness operations

## Net Outcome

Task `5.4` closes with a simpler planning model:

- fewer implementation tracks
- clearer ownership alignment
- less chance of letting the pass-2 backlog sprawl into unrelated scattered work
