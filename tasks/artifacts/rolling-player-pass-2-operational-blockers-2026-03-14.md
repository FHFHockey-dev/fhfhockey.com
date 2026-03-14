# Operational Blockers

Date: `2026-03-14`
Task: `1.4`

## Purpose

Separate the remaining post-pass operational blockers from:

- arithmetic / formula questions
- longer-horizon cleanup
- observability enhancements that are useful but not currently blocking execution

## Current Operational Blockers

### 1. PK source tails remain genuinely stale for selected validation scopes

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

## Explicitly Not Current Operational Blockers

- Vitest `.next` artifact discovery
  - resolved by the Vitest exclusion fix and full-suite rerun
- retained validation-player target freshness
  - resolved by the March 14 targeted reruns; retained cases now have `targetFreshnessOk: true`
- optional historical baseline stored-row backfill
  - resolved for the retained ready validation set; Burns and Bratt now show `historical_baselines = MATCH`
- broader observability improvements such as TOI trace enrichment or PP mixed-source visualization
  - still valid backlog work, but not the current short-list blocker set
- schema / naming cleanup for canonical-versus-legacy drift
  - important cleanup track, but not blocking the immediate validation workflow
