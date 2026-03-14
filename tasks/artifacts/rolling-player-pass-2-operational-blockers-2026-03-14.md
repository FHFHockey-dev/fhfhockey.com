# Operational Blockers

Date: `2026-03-14`
Task: `1.4`

## Purpose

Separate the remaining post-pass operational blockers from:

- arithmetic / formula questions
- longer-horizon cleanup
- observability enhancements that are useful but not currently blocking execution

## Current Operational Blockers

### 1. Retained validation-player target freshness is stale

- affected cases:
  - Brent Burns
  - Corey Perry
  - Jesper Bratt
- current state:
  - upstream tails are fresher than the stored rolling rows
  - `targetFreshnessOk` is still `false` for those retained validation cases
- impact:
  - March 14 stored validation rows cannot be treated as current signoff evidence
- next action:
  - rerun targeted rolling recomputes and refresh the audit evidence snapshots

### 2. PK source tails remain genuinely stale for selected validation scopes

- affected cases:
  - Corey Perry `pk`
  - Jesper Bratt `pk`
  - Seth Jones `pk`
- current state:
  - PK counts / rates / counts-on-ice tails still lag the WGO tail for those scopes
- impact:
  - PK validation remains blocked even if target-row freshness is repaired
- next action:
  - refresh or confirm the upstream PK ingest path for those slices before trusting PK-family comparisons

### 3. Optional historical baseline fields need backfill on stored rows

- affected fields:
  - `primary_assists_avg_*`
  - `secondary_assists_avg_*`
  - `penalties_drawn_avg_*`
  - `penalties_drawn_per_60_avg_*`
- current state:
  - recomputed values exist
  - sampled stored historical baseline fields still show `null`
- impact:
  - historical-baseline family checks still report mismatches on retained validation rows
- next action:
  - rerun/backfill rolling rows after the optional-metric rollout

## Explicitly Not Current Operational Blockers

- Vitest `.next` artifact discovery
  - resolved by the Vitest exclusion fix and full-suite rerun
- broader observability improvements such as TOI trace enrichment or PP mixed-source visualization
  - still valid backlog work, but not the current short-list blocker set
- schema / naming cleanup for canonical-versus-legacy drift
  - important cleanup track, but not blocking the immediate validation workflow
