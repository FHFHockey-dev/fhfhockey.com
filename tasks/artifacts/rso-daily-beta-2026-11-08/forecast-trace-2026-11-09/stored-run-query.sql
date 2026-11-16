BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
WITH candidates AS MATERIALIZED (
  SELECT run_id, as_of_date, created_at, updated_at, git_sha, status,
    metrics->'producer_identity' AS producer_identity,
    metrics->'resume'->>'invocations' AS invocations,
    metrics->'input_provenance'->>'rolling_player_history_contract' AS rolling_player_history_contract
  FROM public.forge_runs
  WHERE status = 'succeeded' AND git_sha IS NOT NULL AND git_sha NOT LIKE 'local:%'
    AND as_of_date >= '2026-11-02' AND as_of_date <= '2026-11-16'
    AND created_at <= '2026-11-09T20:39:22.393Z'
    AND (metrics->>'horizon_games' = '1' OR
      (metrics->>'horizon_games' IS NULL AND
        (metrics->'resume'->>'scope_key' IS NULL OR metrics->'resume'->>'scope_key' LIKE 'h1:%')))
  ORDER BY as_of_date DESC, created_at DESC, run_id
  LIMIT 501
)
SELECT c.*,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'entity_key', o.entity_key, 'available_at', o.available_at,
    'snapshot_version', o.payload->>'version', 'snapshot_run_id', o.payload->>'runId',
    'rolling_player_history_contract', o.payload->'inputProvenance'->>'rolling_player_history_contract',
    'external_fantasy_input_contract', o.payload->'inputProvenance'->>'external_fantasy_input_contract',
    'captured_reads', o.payload->'inputProvenance'->'capturedReads',
    'snapshot_code_version', o.payload->>'codeVersion'))
    FROM public.player_forecast_source_observations o
    WHERE o.provider = 'forge' AND o.dataset_key = 'forge-run-inputs-v1'
      AND o.entity_key = c.run_id::text), '[]'::jsonb) AS proof_snapshots
FROM candidates c
ORDER BY c.as_of_date DESC, c.created_at DESC, c.run_id;
COMMIT;
