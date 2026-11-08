-- Disposable local PostgreSQL only. Run in two fresh databases with
-- -v legacy_defaults=true and -v legacy_defaults=false respectively.
-- Applies the real, unmodified pending migrations against synthetic dependencies.
\set ON_ERROR_STOP on
\if :legacy_defaults
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLES TO anon, authenticated, service_role;
\endif

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.external_teams (id uuid PRIMARY KEY);
CREATE TABLE public.forge_runs (run_id uuid PRIMARY KEY);
CREATE TABLE public.games (id bigint PRIMARY KEY);
CREATE TABLE public.players (id bigint PRIMARY KEY);
CREATE TABLE public.teams (id smallint PRIMARY KEY);

BEGIN;
\ir ../../../../supabase/migrations/20261026200000_rso_yahoo_past_lineups.sql
COMMIT;
BEGIN;
\ir ../../../../supabase/migrations/20261027090000_forge_reserve_projections.sql
COMMIT;

\if :legacy_defaults
DO $$ BEGIN
  IF NOT has_table_privilege('service_role','public.forge_reserve_projections','TRUNCATE')
    OR NOT has_table_privilege('service_role','public.forge_reserve_projections','REFERENCES')
    OR NOT has_table_privilege('service_role','public.forge_reserve_projections','TRIGGER') THEN
    RAISE EXCEPTION 'legacy defaults did not reproduce the reserve-table excess privileges';
  END IF;
END $$;
\else
DO $$ BEGIN
  IF has_table_privilege('service_role','public.forge_reserve_projections','TRUNCATE')
    OR has_table_privilege('service_role','public.forge_reserve_projections','REFERENCES')
    OR has_table_privilege('service_role','public.forge_reserve_projections','TRIGGER') THEN
    RAISE EXCEPTION 'opt-in baseline unexpectedly grants reserve-table extras';
  END IF;
END $$;
\endif

\ir 01-future-forge-grant.sql
DO $$
DECLARE r text; t text; p text; expected boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.rso_yahoo_past_lineups','public.forge_reserve_projections'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=t::regclass) THEN
      RAISE EXCEPTION 'RLS missing on %',t;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        expected := (r='service_role' AND p IN ('SELECT','INSERT','UPDATE','DELETE'))
          OR (t='public.forge_reserve_projections' AND r IN ('anon','authenticated') AND p='SELECT');
        IF has_table_privilege(r,t,p) IS DISTINCT FROM expected THEN
          RAISE EXCEPTION 'incorrect % % privilege on %',r,p,t;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF has_function_privilege('anon','public.purge_rso_yahoo_past_lineups(integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.purge_rso_yahoo_past_lineups(integer)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.purge_rso_yahoo_past_lineups(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'RSO purge EXECUTE matrix is incorrect';
  END IF;
END $$;

INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001');
INSERT INTO public.external_teams VALUES ('00000000-0000-4000-8000-000000000002');
INSERT INTO public.forge_runs VALUES ('00000000-0000-4000-8000-000000000003');
INSERT INTO public.games VALUES (1);
INSERT INTO public.players VALUES (2);
INSERT INTO public.teams VALUES (3), (4);
SET ROLE service_role;
INSERT INTO public.rso_yahoo_past_lineups(user_id,external_team_id,season_id,lineup_date,entries)
  VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',
          20262027,'2026-10-01','[]'::jsonb)
  ON CONFLICT (user_id,external_team_id,lineup_date) DO UPDATE SET entries=excluded.entries;
INSERT INTO public.rso_yahoo_past_lineups(user_id,external_team_id,season_id,lineup_date,entries)
  VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',
          20262027,'2026-10-01','[{"player_key":"fixture","position":"C"}]'::jsonb)
  ON CONFLICT (user_id,external_team_id,lineup_date) DO UPDATE SET entries=excluded.entries;
INSERT INTO public.forge_reserve_projections(run_id,as_of_date,horizon_games,game_id,player_id,
  team_id,opponent_team_id,player_class,conditioning,reserve_reason,model_version)
  VALUES ('00000000-0000-4000-8000-000000000003','2026-10-01',1,1,2,3,4,
    'skater','if_dressed','synthetic','test')
  ON CONFLICT (run_id,game_id,player_id,horizon_games) DO UPDATE SET reserve_reason=excluded.reserve_reason;
INSERT INTO public.forge_reserve_projections(run_id,as_of_date,horizon_games,game_id,player_id,
  team_id,opponent_team_id,player_class,conditioning,reserve_reason,model_version)
  VALUES ('00000000-0000-4000-8000-000000000003','2026-10-01',1,1,2,3,4,
    'skater','if_dressed','updated','test')
  ON CONFLICT (run_id,game_id,player_id,horizon_games) DO UPDATE SET reserve_reason=excluded.reserve_reason;
DO $$ BEGIN
  IF (SELECT jsonb_array_length(entries) FROM public.rso_yahoo_past_lineups) <> 1
    OR (SELECT reserve_reason FROM public.forge_reserve_projections) <> 'updated' THEN
    RAISE EXCEPTION 'service conflict-update path did not persist';
  END IF;
END $$;
RESET ROLE;

SET ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.forge_reserve_projections) <> 1 THEN
    RAISE EXCEPTION 'anon cannot see the intended synthetic public reserve';
  END IF;
  BEGIN
    PERFORM 1 FROM public.rso_yahoo_past_lineups;
    RAISE EXCEPTION 'anon must not read private lineups';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.forge_reserve_projections) <> 1 THEN
    RAISE EXCEPTION 'authenticated cannot see the intended synthetic public reserve';
  END IF;
  BEGIN
    PERFORM 1 FROM public.rso_yahoo_past_lineups;
    RAISE EXCEPTION 'authenticated must not read private lineups';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
\echo PASS: real pending migration grants, RLS and synthetic service upserts
