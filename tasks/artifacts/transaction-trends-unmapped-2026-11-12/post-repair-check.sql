-- One read-only check of the three repaired keys. Run only in the coordinated
-- repair window, after commit or to reconcile an uncertain commit outcome.
-- Success: exactly three rows, every boolean true. No history/API reads.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '1s';
WITH targets(player_key, player_id, external_id, fhfh_player_id, nhl_player_id, source_updated_at) AS (
  VALUES
    ('453.p.30000', '30000', '511c1028-0302-4a98-b1e8-7abe418b7e13'::uuid, 8946, 8481754, timestamp '2025-08-27 14:48:56.572'),
    ('453.p.30024', '30024', '2886fafe-fba8-48b3-acf8-8ca124e52a92'::uuid, 10423, 8483493, timestamp '2025-08-27 14:48:56.572'),
    ('453.p.30111', '30111', '94628264-f0b2-452d-b5b7-177b1325098c'::uuid, 10251, 8482221, timestamp '2025-08-27 14:48:57.219')
), expected AS (
  SELECT targets.*, jsonb_build_object(
    'match_kind', 'exact_normalized', 'review_rule', 'dr011-yahoo-name-review-v1',
    'review_actor', 'user_approved:dr_011_bulk_review_90_50_v1',
    'source_table', 'public.yahoo_nhl_player_map', 'yahoo_game_id', 453,
    'schema_version', 1, 'last_name_score', 100, 'first_name_score', 100,
    'yahoo_player_id', player_id, 'yahoo_player_key', player_key,
    'nhl_candidate_count', 1, 'exact_normalized_name', true, 'yahoo_candidate_count', 1,
    'review_manifest_sha256', '1f34475fea9977c4f827a900e96fa9c031ac195f734811bab0a423ba3545e4f8'
  ) AS original_provenance FROM targets
), mapped AS MATERIALIZED (
  SELECT yahoo_player_id, nhl_player_id
  FROM public.yahoo_nhl_player_map_read
  WHERE yahoo_player_id IN ('453.p.30000', '453.p.30024', '453.p.30111')
  LIMIT 4
)
SELECT expected.player_key, expected.nhl_player_id,
  coalesce(player.player_id = expected.player_id AND player.game_id = 453
    AND player.season = 2024 AND player.last_updated = expected.source_updated_at, false) AS source_ok,
  coalesce(identity.provider = 'yahoo' AND identity.external_player_id = expected.player_key
    AND identity.fhfh_player_id = expected.fhfh_player_id
    AND identity.context_key = 'yahoo:game:453:season:2024' AND identity.season_id = 20242025
    AND identity.verification_status = 'verified' AND canonical.verification_status = 'verified'
    AND canonical.nhl_player_id = expected.nhl_player_id AND canonical.merged_into_id IS NULL, false) AS identity_ok,
  coalesce(identity.match_method = 'approved_exact_name_v1'
    AND identity.verified_at = timestamptz '2026-07-15 01:00:36.178199+00'
    AND identity.verified_by_system = 'user_approved:dr_011_bulk_review_90_50_v1'
    AND identity.source_provenance - 'season_metadata_repair' = expected.original_provenance
    AND (identity.source_provenance->'season_metadata_repair') - 'from_updated_at' = jsonb_build_object(
      'id', 'transaction-trends-season-metadata-20261112-three-keys-v1',
      'evidence_observed_at', '2026-11-12T17:55:21.674214Z', 'source', 'public.yahoo_game_keys',
      'game_key', '453', 'from_context', 'yahoo:game:453:season:unknown',
      'from_season_id', null, 'to_season_id', 20242025)
    AND (identity.source_provenance->'season_metadata_repair'->>'from_updated_at')::timestamptz = timestamptz '2026-07-15 01:00:36.178199+00'
    AND identity.updated_at > timestamptz '2026-07-15 01:00:36.178199+00', false) AS approval_and_repair_marker_ok,
  (SELECT count(*) = 1 AND bool_and(mapped.nhl_player_id = expected.nhl_player_id::text)
    FROM mapped WHERE mapped.yahoo_player_id = expected.player_key) AS reader_ok,
  (SELECT count(*) = 1 FROM (
    SELECT id FROM public.fhfh_player_external_identities
    WHERE provider = 'yahoo' AND external_player_id = expected.player_key LIMIT 2
  ) AS owners) AS unique_external_key
FROM expected
LEFT JOIN public.yahoo_players AS player ON player.player_key = expected.player_key
LEFT JOIN public.fhfh_player_external_identities AS identity ON identity.id = expected.external_id
LEFT JOIN public.fhfh_player_identities AS canonical ON canonical.id = expected.fhfh_player_id
ORDER BY expected.player_key;
COMMIT;
