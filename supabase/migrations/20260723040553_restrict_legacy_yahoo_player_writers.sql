-- Yahoo player ingestion is a service-role maintenance boundary.
-- Remove inherited API execution from both legacy overloads and the active v3 writer.
REVOKE EXECUTE ON FUNCTION public.upsert_players_batch(jsonb[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_players_batch(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_yahoo_players_v3(jsonb[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_players_batch(jsonb[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_players_batch(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_yahoo_players_v3(jsonb[]) TO service_role;
