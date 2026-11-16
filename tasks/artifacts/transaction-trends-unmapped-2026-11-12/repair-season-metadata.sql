-- Exact three-key repair, based on REPAIR-EVIDENCE.json (2026-11-12).
-- No identity creation, matching, status promotion, or ownership-history writes.
-- Even the default rollback executes writes: do not run against production
-- without approval. psql -v commit_repair=1 is the explicit commit switch.
\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '10s';

CREATE TEMPORARY TABLE trends_season_repair_targets (
  player_key text PRIMARY KEY,
  player_id text NOT NULL,
  external_id uuid NOT NULL,
  fhfh_player_id bigint NOT NULL,
  nhl_player_id bigint NOT NULL,
  player_name text NOT NULL,
  source_updated_at timestamp NOT NULL
) ON COMMIT DROP;
INSERT INTO trends_season_repair_targets VALUES
  ('453.p.30000', '30000', '511c1028-0302-4a98-b1e8-7abe418b7e13', 8946, 8481754, 'Nikita Nesterenko', '2025-08-27 14:48:56.572'),
  ('453.p.30024', '30024', '2886fafe-fba8-48b3-acf8-8ca124e52a92', 10423, 8483493, 'Frank Nazar', '2025-08-27 14:48:56.572'),
  ('453.p.30111', '30111', '94628264-f0b2-452d-b5b7-177b1325098c', 10251, 8482221, 'Devon Levi', '2025-08-27 14:48:57.219');

DO $repair$
DECLARE
  target record;
  source_row public.yahoo_players%ROWTYPE;
  identity_row public.fhfh_player_external_identities%ROWTYPE;
  canonical_row public.fhfh_player_identities%ROWTYPE;
  catalog_count integer;
  already_repaired integer := 0;
  changed integer;
  repair_id constant text := 'transaction-trends-season-metadata-20261112-three-keys-v1';
  review_hash constant text := '1f34475fea9977c4f827a900e96fa9c031ac195f734811bab0a423ba3545e4f8';
