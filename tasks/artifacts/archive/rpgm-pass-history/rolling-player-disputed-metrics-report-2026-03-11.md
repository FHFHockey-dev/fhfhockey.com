# Rolling Player Disputed Metrics Report

Date: March 11, 2026

Command used:

```bash
npm run check:rolling-player-disputed-metrics
```

Script:
- [check-rolling-player-disputed-metrics.ts](/Users/tim/Code/fhfhockey.com/web/scripts/check-rolling-player-disputed-metrics.ts)

Recompute path used:
- [recomputePlayerRowsForValidation(...)](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)

## Scope

This pass provides explicit signoff for the disputed metrics called out in the audit and validation checklist.

Validation cases used:

- Corey Perry (`8470621`, season `20252026`) for traded-player GP / availability semantics
- Brent Burns (`8470613`, season `20252026`) for healthy-control ratio and `/60` validation
- Jesper Bratt (`8479407`, season `20252026`) for PP-share and heavy-PP validation
- Seth Jones (`8477495`, season `20252026`) retained as the incomplete-tail proxy and recorded as blocked where freshness still prevents a trustworthy PK-sensitive signoff

Freshness gating used:

- Brent Burns: ready after the PP-builder refresh actions captured in [rolling-player-refresh-actions-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-refresh-actions-report-2026-03-11.md)
- Corey Perry: GP / availability validation allowed; PK-sensitive validation remains freshness-blocked
- Jesper Bratt: fully ready
- Seth Jones: PK-sensitive validation remains blocked

## Explicit Disputed Metric Results

All explicit disputed metrics passed for the ready validation scopes.

Blocked result retained explicitly:

- Seth Jones (`8477495`) remains `BLOCKED` for PK-sensitive disputed-metric validation because PK NST source tails still stop at `2025-12-30` while WGO is at `2026-01-02`

### GP / Availability Disputes

Corey Perry (`8470621`, season `20252026`, strength `all`) was used as the traded-player GP validation case.

Results:

- `gp_pct_avg_season` replacement field(s): `PASS`
  - compared rows: `51`
  - compared fields: `204`
  - mismatches: `0`
- `gp_pct_total_all`: `PASS`
  - compared rows: `51`
  - compared fields: `51`
  - mismatches: `0`
- rolling GP replacement field(s): `PASS`
  - compared rows: `51`
  - compared fields: `612`
  - mismatches: `0`
- `gp_pct_avg_3ya`: `PASS`
  - compared rows: `51`
  - compared fields: `204`
  - mismatches: `0`
- `gp_pct_avg_career`: `PASS`
  - compared rows: `51`
  - compared fields: `204`
  - mismatches: `0`

Interpretation:

- the redesigned all-strength availability outputs and retained GP compatibility aliases matched fresh recomputed rows for the traded-player validation case
- no row drift or field drift was observed for Perry across the season-level, rolling-window, 3YA, or career GP outputs

### Ratio `lastN` Disputes

Brent Burns (`8470613`) and Jesper Bratt (`8479407`) were used for healthy current-season ratio validation.

Results:

- `shooting_pct_total_lastN`: `PASS`
  - Burns: `488` field comparisons, `0` mismatches
  - Bratt: `496` field comparisons, `0` mismatches
- `primary_points_pct_total_lastN`: `PASS`
  - Burns: `488` field comparisons, `0` mismatches
  - Bratt: `496` field comparisons, `0` mismatches
- `expected_sh_pct_total_lastN`: `PASS`
  - Burns: `488` field comparisons, `0` mismatches
  - Bratt: `496` field comparisons, `0` mismatches
- `ipp_total_lastN`: `PASS`
  - Burns: `488` field comparisons, `0` mismatches
  - Bratt: `496` field comparisons, `0` mismatches

Interpretation:

- the disputed ratio-family `lastN` outputs matched fresh recomputed rows one by one for the ready validation set
- no evidence remained of appearance-window drift or stored-vs-recomputed alias divergence in these ratio families

### PP Share Dispute

Jesper Bratt (`8479407`) was used as the PP-heavy validation case after the builder freshness workflow.

Results:

- `pp_share_pct_total_lastN`: `PASS`
  - compared rows: `124`
  - compared fields: `1984`
  - mismatches: `0`

Interpretation:

- the team-share PP denominator contract and its `lastN` snapshots matched fresh recomputed rows
- the new PP-share support fields also remained in sync in this pass

### `ixg_per_60` Dispute

Brent Burns and Jesper Bratt were used for the refreshed weighted-`/60` signoff.

Results:

- `ixg_per_60`: `PASS`
  - Burns: `244` rows, `6588` field comparisons, `0` mismatches
  - Bratt: `248` rows, `6696` field comparisons, `0` mismatches

Interpretation:

- the fallback-sensitive `ixg_per_60` family matched fresh recomputed rows across all inspected strength states
- this is consistent with the helper hardening work that made direct raw ixG preference and reconstruction paths explicit

### Alias and Support-Field Disputes

Results:

- renamed ratio-family aliases: `PASS`
  - Burns: `8540` field comparisons, `0` mismatches
  - Bratt: `8680` field comparisons, `0` mismatches
- renamed weighted `/60` aliases: `PASS`
  - Burns: `15616` field comparisons, `0` mismatches
  - Bratt: `15872` field comparisons, `0` mismatches
- new numerator / denominator support fields: `PASS`
  - Burns: `10248` field comparisons, `0` mismatches
  - Bratt: `10416` field comparisons, `0` mismatches
  - Perry: `8568` field comparisons, `0` mismatches

Interpretation:

- the canonical ratio and weighted `/60` fields remain aligned with their retained compatibility aliases
- the newly introduced support-field families also matched fresh recomputed rows for the validation cases that exercised them

## Conclusion

`7.5` disputed-metric status:

- GP replacement fields: passed
- legacy GP compatibility fields under the redesigned contract: passed
- disputed ratio `lastN` families: passed
- `pp_share_pct_total_lastN`: passed
- `ixg_per_60`: passed
- renamed alias families: passed
- new support fields: passed
- Seth Jones PK-sensitive proxy case: explicitly blocked pending fresher upstream PK NST tails
