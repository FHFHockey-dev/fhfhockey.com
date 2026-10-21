# W2 — Rolling-metrics stage audit (read-only, 2026-10-21)

Scope: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` (writer, 4,834 lines) → `rolling_player_game_metrics` (wide, 1,114 cols) + `rolling_player_metric_support_payloads` (sidecar JSONB). No repo edits, no DB/HTTP calls. All numbers marked "est." are arithmetic from code, not measurements.

Scratch outputs (outside repo, same folder):
- `w2_col_hits.tsv` — `file:column` literal hits for every rpgm column in `web/` (excl. generated types, `lib/supabase/Upserts/**`, tests).
- `w2_rank_fields.txt` — the 126 fields of `ROLLING_RANKING_SELECT_FIELDS`.
- `w2_col_classes.tsv` — per-column class (storage × readership).
- `../w2scripts/classify.py` — the classifier (reproducible: `python3 -I classify.py <audit dir>`).
- Intermediates checked: `rpgm_cols.txt` = 1,114 lines, column names (OK). `consumer_files.txt` = 1,763 lines but is an unfiltered file listing (pages/auth, blog, …) — **not trusted, not used**.

---

## 1. Column utilization

### Method
1. Literal scan: `rg -o -w -F -f rpgm_cols.txt` over `web/**/*.ts(x)` excluding generated types, the writer folder and tests → 200 distinct column names hit (incl. generic keys like `game_id`, `season`).
2. Dynamic readers resolved by reading the builders and expanding them in `classify.py`:
   - FORGE allowlist `ROLLING_ROW_SELECT_CLAUSE` (`web/lib/projections/queries/skater-queries.ts:82-133`; compat order adds both canonical and `_avg_` legacy names) + `skater-stage.ts:396` (`toi_seconds_avg_last5,toi_seconds_avg_all`).
   - Rankings: `ROLLING_RANKING_SELECT_FIELDS` (126, `web/lib/rankings/rollingRankingSelectFields.ts`), used by `rankingQueries.ts:353`, `deploymentTiers.ts:490`; `resultsLuckRollingSelectFields` (`resultsLuckSources.ts:36-56`, windows last5/10/20 + season); `playerMatrix.ts:682-692`.
   - Trends player page `pages/trends/player/[playerId].tsx:480-495`: 41 metric keys × {last3,last5,last10,last20,all,season,3ya,career}; additive/TOI families read only `${k}_avg_${scope}`, ratio/weighted read `${k}_${scope}` + `${k}_avg_${scope}` (`:445-464`), plus the sidecar `historicalCompatibility` (`:501`).
   - Diagnostic-only: `pages/trendsDebug.tsx`, `web/scripts/*` (and `rollingPlayerValidationPayload.ts:2191` `select("*")`, a validation path).
   - Not readers of the table (metadata strings only): `sustainability/featureDictionary.ts`, `dashboard/commandCenterData.ts`, `rollingForgePipeline.ts`, `predictions/sourceOwnership.ts`, `rankings/{war,splits,trending,metricDefinitions}.ts`. `goalie-queries.ts` does not touch the table.
3. Storage class from the writer's own pruning rule (`fetchRollingPlayerAverages.ts:397-420`): a field is moved to the sidecar and written as NULL in the wide row if it ends `_all` or contains `_last3|_3ya|_career|_avg_` or starts `three_year_|career_`, unless it is in `ROLLING_RANKING_SELECT_FIELDS` or the 7 explicit keep fields.

### Result (1,114 columns)
| Class | Count | Meaning |
|---|---:|---|
| wide_runtime | 187 | stored in wide row, read by FORGE/rankings/trends |
| pruned_runtime | 404 | always NULL in wide row; read via sidecar (trends page, FORGE hydrate) |
| wide_diagonly | 18 | stored wide, only trendsDebug/scripts |
| pruned_diagonly | 13 | sidecar only, only trendsDebug/scripts |
| **wide_unread** | **176** | stored in every wide row, no reader at all |
| **pruned_unread** | **316** | emitted into every sidecar payload, no reader at all |

**Runtime-read: 591 / 1,114 (53%). Unread anywhere: 492 (44%). Diag-only: 31.** Of the 381 columns physically stored in the wide row, 176 (46%) are never read.

Unread families (from `classify.py`, grouped window × kind × storage):
- Wide, unread (176): `*_total_last5/10/20` for additive metrics not in rankings (goals/assists/shots/hits/blocks/ixg/iscf/ihdcf/cf/ca/ff/fa/oz/dz/nz_starts/oi_sf/oi_sa/penalties_*/primary/secondary_assists: 35+35+32), ratio component columns `*_{numerator,denominator}_{last5,10,20,season}` for pdo, on_ice_sh_pct, oz_start_pct, primary_points_pct, pp_share_pct, cf_pct, ff_pct, expected_sh_pct, shooting_pct (14+14+14+26), all of `penalties_drawn_per_60_*`, `secondary_assists_per_60_*`, `gp_pct_total_last5/10/20`, `participation_*_last5/10/20_team_games`.
- Sidecar, unread (316): every `*_total_last3` and `*_total_all` (52+48), ratio/weighted components at `_3ya`/`_career` (44+48), `_last3`/`_all` other (18+18), `oi_xgf/oi_xga_avg_*` (all windows), `gp_pct_avg_*`, `career_/three_year_participation_*`.
- Per strength: columns are not strength-specific; every row carries the full set. `pp_share_pct_*` is nulled for non-all/pp rows (`fetchRollingPlayerAverages.ts:4011-4017`), so for ev/5v5/pk rows those columns are pure null.

