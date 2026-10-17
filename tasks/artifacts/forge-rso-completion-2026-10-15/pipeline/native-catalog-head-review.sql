-- LOCAL REVIEW ARTIFACT ONLY. Not applied. No scheduler or public activation.
-- Immutable selections live in the existing player_forecast_source_observations.
BEGIN;
CREATE TABLE public.native_forecast_catalog_heads (
  id uuid PRIMARY KEY,
  season_id integer NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  observation_id uuid NOT NULL REFERENCES public.player_forecast_source_observations(id),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  selected_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.native_forecast_catalog_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.native_forecast_catalog_heads FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_forecast_catalog_heads FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.native_forecast_catalog_heads TO service_role;

CREATE FUNCTION public.cas_native_forecast_catalog_head(
  p_head_id uuid, p_season_id integer, p_expected_revision bigint, p_expected_hash text,
  p_observation_id uuid, p_payload_hash text
) RETURNS SETOF public.native_forecast_catalog_heads
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE receipt public.player_forecast_source_observations%ROWTYPE;
BEGIN
  IF p_expected_revision < 0 OR p_expected_revision IS NULL
    OR (p_expected_revision = 0 AND p_expected_hash IS NOT NULL)
    OR (p_expected_revision > 0 AND (p_expected_hash IS NULL OR p_expected_hash !~ '^[a-f0-9]{64}$'))
    OR p_payload_hash IS NULL OR p_payload_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid native catalog CAS identity' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO STRICT receipt FROM public.player_forecast_source_observations WHERE id = p_observation_id;
  IF receipt.provider IS DISTINCT FROM 'fhfh' OR receipt.dataset_key IS DISTINCT FROM 'native-catalog-selection-v1'
    OR receipt.entity_kind IS DISTINCT FROM 'catalog_selection' OR receipt.entity_key IS DISTINCT FROM p_season_id::text
    OR receipt.payload_hash IS DISTINCT FROM p_payload_hash OR receipt.available_at IS NULL
    OR jsonb_typeof(receipt.payload) IS DISTINCT FROM 'object'
    OR receipt.payload->>'version' IS DISTINCT FROM 'native-catalog-selection-v1'
    OR jsonb_typeof(receipt.payload->'seasonId') IS DISTINCT FROM 'number'
    OR receipt.payload->>'seasonId' IS DISTINCT FROM p_season_id::text
    OR jsonb_typeof(receipt.payload->'issuedAt') IS DISTINCT FROM 'string'
    OR jsonb_typeof(receipt.payload->'expiresAt') IS DISTINCT FROM 'string'
    OR receipt.available_at IS DISTINCT FROM (receipt.payload->>'issuedAt')::timestamptz
    OR receipt.available_at > clock_timestamp() OR (receipt.payload->>'expiresAt')::timestamptz <= clock_timestamp() THEN
    RAISE EXCEPTION 'Native catalog selection envelope mismatch' USING ERRCODE = '22023';
  END IF;
  IF p_expected_revision = 0 THEN
    RETURN QUERY INSERT INTO public.native_forecast_catalog_heads(id, season_id, revision, observation_id, payload_hash)
      VALUES(p_head_id, p_season_id, 1, p_observation_id, p_payload_hash)
      ON CONFLICT(id) DO NOTHING RETURNING *;
  ELSE
    RETURN QUERY UPDATE public.native_forecast_catalog_heads
      SET revision = p_expected_revision + 1, observation_id = p_observation_id, payload_hash = p_payload_hash, selected_at = clock_timestamp()
      WHERE id = p_head_id AND season_id = p_season_id AND revision = p_expected_revision AND payload_hash = p_expected_hash
      RETURNING *;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Native catalog CAS conflict' USING ERRCODE = '40001'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cas_native_forecast_catalog_head(uuid, integer, bigint, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cas_native_forecast_catalog_head(uuid, integer, bigint, text, uuid, text) TO service_role;
COMMIT;
