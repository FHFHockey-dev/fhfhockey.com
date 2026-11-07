# PROV-GUARD production read plan (not run)

**Purpose.** Show whether released FORGE runs since the pundit-table removal went live (master `538100d41`, 2026-10-25 22:16 EDT = **2026-10-26 02:16:00Z**) carry the external-input exclusion proof that the PROV-GUARD readers now require. If they don't, the released guard will withhold every FORGE skater value, which is correct but means no FORGE output on RSO, Start Chart legacy, `/forge/players` or `/projections/players`.

**Status.** Drafted only. Nothing was run. The orchestrator asks TJ before any query runs.

**What the guard accepts.** One or more `player_forecast_source_observations` rows with `provider='forge'`, `dataset_key='forge-run-inputs-v1'` and `entity_key = run_id`. Every such row must have:
- `payload->>'version' = 'forge-inputs-v1'`
- `payload->>'runId' = entity_key`
- `payload->'inputProvenance'->>'external_fantasy_input_contract' = 'excluded_from_native_inputs_v1'`
- a valid `payload->'inputProvenance'->'capturedReads'` receipt (`forge-captured-reads-v1`, a 64-hex hash, `readCount >= 1`, `firstReceivedAt <= lastReceivedAt <= available_at`)

Runs written without capture have no snapshot, so they are unproven. A run saves a snapshot only when both `STARTER_BOARD_CAPTURE_ENABLED` and `STARTER_BOARD_COMPUTE_ENABLED` resolve true (`web/lib/projections/run-forge-projections.ts:473`; the legacy `START_CHART_GAME_REVISIONS` flag is the fallback). Otherwise it takes the resumable uncaptured path. Static code can't show which flags production has, which is why Q1 matters.

## Bounds (all three queries)

- Read-only `SELECT` only. No writes, RPCs, functions, `payload` column or `reads` arrays.
- Run them one at a time (concurrency 1) through the Supabase SQL runner TJ approves, for example the Supabase MCP `execute_sql` on the production project.
- At most 200 rows each, so at most 600 rows in total.
- Stop after Q1 if it answers the question (see "Reading the result"). Q2 and Q3 only narrow down the reason.
- No Vercel, app-route or cron invocation.

## Q1: proof status of each released run since the cutoff

Tables: `forge_runs` left-joined to `player_forecast_source_observations`. The columns are small JSON paths only.

```sql
select r.run_id, r.as_of_date, r.created_at, r.git_sha,
       r.metrics->>'horizon_games' as horizon_games,
       o.available_at as snapshot_available_at,
       o.payload->>'version' as snapshot_version,
       o.payload->>'runId' as snapshot_run_id,
       o.payload->>'replayClassification' as replay_classification,
       o.payload->>'codeVersion' as code_version,
       o.payload->'inputProvenance'->>'external_fantasy_input_contract' as external_fantasy_input_contract,
       o.payload->'inputProvenance'->'capturedReads' as captured_reads
from public.forge_runs r
left join public.player_forecast_source_observations o
  on o.provider = 'forge' and o.dataset_key = 'forge-run-inputs-v1' and o.entity_key = r.run_id::text
where r.status = 'succeeded'
  and r.created_at >= '2026-10-26T02:16:00Z'
  and r.git_sha is not null and r.git_sha not like 'local:%'
order by r.created_at desc
limit 200;
```

It uses the index `player_forecast_source_observations_lookup_idx (provider, dataset_key, entity_key, available_at desc)`.

## Q2: are snapshots being captured at all since the cutoff?

Use this only if Q1 shows released runs with no snapshot row. It tells capture turned off apart from a join problem. Table: `player_forecast_source_observations`, same small columns.

```sql
select entity_key, available_at,
       payload->>'replayClassification' as replay_classification,
       payload->>'codeVersion' as code_version,
       payload->'inputProvenance'->>'external_fantasy_input_contract' as external_fantasy_input_contract,
       payload->'inputProvenance'->'capturedReads'->>'readCount' as read_count
from public.player_forecast_source_observations
where provider = 'forge' and dataset_key = 'forge-run-inputs-v1'
  and available_at >= '2026-10-26T02:16:00Z'
order by available_at desc
limit 200;
```

## Q3: do published game revisions since the cutoff carry the claim?

This is the detailed revision path, which `consumerRevisionAdmission` already enforces. Table: `forge_game_revisions`, with small JSON paths only.

```sql
select id, run_id, game_id, slate_date, published_at,
       payload->>'codeVersion' as code_version,
       payload->'inputProvenance'->>'external_fantasy_input_contract' as external_fantasy_input_contract,
       payload->'inputProvenance'->'capturedReads'->>'readCount' as read_count
from public.forge_game_revisions
where published_at >= '2026-10-26T02:16:00Z'
order by published_at desc
limit 200;
```

## Reading the result

| Q1 outcome | Meaning | Release consequence of PROV-GUARD |
|---|---|---|
| Every released run has a snapshot with the contract and a valid receipt | The proof is live | The guard serves current runs and withholds only older history |
| Runs have snapshots, but `external_fantasy_input_contract` is null | Captured reads contained a fantasy or unaudited source, or the runs predate `7007a0527` (check `code_version`) | The guard withholds them, which is correct. Investigate which read broke the allowlist (`FORGE_AUDITED_INPUT_SOURCES`) |
| Released runs with no snapshot row (and Q2 is empty) | Starter Board capture is off in production, so runs are uncaptured | The guard withholds **all** FORGE skater output. TJ decides whether to enable capture before releasing PROV-GUARD |
| No released runs since the cutoff | Nothing to judge yet | Re-check after the next scheduled FORGE run |