Caveat: dynamic name construction elsewhere could exist that my literal+builder pass missed; `entityMetricRankingWriter`/`update-entity-metric-rankings` read through `skaterWindowAggregation.ts` whose names (`:265, :293-300, :452-475`) are within the rank-field set. Treat 492 as an upper bound; a reader-side runtime log of selected columns would confirm.

---

## 2. Write amplification and storage

### Rows per run
- Scheduled path: `vercel.json:31` → `run-rolling-forge-pipeline?mode=daily_incremental`, which passes a one-day rolling window (`run-rolling-forge-pipeline.ts:191-205`, `rollingStartDate = completedDate`). The writer emits rows only for games in the write window (`fetchRollingPlayerAverages.ts:3981-3983`).
- Rows/day = 396 players × 5 strengths × 1 game = **1,980 rows** (matches 10-21 note "75 players / 375 rows", `forge-pipeline-repair-2026-10-21.md:44`).
- A bare route call uses a 14-day lookback (`update-rolling-player-averages.ts:181, 293-301`): ~6.2 games/player (82 games / 186 days × 14) → 396 × 5 × 6.2 ≈ 12,300 rows, ~84% rewrites of unchanged rows. Only manual/repair runs take this path.

### Bytes per row (est.)
Types (baseline `supabase/migrations/20260716112908_production_schema_baseline.sql:23799-24916`): 902 double, 176 integer, 26 numeric, 6 smallint/bigint, 4 text/date/timestamptz.
- Wide heap tuple: 381 storable columns, ~7.5 B avg ≈ 2.86 KB + null bitmap 1,114/8 = 140 B + header 24 B ≈ **3.0 KB/row** (2 rows per 8 KB page; no HOT room at fillfactor 100).
- 7 btree indexes (pkey + 6, see §5) ≈ 7 × ~40 B ≈ 0.28 KB/row.
- 6.6 GB / ~3.3 KB ≈ **~2.0 M rows** (est.) ≈ 8–9 seasons at the per-season rate below. Unverified — SQL Q3.
- If all 1,114 were non-null the row would be ≈ 902×8 + 176×4 + 26×~10 ≈ 8.2 KB > 8,160 B page limit — the pruning-to-NULL also keeps rows legal. Any column-pruning redesign must keep this in mind.
- Sidecar JSONB: 733 prunable keys per row, **null values included** (`isSupportPayloadScalar(null)` is true, `:436-445, :486-492`). Raw ≈ 733 × (21.3 B key + 8 B JEntries + ~8 B value) ≈ 27 KB/row before TOAST pglz (est. 8–14 KB compressed). The "8 MB table" figure is almost certainly the main heap only; the payload lives in TOAST. Unverified — SQL Q1 reports `pg_total_relation_size` and TOAST.