BEGIN
  -- Do not compete with a normalization run or other long/blocked client.
  IF EXISTS (
    SELECT 1 FROM pg_stat_activity
    WHERE pid <> pg_backend_pid() AND backend_type = 'client backend'
      AND state = 'active'
      AND (now() - query_start > interval '5 seconds'
        OR wait_event_type IN ('Lock', 'IO')
        OR query ILIKE '%persist_nhl_api_gamecenter_normalized%')
  ) THEN
    RAISE EXCEPTION 'Repair blocked by concurrent database work';
  END IF;

  PERFORM 1 FROM public.yahoo_game_keys
    WHERE game_id = 453 OR game_key = '453' FOR SHARE;
  SELECT count(*) INTO catalog_count FROM public.yahoo_game_keys
    WHERE game_id = 453 OR game_key = '453';
  IF catalog_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.yahoo_game_keys
    WHERE game_id = 453 AND game_key = '453' AND code = 'nhl' AND season = 2024
  ) THEN
    RAISE EXCEPTION 'Yahoo game/season catalogue changed';
  END IF;
  PERFORM 1 FROM public.seasons WHERE id = 20242025 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Canonical season missing'; END IF;

  FOR target IN SELECT * FROM trends_season_repair_targets ORDER BY player_key LOOP
    SELECT * INTO STRICT source_row FROM public.yahoo_players
      WHERE player_key = target.player_key FOR UPDATE;
    SELECT * INTO STRICT identity_row FROM public.fhfh_player_external_identities
      WHERE id = target.external_id FOR UPDATE;
    SELECT * INTO STRICT canonical_row FROM public.fhfh_player_identities
      WHERE id = target.fhfh_player_id FOR SHARE;

    IF source_row.player_id IS DISTINCT FROM target.player_id
      OR source_row.game_id IS DISTINCT FROM 453
      OR source_row.full_name IS DISTINCT FROM target.player_name
      OR source_row.last_updated IS DISTINCT FROM target.source_updated_at
      OR canonical_row.nhl_player_id IS DISTINCT FROM target.nhl_player_id
      OR canonical_row.verification_status IS DISTINCT FROM 'verified'
      OR canonical_row.merged_into_id IS NOT NULL
      OR identity_row.provider IS DISTINCT FROM 'yahoo'
      OR identity_row.external_player_id IS DISTINCT FROM target.player_key
      OR identity_row.fhfh_player_id IS DISTINCT FROM target.fhfh_player_id
      OR identity_row.verification_status IS DISTINCT FROM 'verified'
      OR identity_row.match_method IS DISTINCT FROM 'approved_exact_name_v1'
      OR identity_row.verified_at IS DISTINCT FROM timestamptz '2026-07-15 01:00:36.178199+00'
      OR identity_row.verified_by_system IS DISTINCT FROM 'user_approved:dr_011_bulk_review_90_50_v1'
      OR identity_row.source_provenance->>'review_manifest_sha256' IS DISTINCT FROM review_hash
    THEN
      RAISE EXCEPTION 'Captured identity/source changed: %', target.player_key;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.fhfh_player_external_identities
      WHERE provider = 'yahoo' AND external_player_id = target.player_key
        AND id <> target.external_id
    ) OR EXISTS (
      SELECT 1 FROM public.yahoo_players
      WHERE player_id = target.player_id AND season = 2024 AND player_key <> target.player_key
    ) THEN
      RAISE EXCEPTION 'Target season or identity conflict: %', target.player_key;
    END IF;

    IF source_row.season = 2024 AND identity_row.season_id = 20242025
      AND identity_row.context_key = 'yahoo:game:453:season:2024'
      AND identity_row.source_provenance->'season_metadata_repair'->>'id' = repair_id
    THEN
      already_repaired := already_repaired + 1;
    ELSIF source_row.season IS NOT NULL OR identity_row.season_id IS NOT NULL
      OR identity_row.context_key IS DISTINCT FROM 'yahoo:game:453:season:unknown'
      OR identity_row.updated_at IS DISTINCT FROM timestamptz '2026-07-15 01:00:36.178199+00'
      OR identity_row.source_provenance ? 'season_metadata_repair'
    THEN
      RAISE EXCEPTION 'Unexpected or partially repaired season state: %', target.player_key;
    END IF;
  END LOOP;

  IF already_repaired NOT IN (0, 3) THEN
    RAISE EXCEPTION 'Mixed repair state; reconcile before retrying';
  END IF;
  IF already_repaired = 0 THEN
    UPDATE public.yahoo_players AS player SET season = 2024
      FROM trends_season_repair_targets AS expected WHERE player.player_key = expected.player_key;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 3 THEN RAISE EXCEPTION 'Unexpected source update count: %', changed; END IF;

    UPDATE public.fhfh_player_external_identities AS identity
    SET context_key = 'yahoo:game:453:season:2024', season_id = 20242025,
      source_provenance = identity.source_provenance || jsonb_build_object(
        'season_metadata_repair', jsonb_build_object(
          'id', repair_id, 'evidence_observed_at', '2026-11-12T17:55:21.674214Z',
          'source', 'public.yahoo_game_keys', 'game_key', '453',
          'from_context', identity.context_key, 'from_season_id', identity.season_id,
          'from_updated_at', identity.updated_at, 'to_season_id', 20242025))
    FROM trends_season_repair_targets AS expected WHERE identity.id = expected.external_id;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 3 THEN RAISE EXCEPTION 'Unexpected identity update count: %', changed; END IF;
  END IF;

  -- Use the deployed identity reader, including all of its existing gates.
  IF (SELECT count(*) FROM public.verified_yahoo_player_identities_read() AS admitted
      JOIN trends_season_repair_targets AS expected ON expected.player_key = admitted.external_player_id
        AND expected.fhfh_player_id = admitted.fhfh_player_id
        AND expected.nhl_player_id = admitted.nhl_player_id
      WHERE admitted.season_id = 20242025) <> 3 THEN
    RAISE EXCEPTION 'Repaired identities were not admitted';
  END IF;
END;
$repair$;

SELECT target.player_key, player.season, identity.context_key, identity.season_id,
  identity.fhfh_player_id, target.nhl_player_id, identity.verification_status
FROM trends_season_repair_targets AS target
JOIN public.yahoo_players AS player ON player.player_key = target.player_key
JOIN public.fhfh_player_external_identities AS identity ON identity.id = target.external_id
ORDER BY target.player_key;

\if :{?commit_repair}
  \if :commit_repair
    COMMIT;
  \else
    ROLLBACK;
  \endif
\else
  ROLLBACK;
\endif
