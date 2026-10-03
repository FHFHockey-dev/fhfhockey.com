-- LOCAL CANDIDATE ONLY. No refresh, cron changes, alias edits, or history rewrite.
-- Preserve the legacy fallback only for rows with no source team abbreviation.
-- The new resolver never uses players.team_id.
CREATE FUNCTION internal_stats.resolve_goalie_game_team(
  p_abbrev text, p_season integer, p_date date, p_game_id bigint, p_home_road text
) RETURNS TABLE(resolved_team_id smallint, resolution_source text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  candidates smallint[];
  scoped_ids integer[];
  game_row public.games%ROWTYPE;
  game_team smallint;
BEGIN
  IF p_abbrev IS NULL THEN
    IF p_game_id IS NOT NULL THEN
      RAISE EXCEPTION 'GOALIE_TEAM_MISSING: game % has no source abbreviation', p_game_id;
    END IF;
    RETURN QUERY SELECT NULL::smallint, 'unmapped'::text;
    RETURN;
  END IF;
  SELECT array_agg(t.id ORDER BY t.id) INTO candidates
  FROM public.teams t WHERE t.abbreviation::text = p_abbrev;
  IF candidates IS NULL THEN
    RAISE EXCEPTION 'GOALIE_TEAM_MISSING: abbreviation %', p_abbrev;
  END IF;

  -- Only use the season alias to disambiguate repeated abbreviations. Its
  -- franchise_key is a continuity grouping, not an official franchise identity.
  IF cardinality(candidates) > 1 THEN
    IF p_season IS NULL OR p_season / 10000 < 1900
       OR p_season % 10000 <> p_season / 10000 + 1 THEN
      RAISE EXCEPTION 'GOALIE_TEAM_SEASON_INVALID: %', p_season;
    END IF;
    SELECT array_agg(a.nhl_team_id ORDER BY a.nhl_team_id) INTO scoped_ids
    FROM public.team_franchise_alias a
    WHERE a.abbrev = p_abbrev
      AND p_season / 10000 BETWEEN a.season_start AND a.season_end;
    IF cardinality(scoped_ids) > 1 THEN
      RAISE EXCEPTION 'GOALIE_TEAM_ALIAS_OVERLAP: % season %', p_abbrev, p_season;
    END IF;
    IF scoped_ids IS NOT NULL
       AND (scoped_ids[1] IS NULL OR NOT scoped_ids[1] = ANY(candidates)) THEN
      RAISE EXCEPTION 'GOALIE_TEAM_ALIAS_CONFLICT: % season %', p_abbrev, p_season;
    END IF;
  END IF;

  IF p_game_id IS NOT NULL THEN
    IF p_home_road IS NOT NULL AND p_home_road NOT IN ('H', 'R') THEN
      RAISE EXCEPTION 'GOALIE_TEAM_GAME_SIDE_INVALID: %', p_home_road;
    END IF;
    SELECT * INTO game_row FROM public.games WHERE id = p_game_id;
    IF NOT FOUND OR game_row.date IS DISTINCT FROM p_date
       OR game_row."seasonId" IS DISTINCT FROM p_season THEN
      RAISE EXCEPTION 'GOALIE_TEAM_GAME_MISMATCH: %', p_game_id;
    END IF;
    IF p_home_road = 'H' THEN
      game_team := game_row."homeTeamId";
    ELSIF p_home_road = 'R' THEN
      game_team := game_row."awayTeamId";
    ELSE
      -- With missing home/road, exactly one game participant must match.
      SELECT array_agg(id) INTO candidates FROM public.teams
      WHERE abbreviation::text = p_abbrev
        AND id IN (game_row."homeTeamId", game_row."awayTeamId");
      IF cardinality(candidates) IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'GOALIE_TEAM_GAME_AMBIGUOUS: %', p_game_id;
      END IF;
      game_team := candidates[1];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.teams
                   WHERE id = game_team AND abbreviation::text = p_abbrev)
       OR (scoped_ids IS NOT NULL AND scoped_ids[1] <> game_team) THEN
      RAISE EXCEPTION 'GOALIE_TEAM_GAME_CONFLICT: %', p_game_id;
    END IF;
    RETURN QUERY SELECT game_team, 'wgo_game_team'::text;
  ELSIF cardinality(candidates) = 1 THEN
    RETURN QUERY SELECT candidates[1], 'wgo_team_abbreviation'::text;
  ELSIF scoped_ids IS NOT NULL THEN
    RETURN QUERY SELECT scoped_ids[1]::smallint, 'wgo_season_team_alias'::text;
  ELSE
    RAISE EXCEPTION 'GOALIE_TEAM_ALIAS_MISSING: % season %', p_abbrev, p_season;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION internal_stats.resolve_goalie_game_team(text,integer,date,bigint,text)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal_stats.resolve_goalie_game_team(text,integer,date,bigint,text)
TO anon, authenticated, service_role;

-- Change only the team join and its diagnostic. CREATE OR REPLACE preserves
-- column order/types, OID, grants, security_invoker and materialized dependencies.
-- Refuse definition drift rather than silently rewriting an unexpected view.
DO $$
DECLARE
  definition text := pg_catalog.pg_get_viewdef('public.vw_goalie_stats_unified'::regclass, true);
  old_join constant text := 'LEFT JOIN teams tm ON tm.abbreviation::text = w.team_abbreviation
     LEFT JOIN LATERAL ( SELECT COALESCE(tm.id, src.team_id) AS resolved_team_id) team_map ON true';
  new_join constant text := 'LEFT JOIN LATERAL internal_stats.resolve_goalie_game_team(
       w.team_abbreviation, w.season_id, w.date, w.game_id, w.home_road
     ) tm ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(tm.resolved_team_id, src.team_id) AS resolved_team_id) team_map ON true';
  old_source constant text := 'WHEN tm.id IS NOT NULL AND w.team_abbreviation IS NOT NULL THEN ''wgo_team_abbreviation''::text';
BEGIN
  IF pg_catalog.md5(definition) <> '34db6b958ee0d820179611188eaeb269'
     OR pg_catalog.strpos(definition, old_join) = 0
     OR pg_catalog.strpos(definition, old_source) = 0 THEN
    RAISE EXCEPTION 'goalie unified view contract drift; capture and review before applying';
  END IF;
  definition := pg_catalog.replace(definition, old_join, new_join);
  definition := pg_catalog.replace(definition, old_source,
    'WHEN tm.resolved_team_id IS NOT NULL THEN tm.resolution_source');
  EXECUTE 'CREATE OR REPLACE VIEW public.vw_goalie_stats_unified WITH (security_invoker=true) AS ' || definition;
END;
$$;
