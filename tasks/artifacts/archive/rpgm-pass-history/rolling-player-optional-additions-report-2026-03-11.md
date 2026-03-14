# Rolling Player Optional Additions Report

Date: 2026-03-11

## Scope

This report records the `8.5` validation pass for the optional rolling-player additions introduced in the optional phase:

- `on_ice_sv_pct`
- raw zone-start support families: `oz_starts`, `dz_starts`, `nz_starts`
- raw on-ice goal/shot count families: `oi_gf`, `oi_ga`, `oi_sf`, `oi_sa`
- optional weighted `/60` families:
  - `goals_per_60`
  - `assists_per_60`
  - `primary_assists_per_60`
  - `secondary_assists_per_60`
- optional PP-role context fields:
  - `pp_share_of_team`
  - `pp_unit_usage_index`
  - `pp_unit_relative_toi`
  - `pp_vs_unit_avg`

Ready validation cases:

- Brent Burns (`8470613`, `20252026`)
- Jesper Bratt (`8479407`, `20252026`)

## Commands Run

```bash
npm run check:rolling-player-optional-additions
```

Targeted refresh attempt used to distinguish stale targets from writer logic defects:

```bash
curl -i -sS -m 60 -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-rolling-player-averages?playerId=8470613&season=20252026&fastMode=true"
```

Observed response:

```text
HTTP/1.1 500 Internal Server Error
{"message":"Bad Request"}
```

## Validation Result Summary

The optional-additions validation script returned `FAIL` for every optional family when comparing stored rows against recomputed rows or builder context.

The mismatch pattern was consistent:

- recomputed rows contained the optional fields with populated values
- stored `rolling_player_game_metrics` rows still held `null` for those fields
- no compared family showed a stored non-null value diverging from a recomputed non-null value

This indicates a target rollout/backfill gap, not a recompute-path math defect.

Representative examples from the live run:

- `2025-10-07|all:on_ice_sv_pct_total_all:stored=null recomputed=100`
- `2025-10-07|all:oz_starts_total_all:stored=null recomputed=3`
- `2025-10-07|all:oi_gf_total_all:stored=null recomputed=1`
- `2025-10-09|all:goals_per_60_total_all:stored=null recomputed=3.287671`
- `2026-03-10|all:pp_share_of_team:stored=null builder=0.141667`

## Family-by-Family Classification

### `on_ice_sv_pct`

Validation result:

- Brent Burns: `FAIL`
- Jesper Bratt: `FAIL`

Interpretation:

- recomputed rows produce valid optional ratio outputs
- stored rows are still `null`
- this is a rollout/backfill issue on the stored target

Classification:

- remains optional

Reason:

- the family is useful as an inspection metric, but no PRD requirement or live validation outcome justifies promoting it into the required core contract

### Raw zone-start support families

Validation result:

- Brent Burns: `FAIL`
- Jesper Bratt: `FAIL`

Interpretation:

- recomputed rows produce the raw zone-start support outputs
- stored rows remain `null`
- failure is consistent with optional-field target rollout not having been persisted/backfilled yet

Classification:

- remains optional

Reason:

- these are support/debugging outputs that enrich interpretation and auditability, but they are not required consumer-facing core metrics

### Raw on-ice goal/shot count families

Validation result:

- Brent Burns: `FAIL`
- Jesper Bratt: `FAIL`

Interpretation:

- recomputed rows carry the optional additive on-ice families
- stored rows remain `null`
- current mismatch is target-state drift, not a family-definition dispute

Classification:

- remains optional

Reason:

- they are useful support families and chart/debug enrichments, but they do not need to graduate into the core contract to satisfy the remediation goals

### Optional weighted `/60` families

Validation result:

- Brent Burns: `FAIL`
- Jesper Bratt: `FAIL`

Interpretation:

- recomputed rows populate the optional weighted-rate families and their historical support fields
- stored rows remain `null`
- mismatch pattern again indicates stale/unbackfilled target rows

Classification:

- remains optional

Reason:

- these additions are useful extensions, but the required remediation work already established the canonical core weighted-rate surface

### Optional PP-role context fields

Validation result:

- Brent Burns: `FAIL`
- Jesper Bratt: `PASS`

Interpretation:

- Jesper Bratt confirms the optional PP-context mapping is capable of matching live builder context exactly
- Brent Burns only mismatched on the latest builder-backed row, where stored values remained `null`
- the failed targeted refresh attempt prevented closing that stored-target gap during this sub-task

Classification:

- remains optional

Reason:

- these fields are explicitly contextual enrichments, separate from the required `pp_share_pct` contract
- they should not graduate into the core contract

## Decision

No optional addition graduates into the core contract in this pass.

All validated optional additions remain optional.

## Follow-up Needed

The following follow-up is required before stored-row validation for the optional families can pass cleanly:

- apply any optional schema migrations not yet present in the live target environment
- rerun rolling-player recompute/backfill for the affected seasons/players after the optional schema surface is writable
- resolve the `500 {"message":"Bad Request"}` refresh-path failure observed when attempting a targeted rolling refresh for Brent Burns

## Conclusion

This validation pass supports the optional-phase decision, not a contract change:

- optional families are implemented in the recompute path
- optional families are not yet reliably persisted in the stored target for all validated cases
- that gap should be treated as rollout/backfill follow-up, not as a reason to promote any optional family into the required core contract