### Per season (est.)
Rows/season ≈ 1,312 games × 2 teams × 18 skaters × 5 strengths = 236,160.
- Wide: 236 k × 3.3 KB ≈ **0.78 GB/season**.
- Sidecar: 236 k × 8–14 KB ≈ **1.9–3.3 GB/season** if every row gets a payload — potentially larger than the wide table.
- Upload volume per daily run: wide JSON with 1,114 keys ≈ 45 KB/row + sidecar ≈ 28 KB/row → 1,980 × 73 KB ≈ **145 MB of PostgREST request body per day** (function CPU/duration for serialisation, PostgREST `json_populate_recordset` over 1,114 columns).

### How much of the 6.6 GB no reader needs
- Unread wide columns: 176 × ~8 B ≈ 1.4 KB of ~3.0 KB → **~45% of heap bytes** (≈ 2.5–3 GB of 6.6 GB, est.; lower if many are null on split strengths).
- Window families readers use: FORGE = last5 + all + season + 3ya (latest row only); rankings = last5/last10/last20 + season (per snapshot date); trends page = all of last3/5/10/20/all/season/3ya/career (via legacy `_avg_` names, mostly sidecar). So no window family can be dropped wholesale; **unused metric × kind combinations** can.
- History rows: FORGE needs only the latest row per player/strength (§5). Rankings and the trends chart read historical dates, so old rows remain needed (per strength: rankings use all 5; FORGE uses ev/pp/all).
- Pre-pruning rows: rows written before the pruning change may still carry values in the 733 pruned columns (≈ 733 × 8 B ≈ 5.9 KB more per row, would exceed half-page). Unknown — SQL Q4 measures null fractions by season.

---

## 3. Cost model per player (daily run) and incremental option

### Read set per player (`processPlayer`, `fetchRollingPlayerAverages.ts:3655-3760`)
| Source | Rows (est.) | Window | Ref |
|---|---|---|---|
| `wgo_skater_stats` (24 cols) | full career, ~400 avg (1 page/1000) | **career** (`startDate` deleted, `:3031-3035`) | `:2944-2989` |
| NST counts / rates / counts_oi × 5 strengths = 15 queries | ~400 each → ~6,000 | career (`startDate..endDate` taken from WGO first/last, `:3677-3678, 3726-3728`) | `:3143-3240` |
| `powerPlayCombinations` | ~400 rows, chunks of 100 game ids (~4 queries) | career, per-player cache | `:3255-3295` |
| `lineCombinations` | 2 rows/game, chunks of 100 | career, cached by game across players | `:3297-3330` |
| `games` + team ledger | once per run | — | `:2925` |

≈ 6,800 source rows and ~21 round trips per player to write **5 rows** (≈ 1,360 : 1). At ~3 players/s (post-GIN drop) × 396 = ~132 s per run; previously ~1/s = 396 s (prior evidence: `forge-pipeline-repair-2026-10-21.md:7,44`).

Prior evidence (cite, not redone): full history is read because rows carry `_avg_3ya`, `_avg_career`, career GP% (`a05-rolling-runtime-budget-2026-10-19.md:9-11`); NST two strengths at a time (`:109`, note `:51`); ascending-id order starves the highest ids under the deadline (note `:7, :41`).

### Can the accumulators be materialized? Yes, exactly, with a checkpoint
All accumulators are mergeable:
- Simple metrics: `sumAll/countAll` + last-20 value windows (`updateAccumulator`, `:2606-2628`).
- Ratio/weighted: totals + per-window entry queues of normalized components (`rollingMetricAggregation.ts:245-289`).
- Historical: per-season buckets (`updateHistoricalRatioAccumulator`, `:337-358`; `rollingHistoricalAverages.ts:110-122` 3ya = season keys `current-2..current`; GP% buckets `:201-225`).

