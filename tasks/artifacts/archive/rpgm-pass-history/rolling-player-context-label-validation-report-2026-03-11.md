# Rolling Player Context Label Validation Report

Date: March 11, 2026

Command used:

```bash
npm run check:rolling-player-context-labels
```

Script:
- [check-rolling-player-context-labels.ts](/Users/tim/Code/fhfhockey.com/web/scripts/check-rolling-player-context-labels.ts)

## Scope

This pass validates contextual builder-owned labels only:

- `pp_unit`
- `line_combo_slot`
- `line_combo_group`

This report treats these fields as contextual labels, not arithmetic metrics.

Validation cases:

- Corey Perry (`8470621`, season `20252026`)
- Brent Burns (`8470613`, season `20252026`)
- Jesper Bratt (`8479407`, season `20252026`)
- Seth Jones (`8477495`, season `20252026`)

## Freshness Basis

Builder freshness was established in the earlier validation workflow:

- PP builder and line builder freshness for ready cases were checked in [rolling-player-validation-freshness-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-validation-freshness-report-2026-03-11.md)
- Brent Burns PP builder freshness was repaired in [rolling-player-refresh-actions-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-refresh-actions-report-2026-03-11.md)

## Results

All contextual label comparisons passed.

### `pp_unit`

Status: `PASS`

Aggregate result:

- compared rows: `856`
- mismatches: `0`

Per-player results:

- Corey Perry (`8470621`)
  - compared rows: `204`
  - mismatches: `0`
  - missing PP builder rows: `12`
  - result: `PASS`
- Brent Burns (`8470613`)
  - compared rows: `244`
  - mismatches: `0`
  - missing PP builder rows: `36`
  - result: `PASS`
- Jesper Bratt (`8479407`)
  - compared rows: `248`
  - mismatches: `0`
  - missing PP builder rows: `8`
  - result: `PASS`
- Seth Jones (`8477495`)
  - compared rows: `160`
  - mismatches: `0`
  - missing PP builder rows: `0`
  - result: `PASS`

Interpretation:

- stored `pp_unit` values match the trusted builder-derived `unit` label whenever a `powerPlayCombinations` row exists
- when the PP builder row is absent, rolling rows correctly stay `null` rather than inferring a unit from PP share, PPTOI, or other usage fields
- this confirms `pp_unit` is still behaving as a contextual label, not a derived rolling metric

### `line_combo_slot` / `line_combo_group`

Status: `PASS`

Aggregate result:

- compared rows: `856`
- mismatches: `0`

Per-player results:

- Corey Perry (`8470621`)
  - compared rows: `204`
  - mismatches: `0`
  - missing line builder rows: `0`
  - result: `PASS`
- Brent Burns (`8470613`)
  - compared rows: `244`
  - mismatches: `0`
  - missing line builder rows: `0`
  - result: `PASS`
- Jesper Bratt (`8479407`)
  - compared rows: `248`
  - mismatches: `0`
  - missing line builder rows: `0`
  - result: `PASS`
- Seth Jones (`8477495`)
  - compared rows: `160`
  - mismatches: `0`
  - missing line builder rows: `0`
  - result: `PASS`

Interpretation:

- stored `line_combo_slot` and `line_combo_group` values match the refreshed `lineCombinations` builder assignments for the same game/team rows
- no evidence appeared that these labels were being inferred from rolling metric math or drifting away from the builder-owned source of truth
- this confirms the fields remain contextual labels, not arithmetic outputs

## Conclusion

`7.6` context-label status:

- `pp_unit`: passed
- `line_combo_slot`: passed
- `line_combo_group`: passed

All required contextual label validations succeeded against refreshed upstream builder outputs.
