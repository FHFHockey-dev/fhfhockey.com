# Rolling Player Validation Freshness Report

Date: March 11, 2026

Command used:

```bash
npm run check:rolling-player-validation-freshness
```

Script:
- [check-rolling-player-validation-freshness.ts](/Users/tim/Code/fhfhockey.com/web/scripts/check-rolling-player-validation-freshness.ts)

## Summary

Validation-player freshness status before stored-vs-source comparison:

- Brent Burns (`8470613`): `BLOCKED`
- Corey Perry (`8470621`): `BLOCKED`
- Jesper Bratt (`8479407`): `READY`
- Seth Jones (`8477495`): `BLOCKED`

Replacement traded-player case:

- none selected in this freshness pass
- Seth Jones remains the retained incomplete-tail proxy

Important shared finding:

- target freshness is healthy for all four players
- `rolling_player_game_metrics` latest row dates match the latest WGO date for every required strength state inspected
- current blockers are source-side freshness blockers, not stale target-row blockers

## Player Results

### Brent Burns (`8470613`)

- role: healthy-control skater
- validation season: `20252026`
- WGO range: `2025-10-07` through `2026-03-10`
- WGO rows: `61`
- target freshness: `OK`
- overall status: `BLOCKED`

Blocking source-tail issues:

- PP builder freshness lag on all-strength and PP validation surfaces
- latest WGO date: `2026-03-10`
- expected PP game ID: `2025021023`
- latest PP builder game ID found: `2025021001`

Immediate implication:

- Burns is ready for non-PP validation
- `pp_share_pct` and `pp_unit` validation should not proceed until the missing PP builder game is refreshed

Required next refresh action:

- rerun [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts) for game `2025021023`

### Corey Perry (`8470621`)

- role: missed-games and traded-player GP case
- validation season: `20252026`
- WGO range: `2025-10-21` through `2026-03-10`
- WGO rows: `51`
- target freshness: `OK`
- overall status: `BLOCKED`

Blocking source-tail issues:

- PK NST tail is one game stale
- latest WGO date: `2026-03-10`
- latest PK counts date: `2026-03-08`
- latest PK rates date: `2026-03-08`
- latest PK on-ice counts date: `2026-03-08`

Immediate implication:

- Perry is ready for all-strength, EV, and PP validation
- PK-specific validation should not proceed until NST PK sources are refreshed through `2026-03-10`

Required next refresh action:

- advance the upstream NST PK source import path so:
  - `nst_gamelog_pk_counts`
  - `nst_gamelog_pk_rates`
  - `nst_gamelog_pk_counts_oi`
  reach `2026-03-10` for player `8470621`

### Jesper Bratt (`8479407`)

- role: heavy PP-role case
- validation season: `20252026`
- WGO range: `2025-10-09` through `2026-03-08`
- WGO rows: `62`
- target freshness: `OK`
- overall status: `READY`

Freshness result:

- all inspected strength states are current
- PP builder freshness is current
- line builder freshness is current
- no NST tail lag detected

Immediate implication:

- Bratt is ready for stored-vs-source validation, including PP-share and PP-role-context checks

### Seth Jones (`8477495`)

- role: partial / incomplete-source-tail proxy
- validation season: `20252026`
- WGO range: `2025-10-07` through `2026-01-02`
- WGO rows: `40`
- target freshness: `OK`
- overall status: `BLOCKED`

Blocking source-tail issues:

- PK NST tail is one game stale
- latest WGO date: `2026-01-02`
- latest PK counts date: `2025-12-30`
- latest PK rates date: `2025-12-30`
- latest PK on-ice counts date: `2025-12-30`

Immediate implication:

- Jones remains usable as the incomplete-tail proxy
- all-strength, EV, and PP validation can proceed
- PK-specific validation remains blocked until NST PK sources are refreshed through `2026-01-02`

Required next refresh action:

- advance the upstream NST PK source import path so:
  - `nst_gamelog_pk_counts`
  - `nst_gamelog_pk_rates`
  - `nst_gamelog_pk_counts_oi`
  reach `2026-01-02` for player `8477495`

## Readiness Matrix

Ready now:

- Brent Burns:
  - all-strength non-PP families
  - EV families
  - PK families
  - line-context validation
- Corey Perry:
  - all-strength families
  - EV families
  - PP families
  - GP / availability validation
  - line-context validation
- Jesper Bratt:
  - all required metric families
  - PP share and PP role validation
  - line-context validation
- Seth Jones:
  - all-strength families
  - EV families
  - PP families
  - line-context validation

Blocked until refresh:

- Brent Burns:
  - `pp_share_pct`
  - `pp_unit`
- Corey Perry:
  - PK metric family validation
- Seth Jones:
  - PK metric family validation

## 7.3 Inputs Captured

This freshness pass establishes the required refresh work for the next sub-task:

- PP builder refresh required for Brent Burns game `2025021023`
- NST PK source-tail refresh required for Corey Perry through `2026-03-10`
- NST PK source-tail refresh required for Seth Jones through `2026-01-02`

## Conclusion

The validation set is usable without replacement.

- Jesper Bratt is fully ready now
- Corey Perry is ready for the highest-priority GP / availability comparisons now, but PK validation is blocked
- Brent Burns is ready for most healthy-control comparisons now, but PP builder freshness must be repaired before PP validation
- Seth Jones remains the correct incomplete-tail proxy and does not need replacement at this stage