A per-(player, strength) state row holding {per-season buckets per metric, last-20 window queues incl. null slots, GP% buckets, aligned-count builder state, last processed game_id/date, source fingerprint} would let a daily run read only games after the checkpoint (1–2 WGO rows + 1–2 NST rows per strength). Output identical when exact.

Invariants that make it hard:
1. **Appearance-mode slots**: ratio/weighted windows push a null entry for an appearance without components (`rollingMetricAggregation.ts:271-280`); appearance = TOI > 0 with WGO TOI fallback (`fetchRollingPlayerAverages.ts:2655-2665`, `getToiContext :1830-1843`). The checkpoint must keep the exact last-20 entry queue (incl. nulls), not just sums.
2. **Late or corrected source rows**: today a later full re-read silently heals history; a checkpoint needs invalidation when any WGO/NST/PP/line row for a date ≤ checkpoint changes (NST tables expose `date_scraped`, no updated_at in the select — needs a change signal or a periodic full rebuild). Current design already never rewrites the stored row for game D when NST for D lands later (one-day window); accumulators heal on the next game, row D does not.
3. **3ya boundary** depends on the *current game's* season key; buckets by season handle it, but the season key normalisation (`getSeasonWindowKey`, `rollingHistoricalAverages.ts:12-15`) must be shared.
4. **Reconstructed vs observed support**: per-60 components fall back to `rate × TOI / 3600` when raw counts are missing (`rollingPlayerMetricMath.ts:25-30`); TOI trust tiers/fallback seeds are per-game derivations — fine for a checkpoint as long as source rows don't change, but they are exactly what changes when NST backfills.
5. **Aligned count support builder is stateful over every game** (`:3906-3911, :3978-3980`) — its state must be serialisable.
6. **Team-games ledger** (GP%) depends on all team games, not the player's.

Cheaper intermediate (no state table): read NST only for the current + 2 prior seasons when the writer only needs `_3ya` + windows, and carry `_career`/`_all` from the previous row's stored component totals. Not exact for every family today because several career families are stored only as averages (e.g. `*_avg_career`) without components — would need component columns or the state table.

---

## 4. Correctness / accuracy risks in the writer

1. **Appearance-mode zeros (hits/blocks root cause — cite `forge-hits-blocks-zeros-2026-10-19.md:20-24`)**. Mechanism: `didPlayerCountAsAppearance` true via WGO TOI; component null when NST row missing; slot taken (`rollingMetricAggregation.ts:206-243, 257-280`); rate computed from the remaining 0–2 NST games → exact 0 if they had no events. Affected metrics = every `ratio_performance` / `weighted_rate_performance` metric whose numerator or denominator is NST-only for that strength (families from `fetchRollingPlayerAverages.ts:1166-1660`):
   - Weighted rates (11): `sog_per_60`, `ixg_per_60`, `shot_attempts_per_60`, `goals_per_60`, `assists_per_60`, `primary_assists_per_60`, `secondary_assists_per_60`, `penalties_drawn_per_60`, `penalties_taken_per_60`, `hits_per_60`, `blocks_per_60`. In split strengths (ev/5v5/pk) all are NST-only (`rollingPlayerSourceSelection.ts:56-143`: shots/hits/blocks/goals fall back to WGO only for `all`; goals also for `pp`). In `all`, `ixg`, `shot_attempts`, penalties stay NST-only.
   - Ratios (11): `shooting_pct`, `primary_points_pct`, `expected_sh_pct`, `ipp`, `oz_start_pct`, `pp_share_pct`, `on_ice_sh_pct`, `on_ice_sv_pct`, `pdo`, `cf_pct`, `ff_pct` (on-ice/zone families NST `counts_oi`-only in every strength).
   - FORGE consumes `sog/hits/blocks_per_60_last5` (`skater-queries.ts:91-122`).
