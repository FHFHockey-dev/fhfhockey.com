## pass-2 suggested metric additions review

Sub-task: `5.6`

This artifact reviews only metric additions that are already derivable from the current source surface. No new providers, no new scraping contracts, and no non-derivable projections are considered here.

## Review rule

A candidate qualifies only if all of the following are true:

- the underlying source columns already exist in current upstream tables or builders
- the metric can be derived inside the current rolling contract without inventing new source semantics
- the metric adds validation or downstream value beyond what is already persisted today
- the metric can be surfaced in `trendsDebug.tsx` without changing the core meaning of the current rolling pipeline

## Decision summary

All five PRD candidates remain valid under the current source surface:

- `penalties_drawn`
- `penalties_drawn_per_60`
- `primary_assists`
- `secondary_assists`
- `pp_toi_seconds`

All five should be treated as optional post-audit enhancements rather than pass-2 correctness blockers.

Recommended sequencing:

1. add additive decomposition metrics first
2. add the matching weighted-rate / deployment companions next
3. expose all approved additions in `trendsDebug.tsx` when implementation begins

## Candidate review

### 1. `penalties_drawn`

- decision: `approve as optional enhancement`
- source tables:
  - `nst_gamelog_as_counts`
  - `nst_gamelog_es_counts`
  - `nst_gamelog_pp_counts`
  - `nst_gamelog_pk_counts`
- source columns:
  - `penalties_drawn`
- current evidence:
  - `fetchRollingPlayerAverages.ts` already types and fetches NST `penalties_drawn`
  - `database-generated.types.ts` already exposes `penalties_drawn` across the relevant NST tables
- formula:
  - `sum(penalties_drawn)`
- why it helps:
  - adds a useful discipline / opportunity-creation counting stat
  - explains player-driven PP opportunity creation without adding a new provider
  - gives downstream context for role/value profiles that current rolling additive families do not capture
- suggested splits:
  - `all`
  - `ev`
  - `pp`
  - `pk`
- `trendsDebug.tsx`:
  - should expose as a normal additive metric with raw-source rows and rolling-window sums

### 2. `penalties_drawn_per_60`

- decision: `approve as optional enhancement`
- source tables:
  - the same NST counts tables as `penalties_drawn`
  - existing TOI resolution contract through `rollingPlayerToiContract.ts`
- source columns:
  - `penalties_drawn`
  - resolved `toi_seconds`
- current evidence:
  - upstream types already expose `penalties_drawn_per_60` in non-rolling surfaces
  - current rolling pipeline already supports the same weighted-rate contract for analogous count metrics
- formula:
  - `sum(penalties_drawn) / sum(toi_seconds) * 3600`
- why it helps:
  - makes draw-rate comparisons deployment-adjusted
  - fits the existing weighted-rate audit and validation model cleanly
  - pairs naturally with the additive `penalties_drawn` addition
- suggested splits:
  - `all`
  - `ev`
  - `pp`
  - `pk`
- `trendsDebug.tsx`:
  - should expose numerator, denominator, TOI source trace, and rolling support components the same way it does for other `/60` metrics

### 3. `primary_assists`

- decision: `approve as optional enhancement`
- source tables:
  - `nst_gamelog_as_counts`
  - `nst_gamelog_es_counts`
  - `nst_gamelog_pp_counts`
  - `nst_gamelog_pk_counts`
- source columns:
  - `first_assists`
- current evidence:
  - `fetchRollingPlayerAverages.ts` already fetches `first_assists`
  - the current weighted-rate family already persists `primary_assists_per_60`, so additive parity is missing rather than unsupported
- formula:
  - `sum(first_assists)`
- why it helps:
  - closes an additive-surface gap underneath `primary_assists_per_60`
  - makes `primary_points_pct` easier to validate and explain
  - improves assist decomposition without changing existing hockey meaning
- suggested splits:
  - `all`
  - `ev`
  - `pp`
  - `pk`
- `trendsDebug.tsx`:
  - should expose as an additive metric and as a visible component for `primary_points_pct` and `primary_assists_per_60`

### 4. `secondary_assists`

- decision: `approve as optional enhancement`
- source tables:
  - `nst_gamelog_as_counts`
  - `nst_gamelog_es_counts`
  - `nst_gamelog_pp_counts`
  - `nst_gamelog_pk_counts`
- source columns:
  - `second_assists`
- current evidence:
  - `fetchRollingPlayerAverages.ts` already fetches `second_assists`
  - the current weighted-rate family already persists `secondary_assists_per_60`, so additive parity is missing rather than unsupported
- formula:
  - `sum(second_assists)`
- why it helps:
  - closes an additive-surface gap underneath `secondary_assists_per_60`
  - improves assist decomposition and role analysis
  - makes the assist mix more interpretable in manual validation
- suggested splits:
  - `all`
  - `ev`
  - `pp`
  - `pk`
- `trendsDebug.tsx`:
  - should expose as an additive metric and as a visible component for `secondary_assists_per_60`

### 5. `pp_toi_seconds`

- decision: `approve as optional enhancement`
- source tables:
  - `powerPlayCombinations`
  - `wgo_skater_stats` as fallback-only inspection context
- source columns:
  - `PPTOI`
  - `pp_toi`
- current evidence:
  - current PP-share logic already depends on builder `PPTOI`
  - `fetchRollingPlayerAverages.ts` already types and fetches WGO `pp_toi`
  - PP-share validation currently has to back into deployment through share support rather than a direct persisted PP TOI metric
- formula:
  - `sum(player_pp_toi_seconds)`
- why it helps:
  - makes PP deployment inspectable without reverse-engineering from share
  - improves PP-share validation and PP-role debugging
  - gives `trendsDebug.tsx` a direct PP usage denominator / numerator companion
- suggested splits:
  - `all`
  - `pp`
- `trendsDebug.tsx`:
  - should expose builder-derived PP TOI, fallback context, and any mixed-source warning when share windows rely on fallback rows

## Sequencing recommendation

Recommended implementation order after the audit:

1. `primary_assists` and `secondary_assists`
   - highest additive-parity value because the rolling table already exposes the matching `/60` families
2. `penalties_drawn` and `penalties_drawn_per_60`
   - highest optional upside for discipline / role context using existing NST source columns
3. `pp_toi_seconds`
   - highest PP-debug value, but best added after the PP mixed-source trace backlog items because its value is largest when paired with clearer PP provenance

## Backlog implication

These additions should live in `tasks/rpm-audit-action-items-pass-2.md` under `optional enhancement`. They are worthwhile, but none should block pass-2 signoff of the current rolling contract.
