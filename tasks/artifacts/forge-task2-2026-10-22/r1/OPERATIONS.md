# Zero-value investigation and recovery — proposal only

No production read, backfill, recompute or forecast rerun is authorized or executed by this note.

## What the local evidence establishes

The reviewed P2 is a **development-candidate calculator bug**: a missing current-season count combined with known exposure was treated like an observed zero count; the reverse partial pair also fabricated the missing exposure. In the independent examples the resulting projected rate was about 2 events/60, not zero. This finding does not explain every zero projection.

Local release branch `master` at `457435eb3010c5b3dd92d2e1a46d9c75d851780a` has no `computeSkaterPhysicalEventRates` function or the defective season split. Its stage instead reads EV last-5/all physical rates, with 1 HIT/60 and 0.5 BLK/60 fallback constants; explicit numeric zero rates remain zero. Thus this exact P2 is absent from the locally inspected release code. No current production alias, deployment SHA or actual run code version was read. Production scope remains unknown; do not claim that the candidate bug affected production or that all deployed zeros are legitimate.

## Decision tree

1. **The count exists in the authoritative source or matching durable support, but the reader loses it.** Fix selection/hydration/identity handling and verify it offline. If the stored aggregate/support is already correct, no source backfill is needed. After candidate qualification and separately approved release, issue a new forward forecast using corrected inputs. If the writer omitted the value despite complete raw source, approve only the affected rolling-aggregate recompute; re-fetching already present raw data is unnecessary.
2. **The raw count or its matching exposure is genuinely missing.** Keep it unknown. R1 uses the complete cumulative-history pair as unsplit history at the existing half weight, with the existing prior/rescale policy; it does not infer a season count from minutes or vice versa. If a bounded authoritative source can supply the missing observation, obtain separate backfill approval for exact players, games/dates, strengths and fields. Then verify source completeness, recompute only dependent rolling rows, and issue new forward forecasts. If the source cannot supply it, retain the documented unknown/fallback state.
3. **The source confirms a zero with valid matching exposure.** Preserve zero; do not backfill merely to raise a projection. R1 keeps this observed pair distinct from missing support. Inspect rate shrinkage, projected TOI, participation, horizon and rounding if the displayed output is unexpectedly zero. A zero expectation or a rounded display is not itself proof of missing source data.
4. **Only one member of the season pair is present.** Apply the R1 numerator/exposure correction before any rerun. Both members must be finite/nonnegative to activate the season split. Otherwise neither member enters the split; the unsplit cumulative baseline remains available. A positive cumulative numerator with positive cumulative exposure remains a usable pair.

## Identify a potentially affected run and head locally

- Start with an immutable retained input snapshot and output rows. Bind `runId`, game/player, `horizon_games`, snapshot `codeVersion`, `modelMode`, `inputCutoff`, `capturedAt`, snapshot hash and any deployment/code-file hashes. `forge_runs.git_sha` may help, but an absent SHA or mutable date-level run row is not immutable issuance provenance.
- Inspect that exact code version for the old independent season normalization. Do not infer affectedness from a date or a zero output alone.
- Resolve the exact rolling event identity and matched sidecar used by the snapshot. Check **HIT** and **BLK** independently: current-season identity, usable cumulative count/exposure, and a partial current-season numerator/exposure pair trigger this defect. Examine both count-missing/exposure-present and count-present/exposure-missing cases. If counts are present only in source data but absent in the retained hydrated input, investigate the reader/writer separately.
- Reproduce old versus R1 calculations offline on those unchanged inputs. Record the HIT/BLK change and any derived FP change, plus retained recent-window values and league-total availability. Do not count all zeros as affected; other heads, absence of actual exposure, and display formatting have different causes.
- Existing 62-game a/b/a0/b0 captures lack all-strength physical inputs, so they cannot establish the prevalence or effect of this P2. No current-query c cohort has been obtained.

## Separately approved read-only investigation

Request one named run and game first, up to 20 player IDs, a fixed as-of cutoff, concurrency one, and at most four bounded SELECTs. Confirm the applicable indexes/query plan and stop on missing lineage, missing relations, timeout or conclusive evidence; do not broaden into a season scan. No RPC or cron/recompute endpoint is needed.

The first two proposed reads (not executed) are:

```sql
-- Bind a reviewed run_id and game_id; do not discover runs with an unbounded scan.
select run_id, as_of_date, git_sha, status, created_at, updated_at
from public.forge_runs
where run_id = :run_id
limit 1;

select run_id, game_id, player_id, as_of_date, horizon_games,
       proj_hits, proj_blocks, proj_toi_es_seconds, proj_toi_pp_seconds,
       created_at, updated_at
from public.forge_player_projections
where run_id = :run_id and game_id = :game_id and horizon_games = 1
  and player_id = any(:player_ids)
order by player_id
limit 20;
```

The third proposed read locates that run's immutable input observation, selecting metadata only initially: `player_forecast_source_observations` with `provider='forge'`, `dataset_key='forge-run-inputs-v1'`, `entity_kind='projection_run'`, `entity_key=:run_id`; select `id`, `payload_hash`, `observed_at`, `available_at`, and payload `codeVersion`, `modelMode`, `inputCutoff`, `capturedAt`, with limit 2 to detect ambiguous lineage. Prefer an existing local export of its captured reads. Loading a missing raw payload requires a separate agreed byte bound; do not silently fetch an arbitrarily large snapshot.

The fourth proposed read, only if still necessary, compares the at-most-20 exact historical event identities against `rolling_player_game_metrics` and matching `rolling_player_metric_support_payloads`: keys are player ID, game ID, game date, season and strength `all`; project only the two cumulative count/exposure pairs, two current-season pairs, relevant recent rates/exposure and those same `historicalCompatibility` JSON keys. Do not coalesce missing values to zero. Today's rows can diagnose the current storage state, but cannot prove what an earlier forecast knew without its retained inputs. A raw-source inspection/backfill, if indicated, needs its own scope after these results.

## Regeneration versus rewriting history

An approved repair should produce a **new forward issuance/revision** with a new decision time, pinned code/input lineage and the reviewed candidate. Preserve immutable original forecasts, served-ledger records, their original timestamps and settlements; do not overwrite them or make a retrospective reconstruction look like a forecast issued before the game. Historical correction studies belong in separately labeled offline reconstruction artifacts. An uncaptured mutable date-level `run_id` or a generic rerun route is not automatically a safe new-issuance mechanism; verify the selected publication path before approving execution.

Before any actual production rerun/backfill: establish the deployed SHA and affected runs, complete the frozen-cohort/model gates, and obtain explicit authority for exact project/environment/candidate, players, dates/games, batches, runtime, writes and downstream fan-out. Migration 88 is not required to fix this numerator/exposure bug and remains unapplied.