2. **Silent 0 instead of null — `expected_sh_pct` in `all` strength**: numerator `resolveIxgValue(countsIxg, wgoIxg = getWgoNumber(game,"ixg"))` (`:1362-1369`) but the WGO select has no `ixg` column (`:2954-2955`) → numerator null; denominator = WGO shots → `normalizeComponent(null) = 0` (`rollingMetricAggregation.ts:104-108, 222-238`) → every all-strength game without an NST row adds shots with 0 xG, biasing `expected_sh_pct` down in windows and in season/3ya/career (`updateHistoricalRatioAccumulator :343-354` uses the same normalisation). Generic rule: any ratio whose numerator source can be null while its denominator is present becomes 0.
3. **`noPrimaryDenominatorBehavior: "zero"`** for `shooting_pct`, `primary_points_pct`, `ipp` (`:1313, :1344, :1377`): a window with 0 shots / 0 points / 0 on-ice GF yields 0, not null. `primary_points_pct` returns `{num:0, den:0}` when counts exist but are null (`:1346-1351`).
4. **Season boundary**: last-N windows are chronological across seasons and the off-season (contract `rollingWindowContract.ts:52-85`); early-season last5 mixes prior-season games (zeros "come and go" — note `:27-30`). Additive windows skip nulls entirely (`updateAccumulator :2610-2612`), so split-strength `hits_total_last5` can reach back into last season when NST coverage is thin (league: 3,311 of 4,499 games NST-missing, note `:93`).
5. **`season` option truncation**: `buildPlayerHistoryReadOptions` deletes only `startDate` (`:3031-3035`); `fetchWgoRowsForPlayer` still applies `.eq("season_id", options.season)` (`:2963-2964`), and NST reads are bounded by WGO first/last date (`:3677-3678`). A `season=` run (the "overnight" profile, `rollingPlayerOperationalPolicy.ts:93-95`; examples at `update-rolling-player-averages.ts:55, 61-63`) recomputes `_all`, `_3ya`, `_career`, career GP% and the first last-N windows of the season **from that season only** and overwrites the stored rows. Needs a fixture test to confirm, but the code path is direct.
6. **3ya** includes the current partial season plus two prior season keys regardless of whether the player played them (`rollingHistoricalAverages.ts:114, 210`) — consistent but means 3ya for a returning player spans up to 3 calendar seasons with gaps.
7. **Stale stored row for game D**: one-day window + late NST arrival → row D keeps the NST-missing values until the player's next game (§3 invariant 2). FORGE uses that latest row.
8. `updated_at` is insert-time only (default `now()`, baseline `:24090` region; prior evidence) yet it is in `idx_rpgm_latest_snapshot_lookup` and selected by rankings/playerMatrix as a freshness signal.
9. F7 (cite): SOG support emitted as scalar rates, numerator/TOI pair lost (master-tasklist F7) — not redone.

---

## 5. DB side

### Indexes (baseline `20260716112908_production_schema_baseline.sql`)
`rolling_player_game_metrics`:
- pkey `(player_id, game_date, strength_state)` `:32455`
- `idx_rolling_player_game_metrics_contextual_lookup (season, strength_state, game_date DESC, team_id, player_id)` `:35516`
- `idx_rolling_player_game_metrics_contextual_role (season, strength_state, line_combo_group, line_combo_slot, pp_unit, game_date DESC)` `:35523`
- `idx_rpgm_latest_snapshot_lookup (season, strength_state, game_date DESC, player_id, updated_at DESC NULLS LAST)` `:35558`
- `idx_rpgm_player_date (player_id, game_date DESC)` `:35565` — **redundant with pkey prefix** (btree scans backwards).
- `idx_rpgm_season_team_date (season, team_id, game_date)` `:35572`
- `idx_rpgm_strength_date (strength_state, game_date)` `:35579`
- `contextual_lookup` and `latest_snapshot_lookup` share the `(season, strength_state, game_date DESC)` prefix — one is likely redundant.
- 3 FKs (games, players ON DELETE CASCADE, teams) `:39187-39203`.

