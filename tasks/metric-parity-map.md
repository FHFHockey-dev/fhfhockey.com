# Metric Parity Map

## Purpose

This document maps the repo's existing NST-derived metric surfaces to their NHL API-derived replacements. It is the working contract for parity implementation.

Status values:

- `exact`
- `close approximation`
- `unsupported`
- `deprecated`

Policy:

- NHL-derived correctness wins when it conflicts with NST edge-case behavior.
- Any intentional divergence from NST behavior must be documented and versioned.

## Current NST Table Families

Verification sources for the inventory below:

- `web/lib/supabase/database-generated.types.ts`
- `web/pages/api/v1/db/update-nst-gamelog.ts`
- `web/pages/api/v1/db/nst_gamelog_scraper.py`
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
- `web/pages/stats/player/[playerId].tsx`
- `web/pages/api/v1/db/update-nst-goalies.ts`
- `web/pages/api/v1/db/nst_gamelog_goalie_scraper.py`

### Verified Skater Matrix

The current skater gamelog contract is a full 4 x 4 matrix:

| Strength split | Counts | Rates | On-ice counts | On-ice rates |
| --- | --- | --- | --- | --- |
| All situations | `nst_gamelog_as_counts` | `nst_gamelog_as_rates` | `nst_gamelog_as_counts_oi` | `nst_gamelog_as_rates_oi` |
| Even strength | `nst_gamelog_es_counts` | `nst_gamelog_es_rates` | `nst_gamelog_es_counts_oi` | `nst_gamelog_es_rates_oi` |
| Power play | `nst_gamelog_pp_counts` | `nst_gamelog_pp_rates` | `nst_gamelog_pp_counts_oi` | `nst_gamelog_pp_rates_oi` |
| Penalty kill | `nst_gamelog_pk_counts` | `nst_gamelog_pk_rates` | `nst_gamelog_pk_counts_oi` | `nst_gamelog_pk_rates_oi` |

That yields 16 skater NST gamelog tables currently present and referenced by the repo.

The current skater gamelog contract in the repo uses these table families:

- `nst_gamelog_as_counts`
- `nst_gamelog_as_rates`
- `nst_gamelog_as_counts_oi`
- `nst_gamelog_as_rates_oi`
- `nst_gamelog_es_counts`
- `nst_gamelog_es_rates`
- `nst_gamelog_es_counts_oi`
- `nst_gamelog_es_rates_oi`
- `nst_gamelog_pp_counts`
- `nst_gamelog_pp_rates`
- `nst_gamelog_pp_counts_oi`
- `nst_gamelog_pp_rates_oi`
- `nst_gamelog_pk_counts`
- `nst_gamelog_pk_rates`
- `nst_gamelog_pk_counts_oi`
- `nst_gamelog_pk_rates_oi`

### Verified Goalie Matrix

The current goalie gamelog contract is a 5 x 2 matrix:

| Strength split | Counts | Rates |
| --- | --- | --- |
| All situations | `nst_gamelog_goalie_all_counts` | `nst_gamelog_goalie_all_rates` |
| Even strength | `nst_gamelog_goalie_ev_counts` | `nst_gamelog_goalie_ev_rates` |
| Exact 5v5 | `nst_gamelog_goalie_5v5_counts` | `nst_gamelog_goalie_5v5_rates` |
| Power play | `nst_gamelog_goalie_pp_counts` | `nst_gamelog_goalie_pp_rates` |
| Penalty kill | `nst_gamelog_goalie_pk_counts` | `nst_gamelog_goalie_pk_rates` |

That yields 10 goalie NST gamelog tables currently present and referenced by the repo.

Important distinction:

- skater NST families have explicit on-ice table variants
- goalie NST families do not use separate on-ice table variants

The current database also includes goalie NST gamelog tables:

- `nst_gamelog_goalie_all_counts`
- `nst_gamelog_goalie_all_rates`
- `nst_gamelog_goalie_ev_counts`
- `nst_gamelog_goalie_ev_rates`
- `nst_gamelog_goalie_5v5_counts`
- `nst_gamelog_goalie_5v5_rates`
- `nst_gamelog_goalie_pp_counts`
- `nst_gamelog_goalie_pp_rates`
- `nst_gamelog_goalie_pk_counts`
- `nst_gamelog_goalie_pk_rates`

### Current Repo Consumers

Verified skater-family consumers include:

