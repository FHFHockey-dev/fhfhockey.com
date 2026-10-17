-- Synthetic dependencies, only for the independently initialized local cluster.
-- This file is NOT a production migration or current execution authority.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.teams (id smallint PRIMARY KEY, abbreviation character(3) NOT NULL);
INSERT INTO public.teams VALUES (3, 'NYR'), (4, 'PHI');
CREATE TABLE public.yahoo_matchup_weeks (
  id integer PRIMARY KEY, game_key text, season text, week integer, start_date date, end_date date
);
INSERT INTO public.yahoo_matchup_weeks VALUES
  (1, '477', '2026', 1, '2026-10-05', '2026-10-11'),
  (2, '477', '2026', 2, '2026-10-12', '2026-10-18'),
  (3, '477', '2026', 3, '2026-10-19', '2026-10-25'),
  (4, '477', '2026', 4, '2026-10-26', '2026-11-01');
CREATE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END; $$;