Sidecar: pkey `(player_id, game_date, strength_state)` `:32463`, `idx_..._snapshot (season, strength_state, game_date DESC, team_id, player_id)` `:35537`; GIN `:35530` dropped on prod 10-21 (`supabase/migrations/20261021145154_drop_rolling_support_payload_gin.sql`).

No `autovacuum_*`/`fillfactor` reloptions anywhere in migrations → "never autovacuumed" is the default thresholds, not a disabled option. Arithmetic: default `autovacuum_vacuum_scale_factor 0.2` × ~2.0 M rows = ~400 k dead tuples needed; daily upserts of 1,980 rows → ~200 days. `autovacuum_analyze_scale_factor 0.1` → ~200 k changed rows → ~100 days. So stats lag the newest dates for months — exactly the dates every reader asks for (histogram upper bound older than the predicate → near-1-row estimates).

### Reader queries at risk
1. **FORGE `fetchRollingRows`** (`skater-queries.ts:179-318`): `player_id IN (~20 ids) AND strength_state = ? AND game_date > cutoff-365d AND game_date < cutoff ORDER BY game_date DESC, player_id, game_id DESC`, pages of 500 with `count: "exact"` on **every page**, then the same on the sidecar with **the whole `support_payload`** (`:269-274`). The caller keeps only the latest row per player (`skater-stage.ts:1469-1498, pickLatestByPlayer`; `evRows/ppRows` have no other use). Per team-game: 3 strengths × ~20 skaters × ~82 games ≈ **4,900 wide rows + up to 4,900 sidecar payloads (~27 KB raw each ≈ 130 MB)** to use 60 rows → ~80× read amplification (est.; sidecar part depends on how many historical rows have payloads, Q3). Plan risks: stale stats could pick `idx_rpgm_strength_date` (scan all players for a year) instead of pkey with IN-list; the 5,000-row cap (`:217`) fails the read for teams with long-tenured rosters + playoffs.
2. Rankings `rankingQueries.ts:240-246` (`season, strength, game_date <= cutoff ORDER BY game_date DESC LIMIT 1`) and `:352-358` (`season, strength, game_date = d`) — well served by `contextual_lookup`/`latest_snapshot_lookup`; low risk.
3. Writer's own upserts: 7 indexes + 3 FK checks per wide row; rows ~3 KB so updates are almost never HOT.