- player page joins and fetches in `web/pages/stats/player/[playerId].tsx`
- rolling player averages in `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
- analytics views such as `web/sql/views/analytics.vw_sko_skater_base.sql`
- NST ingest and refresh routes such as `web/pages/api/v1/db/update-nst-gamelog.ts`

Verified goalie-family consumers include:

- goalie NST ingest in `web/pages/api/v1/db/update-nst-goalies.ts`
- goalie scraper mapping in `web/pages/api/v1/db/nst_gamelog_goalie_scraper.py`
- goalie coverage and missing-data checks in `web/pages/api/v1/db/check-missing-goalie-data.ts`
- goalie-facing reads such as `web/components/RosterMatrix/RosterMatrixWrapper.tsx`

## Explicit Repo Consumer: Player Page Game Log Merge

The player page currently merges these NST-derived fields into the skater game log.

### Possession Percentages

| Existing field | Current NST source | NHL-derived target | Status | Notes |
| --- | --- | --- | --- | --- |
| `cf_pct` | `nst_gamelog_as_counts_oi.cf_pct` | Derived from normalized on-ice `CF / (CF + CA)` | exact | Same definition, derived from event rows plus on-ice attribution |
| `ff_pct` | `nst_gamelog_as_counts_oi.ff_pct` | Derived from normalized on-ice `FF / (FF + FA)` | exact | |
| `sf_pct` | `nst_gamelog_as_counts_oi.sf_pct` | Derived from normalized on-ice `SF / (SF + SA)` | exact | |
| `gf_pct` | `nst_gamelog_as_counts_oi.gf_pct` | Derived from normalized on-ice `GF / (GF + GA)` | exact | Excludes shootout |
| `xgf_pct` | `nst_gamelog_as_counts_oi.xgf_pct` | Derived from normalized on-ice `xGF / (xGF + xGA)` | close approximation | Depends on the finalized phase 1 xG-style shot model inputs |
| `scf_pct` | `nst_gamelog_as_counts_oi.scf_pct` | Derived from normalized on-ice `SCF / (SCF + SCA)` | close approximation | Final rule depends on scoring-chance bucket definitions |
| `hdcf_pct` | `nst_gamelog_as_counts_oi.hdcf_pct` | Derived from normalized on-ice `HDCF / (HDCF + HDCA)` | close approximation | Final rule depends on high-danger definition |
| `mdcf_pct` | `nst_gamelog_as_counts_oi.mdcf_pct` | Derived from normalized on-ice `MDCF / (MDCF + MDCA)` | close approximation | |
| `ldcf_pct` | `nst_gamelog_as_counts_oi.ldcf_pct` | Derived from normalized on-ice `LDCF / (LDCF + LDCA)` | close approximation | |

### On-Ice Possession Percentages

| Existing field | Current NST source | NHL-derived target | Status | Notes |
| --- | --- | --- | --- | --- |
| `on_ice_cf_pct` | `nst_gamelog_as_counts_oi.cf_pct` | Same as `cf_pct` from normalized on-ice counts | exact | Alias surface |
| `on_ice_ff_pct` | `nst_gamelog_as_counts_oi.ff_pct` | Same as `ff_pct` | exact | |
| `on_ice_sf_pct` | `nst_gamelog_as_counts_oi.sf_pct` | Same as `sf_pct` | exact | |
| `on_ice_gf_pct` | `nst_gamelog_as_counts_oi.gf_pct` | Same as `gf_pct` | exact | |
| `on_ice_xgf_pct` | `nst_gamelog_as_counts_oi.xgf_pct` | Same as `xgf_pct` | close approximation | |
| `on_ice_scf_pct` | `nst_gamelog_as_counts_oi.scf_pct` | Same as `scf_pct` | close approximation | |
| `on_ice_hdcf_pct` | `nst_gamelog_as_counts_oi.hdcf_pct` | Same as `hdcf_pct` | close approximation | |

### Individual Per-60 Production

| Existing field | Current NST source | NHL-derived target | Status | Notes |
| --- | --- | --- | --- | --- |
| `goals_per_60` | `nst_gamelog_as_rates.goals_per_60` | Individual goals / TOI * 60 | exact | |
| `total_assists_per_60` | `nst_gamelog_as_rates.total_assists_per_60` | Individual assists / TOI * 60 | exact | |
| `first_assists_per_60` | `nst_gamelog_as_rates.first_assists_per_60` | First assists / TOI * 60 | exact | |
| `second_assists_per_60` | `nst_gamelog_as_rates.second_assists_per_60` | Second assists / TOI * 60 | exact | |
| `total_points_per_60` | `nst_gamelog_as_rates.total_points_per_60` | Points / TOI * 60 | exact | |
| `shots_per_60` | `nst_gamelog_as_rates.shots_per_60` | Shots on goal / TOI * 60 | exact | Goals count as shots on goal |
| `ixg_per_60` | `nst_gamelog_as_rates.ixg_per_60` | Individual xG / TOI * 60 | close approximation | Depends on finalized shot-value methodology |
| `icf_per_60` | `nst_gamelog_as_rates.icf_per_60` | Individual shot attempts / TOI * 60 | exact | |
| `iff_per_60` | `nst_gamelog_as_rates.iff_per_60` | Individual unblocked attempts / TOI * 60 | exact | |
| `iscfs_per_60` | `nst_gamelog_as_rates.iscfs_per_60` | Individual scoring chances / TOI * 60 | close approximation | |
| `hdcf_per_60` | `nst_gamelog_as_rates.hdcf_per_60` | Individual high-danger chances / TOI * 60 | close approximation | |
| `rush_attempts_per_60` | `nst_gamelog_as_rates.rush_attempts_per_60` | Derived rush attempts / TOI * 60 | close approximation | Phase 1 deliverable |
| `rebounds_created_per_60` | `nst_gamelog_as_rates.rebounds_created_per_60` | Derived rebounds created / TOI * 60 | close approximation | Phase 1 deliverable |

### Defensive and Discipline Per-60

| Existing field | Current NST source | NHL-derived target | Status | Notes |
| --- | --- | --- | --- | --- |
| `hdca_per_60` | `nst_gamelog_as_rates.hdca_per_60` | On-ice high-danger chances against / TOI * 60 | close approximation | |
| `sca_per_60` | `nst_gamelog_as_rates.sca_per_60` | On-ice scoring chances against / TOI * 60 | close approximation | |
| `shots_blocked_per_60` | `nst_gamelog_as_rates.shots_blocked_per_60` | Individual blocked shots / TOI * 60 | exact | |
| `xga_per_60` | `nst_gamelog_as_rates.xga_per_60` | On-ice xGA / TOI * 60 | close approximation | |
| `ga_per_60` | `nst_gamelog_as_rates.ga_per_60` | On-ice GA / TOI * 60 | exact | Excludes shootout |
| `pim_per_60` | `nst_gamelog_as_rates.pim_per_60` | Individual PIM / TOI * 60 | exact | |
| `total_penalties_per_60` | `nst_gamelog_as_rates.total_penalties_per_60` | Penalized events / TOI * 60 | exact | |
| `penalties_drawn_per_60` | `nst_gamelog_as_rates.penalties_drawn_per_60` | Penalties drawn / TOI * 60 | exact | |
| `penalty_differential_per_60` | Derived from NST rates | `(penalties_drawn - penalties_taken) / TOI * 60` | exact | Derived surface, not a raw source column |
| `giveaways_per_60` | `nst_gamelog_as_rates.giveaways_per_60` | Giveaways / TOI * 60 | exact | |
| `takeaways_per_60` | `nst_gamelog_as_rates.takeaways_per_60` | Takeaways / TOI * 60 | exact | |
| `hits_per_60` | `nst_gamelog_as_rates.hits_per_60` | Hits / TOI * 60 | exact | |

### On-Ice Rates Per-60

| Existing field | Current NST source | NHL-derived target | Status | Notes |
| --- | --- | --- | --- | --- |
| `on_ice_goals_per_60` | `nst_gamelog_as_rates_oi.gf_per_60` | GF / on-ice TOI * 60 | exact | |
| `on_ice_goals_against_per_60` | `nst_gamelog_as_rates_oi.ga_per_60` | GA / on-ice TOI * 60 | exact | |
| `on_ice_shots_per_60` | `nst_gamelog_as_rates_oi.sf_per_60` | SF / on-ice TOI * 60 | exact | |
| `on_ice_shots_against_per_60` | `nst_gamelog_as_rates_oi.sa_per_60` | SA / on-ice TOI * 60 | exact | |
| `on_ice_cf_per_60` | `nst_gamelog_as_rates_oi.cf_per_60` | CF / on-ice TOI * 60 | exact | |
| `on_ice_ca_per_60` | `nst_gamelog_as_rates_oi.ca_per_60` | CA / on-ice TOI * 60 | exact | |
| `on_ice_ff_per_60` | `nst_gamelog_as_rates_oi.ff_per_60` | FF / on-ice TOI * 60 | exact | |
| `on_ice_fa_per_60` | `nst_gamelog_as_rates_oi.fa_per_60` | FA / on-ice TOI * 60 | exact | |
| `on_ice_xgf_per_60` | `nst_gamelog_as_rates_oi.xgf_per_60` | xGF / on-ice TOI * 60 | close approximation | |
| `on_ice_xga_per_60` | `nst_gamelog_as_rates_oi.xga_per_60` | xGA / on-ice TOI * 60 | close approximation | |

### Zone Usage and On-Ice Impact

| Existing field | Current NST source | NHL-derived target | Status | Notes |
| --- | --- | --- | --- | --- |
| `off_zone_start_pct` | `nst_gamelog_as_counts_oi.off_zone_start_pct` | Offensive zone starts / all zone starts | exact | Must be shift/on-ice driven |
| `def_zone_start_pct` | Derived from `off_zone_starts`, `neu_zone_starts`, `def_zone_starts` | Defensive zone starts / all zone starts | exact | Current page already derives it |
| `neu_zone_start_pct` | Derived from `off_zone_starts`, `neu_zone_starts`, `def_zone_starts` | Neutral zone starts / all zone starts | exact | |
| `off_zone_faceoff_pct` | `nst_gamelog_as_counts_oi.off_zone_faceoff_pct` | Offensive zone faceoffs / all OZ+NZ+DZ faceoffs | exact | |
| `on_ice_sh_pct` | `nst_gamelog_as_counts_oi.on_ice_sh_pct` | On-ice SH% | exact | |
| `on_ice_sv_pct` | `nst_gamelog_as_counts_oi.on_ice_sv_pct` | On-ice SV% | exact | |
| `pdo` | `nst_gamelog_as_counts_oi.pdo` | `on_ice_sh_pct + on_ice_sv_pct` | exact | |

### Raw Count Surfaces Exposed on the Player Page

| Existing field | Current NST source | NHL-derived target | Status | Notes |
| --- | --- | --- | --- | --- |
| `ixg` | `nst_gamelog_as_counts.ixg` | Individual xG | close approximation | |
| `icf` | `nst_gamelog_as_counts.icf` | Individual shot attempts | exact | |
| `iff` | `nst_gamelog_as_counts.iff` | Individual unblocked attempts | exact | |
| `hdcf` | `nst_gamelog_as_counts.hdcf` | Individual high-danger chances for | close approximation | |
| `hdca` | `nst_gamelog_as_counts_oi.hdca` | On-ice high-danger chances against | close approximation | Current page reads this from on-ice counts |
| `rush_attempts` | `nst_gamelog_as_counts.rush_attempts` | Derived rush attempts | close approximation | Phase 1 deliverable |
| `rebounds_created` | `nst_gamelog_as_counts.rebounds_created` | Derived rebounds created | close approximation | Phase 1 deliverable |
| `cf` | `nst_gamelog_as_counts_oi.cf` | On-ice Corsi for | exact | |
| `ca` | `nst_gamelog_as_counts_oi.ca` | On-ice Corsi against | exact | |
| `ff` | `nst_gamelog_as_counts_oi.ff` | On-ice Fenwick for | exact | |
| `fa` | `nst_gamelog_as_counts_oi.fa` | On-ice Fenwick against | exact | |
| `sf` | `nst_gamelog_as_counts_oi.sf` | On-ice shots for | exact | |
| `sa` | `nst_gamelog_as_counts_oi.sa` | On-ice shots against | exact | |
| `gf` | `nst_gamelog_as_counts_oi.gf` | On-ice goals for | exact | |
| `ga` | `nst_gamelog_as_counts_oi.ga` | On-ice goals against | exact | |
| `xgf` | `nst_gamelog_as_counts_oi.xgf` | On-ice xG for | close approximation | |
| `xga` | `nst_gamelog_as_counts_oi.xga` | On-ice xG against | close approximation | |
| `scf` | `nst_gamelog_as_counts_oi.scf` | On-ice scoring chances for | close approximation | |
| `sca` | `nst_gamelog_as_counts_oi.sca` | On-ice scoring chances against | close approximation | |

## Strength-Split Parity Families

These are the target replacement families for the current NST skater gamelog tables.

| NST family | NHL-derived target | Status | Notes |
| --- | --- | --- | --- |
| `nst_gamelog_as_counts` | All-situations individual counts from normalized events plus TOI | exact / close approximation by metric | Exact for event counts; chance/xG families depend on finalized danger and xG rules |
| `nst_gamelog_as_rates` | All-situations individual per-60 rates from normalized events plus TOI | exact / close approximation by metric | |
| `nst_gamelog_as_counts_oi` | All-situations on-ice counts from normalized events plus shift-based on-ice attribution | exact / close approximation by metric | |
| `nst_gamelog_as_rates_oi` | All-situations on-ice per-60 rates from normalized events plus shift-based on-ice attribution | exact / close approximation by metric | |
| `nst_gamelog_es_counts` | Even-strength individual counts | exact / close approximation by metric | Uses canonical EV/exact manpower filters |
| `nst_gamelog_es_rates` | Even-strength individual per-60 rates | exact / close approximation by metric | |
| `nst_gamelog_es_counts_oi` | Even-strength on-ice counts | exact / close approximation by metric | |
| `nst_gamelog_es_rates_oi` | Even-strength on-ice per-60 rates | exact / close approximation by metric | |
| `nst_gamelog_pp_counts` | Power-play individual counts | exact / close approximation by metric | |
| `nst_gamelog_pp_rates` | Power-play individual per-60 rates | exact / close approximation by metric | |
| `nst_gamelog_pp_counts_oi` | Power-play on-ice counts | exact / close approximation by metric | |
| `nst_gamelog_pp_rates_oi` | Power-play on-ice per-60 rates | exact / close approximation by metric | |
| `nst_gamelog_pk_counts` | Penalty-kill individual counts | exact / close approximation by metric | |
| `nst_gamelog_pk_rates` | Penalty-kill individual per-60 rates | exact / close approximation by metric | |
| `nst_gamelog_pk_counts_oi` | Penalty-kill on-ice counts | exact / close approximation by metric | |
| `nst_gamelog_pk_rates_oi` | Penalty-kill on-ice per-60 rates | exact / close approximation by metric | |

## Goalie Parity Families

Goalie parity is in scope for phase 1.

| NST family | NHL-derived target | Status | Notes |
| --- | --- | --- | --- |
| `nst_gamelog_goalie_all_counts` | All-situations goalie counts from normalized shots/goals against and shift-state context | exact / close approximation by metric | Exact for shots/goals against; xG-style goalie metrics depend on finalized shot values |
| `nst_gamelog_goalie_all_rates` | All-situations goalie rates from normalized shots/goals against and TOI | exact / close approximation by metric | |
| `nst_gamelog_goalie_ev_counts` | Even-strength goalie counts | exact / close approximation by metric | |
| `nst_gamelog_goalie_ev_rates` | Even-strength goalie rates | exact / close approximation by metric | |
| `nst_gamelog_goalie_5v5_counts` | Exact 5v5 goalie counts | exact / close approximation by metric | Separate from generic EV when needed |
| `nst_gamelog_goalie_5v5_rates` | Exact 5v5 goalie rates | exact / close approximation by metric | |
| `nst_gamelog_goalie_pp_counts` | Goalie counts while the goalie’s team is on the power play | exact / close approximation by metric | |
| `nst_gamelog_goalie_pp_rates` | Goalie rates while on the power play | exact / close approximation by metric | |
| `nst_gamelog_goalie_pk_counts` | Goalie counts while the goalie’s team is shorthanded | exact / close approximation by metric | |
| `nst_gamelog_goalie_pk_rates` | Goalie rates while shorthanded | exact / close approximation by metric | |

## Known Derived Rules That Require Versioning

These are not allowed to remain implicit:

- rush classification
- rebound classification
- flurry classification
- scoring-chance classification
- medium-danger classification
- high-danger classification
- penalty-shot handling
- exact EV vs exact `5v5` vs broader non-special-teams handling
- empty-net treatment

## Open Mapping Work

- Audit all downstream consumers beyond the player page and extend this map if any additional NST-era fields are still in use.
- Add explicit goalie metric columns and parity statuses once the current downstream goalie surfaces are enumerated.
- Add line, pairing, and team parity surfaces once the normalized on-ice derivation contract is finalized.