### Draft read-only SQL (NOT run — for Chef to request approval)
```sql
-- Q1 table health + true sizes (heap, TOAST, indexes) for both tables
SELECT s.relname, s.n_live_tup, s.n_dead_tup, s.n_tup_upd, s.n_tup_hot_upd,
       s.last_vacuum, s.last_autovacuum, s.last_analyze, s.last_autoanalyze,
       s.vacuum_count, s.autovacuum_count, s.analyze_count, s.autoanalyze_count,
       pg_size_pretty(pg_relation_size(c.oid))            AS heap,
       pg_size_pretty(coalesce(pg_total_relation_size(nullif(c.reltoastrelid,0)),0)) AS toast,
       pg_size_pretty(pg_indexes_size(c.oid))             AS indexes,
       pg_size_pretty(pg_total_relation_size(c.oid))      AS total,
       c.reloptions
FROM pg_stat_user_tables s JOIN pg_class c ON c.oid = s.relid
WHERE s.relname IN ('rolling_player_game_metrics','rolling_player_metric_support_payloads');

-- Q2 per-index size and use since stats reset
SELECT i.relname AS table, i.indexrelname, i.idx_scan, i.idx_tup_read, i.last_idx_scan,
       pg_size_pretty(pg_relation_size(i.indexrelid)) AS size
FROM pg_stat_user_indexes i
WHERE i.relname IN ('rolling_player_game_metrics','rolling_player_metric_support_payloads')
ORDER BY pg_relation_size(i.indexrelid) DESC;

-- Q3 row distribution: wide vs sidecar by season × strength, with payload size
SELECT 'wide' AS t, season, strength_state, count(*) AS rows, min(game_date), max(game_date), NULL::numeric AS avg_payload_bytes
FROM rolling_player_game_metrics GROUP BY season, strength_state
UNION ALL
SELECT 'sidecar', season, strength_state, count(*), min(game_date), max(game_date), round(avg(pg_column_size(support_payload)))
FROM rolling_player_metric_support_payloads GROUP BY season, strength_state
ORDER BY 2, 3, 1;

-- Q4 null fractions by season on a 0.5% page sample (pruned vs kept vs unread families)
SELECT season, count(*) AS sampled,
  avg((goals_avg_career      IS NULL)::int) AS pruned_goals_avg_career,
  avg((hits_per_60_avg_last5 IS NULL)::int) AS pruned_hits_avg_last5,
  avg((ixg_per_60_total_all  IS NULL)::int) AS pruned_unread_ixg_total_all,
  avg((hits_per_60_last5     IS NULL)::int) AS kept_hits_per_60_last5,
  avg((goals_total_last10    IS NULL)::int) AS wide_unread_goals_total_last10,
  avg((pdo_goals_for_last5   IS NULL)::int) AS wide_unread_pdo_gf_last5,
  avg((expected_sh_pct_last5 = 0)::int)     AS xsh_zero_last5,
  avg(pg_column_size(t.*))                  AS avg_row_bytes
FROM rolling_player_game_metrics t TABLESAMPLE SYSTEM (0.5)
GROUP BY season ORDER BY season;

-- Q5 plan (no ANALYZE, does not execute) for the FORGE read shape; paste ~20 real ids
EXPLAIN (COSTS, VERBOSE)
SELECT player_id, game_id, season, strength_state, game_date
FROM rolling_player_game_metrics
WHERE player_id = ANY ('{<20 ids>}'::bigint[]) AND strength_state = 'ev'
  AND game_date < DATE '2026-10-21' AND game_date > DATE '2025-10-21'
ORDER BY game_date DESC, player_id ASC, game_id DESC
LIMIT 500;
```
Q4 reads ~0.5% of heap pages (~33 MB); Q3 is a full scan of both tables (~6.6 GB + sidecar) — run off-peak or replace with `pg_class.reltuples` if cost is a concern.

---

## 6. Proposals

| # | Change | Expected impact | Effort | Risk | Files | Lane | Verification |
|---|---|---|---|---|---|---|---|
| Q-1 | `ANALYZE` both tables now; then per-table reloptions `autovacuum_analyze_scale_factor=0.002, autovacuum_vacuum_scale_factor=0.01` (or thresholds ~5 k) | fresh histograms for newest dates; dead tuples cleared; prevents plan flips in fetchRollingRows | S (SQL + migration record) | Low; persistent config → ask-first | new migration | Claude (DB approval) | Q1/Q5 before/after |
| Q-2 | Drop `idx_rpgm_player_date` (pkey prefix duplicate); drop one of `contextual_lookup` / `latest_snapshot_lookup` and `idx_rpgm_strength_date` **if** Q2 shows idx_scan≈0 | fewer index writes per upsert (7→4–5), several hundred MB (est.) | S | Low-med (verify idx_scan first) | migration | Claude | Q2; FORGE/rankings fixture tests |
| Q-3 | FORGE reader: fetch latest row per player only (RPC `DISTINCT ON (player_id)` or `order game_date desc limit 1` per id), and select only `support_payload->historicalCompatibility->'<needed keys>'` + `alignedCountSupport`; drop per-page `count: "exact"` | ~80× fewer rows; sidecar transfer from MBs to KBs per team-game; removes 5,000-row cap failures | M | Med (strict coverage proofs in `skater-queries.ts:216-249` must be re-expressed) | `skater-queries.ts`, `skater-stage.ts`, tests `skater-queries.test.ts` | Claude | existing tests + row-identical latest-row comparison on fixture |
| Q-4 | Stop writing null keys and the 316 unread keys into the sidecar payload (filter in `splitRollingUpsertRowForDurableStorage`, `:486-492`) | sidecar payload −43% keys + all null keys; smaller TOAST, faster upserts under 8 s | S | Low (readers skip null/absent identically: `skater-queries.ts:301-302`, `mergeRollingSupportPayloadFields`) | `fetchRollingPlayerAverages.ts`, its test | Claude | fixture: reader output identical with/without null keys |
| Q-5 | Upsert only non-pruned keys to the wide table (omit, not null, the 733 pruned keys) | request body −~65% (~45→~15 KB/row); PostgREST parse cost down | S | Low-med: omitted columns are not overwritten on conflict — pre-pruning rows keep stale values (check Q4 first) | writer | Claude | Q4 + upsert fixture |
| Q-6 | Service-role `statement_timeout` for the writer path (e.g. 30 s via PostgREST impersonated-role settings) | fewer split/retry cascades (`:736`) | S | Low; config → ask-first | DB config | Claude (approval) | prod log of split events |
| S-1 | Column pruning: drop the 176 wide-unread columns (and later the 733 always-NULL pruned columns once readers use only the sidecar) | ~45% of wide heap (≈2.5–3 GB est.) after a rewrite; generated types shrink | L | Med-high: needs VACUUM FULL/pg_repack (locks) or new-table swap; trendsDebug/scripts break | migration, generated types, writer, scripts | Claude | row-identical recompute on 20 players × 5 strengths; Playwright rankings spec |
| S-2 | Table split by strength or move rankings-only window columns (last10/last20) into a narrow table | smaller rows for FORGE (ev/pp/all) | L | High (many readers) | many | Claude | as S-1 |
| S-3 | Materialized accumulator checkpoint per (player, strength) (§3) | daily reads ≈ 6,800 → ~20 rows/player; run time dominated by upserts | L | High: invalidation on late NST/WGO corrections; keep weekly full rebuild | writer + new table | Claude | daily-vs-full row-identical diff on a sample (all 1,114 fields) |
| S-4 | Batched NST prefetch across players (one query per table per chunk of player ids with `player_id IN (…)`, date ≥ 3 seasons ago) | 15 queries/player → 15 per ~50 players | M | Med (8 s timeout per statement, memory) | writer fetchers `:3143-3240` | Claude (Supabase NST tables — reading, not NST HTTP; confirm lane) | same rows per player in fixture |
| C-1 | Correctness: `expected_sh_pct` numerator-null → skip entry (or add `ixg` to WGO select if such column exists) | removes downward bias | S | Low | writer | Claude | unit test: game with WGO shots, no NST ixg → no contribution |
| C-2 | Correctness: `season` option must not truncate history (drop `season` in `buildPlayerHistoryReadOptions`, use it only for write window) | correct `_all/_3ya/_career` on season runs | S | Low | writer + test | Claude | fixture: season run vs unscoped run → identical rows |
| C-3 | Thin-window guard for appearance-mode rates (null when valid observations < k, or carry valid-observation count) — FORGE already mitigated per note | fewer exact zeros | M | Med (changes outputs) | writer/aggregation | Claude | fixture tests per affected metric |

Order of value: Q-1, Q-3, Q-4, C-2, C-1, Q-2, then S-3/S-4.

## Could not verify
- Actual row counts, TOAST size of the sidecar, dead tuples, index usage, null fractions of pre-pruning rows — all need Q1–Q4.
- Whether the "8 MB" sidecar figure excludes TOAST (strongly suspected).
- Runtime behaviour of `getCompatibilityFieldOrder` (assumed to return both canonical and legacy names; did not execute code).
- `season`-truncation and `expected_sh_pct` zero are code-path readings without a run.
- Any dynamic column-name builder I did not read (column-utilization is an upper bound for "unread").
