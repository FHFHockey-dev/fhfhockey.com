-- NOT APPLIED. PP share stored calculation (owner decision 152; math-audit follow-up lane F11). Apply only with
-- TJ's pop-up approval, singly, then record schema_migrations and migration-authority.json (order 149).
--
-- Decision 152: the PP share numerator is player shifts within the qualified team PP intervals, computed once per
-- team-game by one writer (/api/v1/db/update-power-play-combinations/[gameId].ts reading the stored
-- nhl_api_pbp_events, nhl_api_shift_rows, nhl_api_game_roster_spots and teamGameStats) and stored for every reader.
-- This migration:
--   1. Adds calculation_version and computed_at to public."powerPlayCombinations" (both null on existing rows,
--      both set together by the new writer). created_at never changes on upsert, so it can't date a row's values.
--   2. Creates public.pp_team_game_clock, keyed (game_id, team_id): the buildTeamPpClock verdict per team-game.
--      availability is 'available' (qualified, clock > 0, complete shifts: skater-seconds >= 3 x clock),
--      'not_applicable' (qualified, clock 0: a verified no-PP game, shown as "not applicable", never 0%) or
--      'unavailable' (with its reason). Readers show PP share only for 'available' rows. RLS, the public_read
--      policy and grants match team_sos_daily (public data; the writer uses service_role).
--   3. Adds replace_power_play_game_v1, which replaces one game's player rows and its two clock rows as one set in
--      one transaction. It refuses a payload whose player rows belong to a team-game that isn't 'available', whose
--      PPTOI is above that team's clock or doesn't sum to its skater_seconds, whose share isn't PPTOI / clock, or
--      whose PP1 or PP2 has more than 5 players. Nothing is capped. Stale rows (players no longer in the set) are
--      removed by the replace, so none are kept beside newer ones.
-- No existing row value changes. Rollout: apply, then release the writer; the current writer ignores the new
-- columns and table. Readers keep withholding PP share until the served values are verified (decision 152).
--
-- PRE-APPLY: select count(*), max(created_at) from public."powerPlayCombinations";  -- note N, D
-- READBACK (after apply; catalog and counts, no payload reads):
--   select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public'
--    and table_name = 'powerPlayCombinations' and column_name in ('calculation_version', 'computed_at') order by 1;
--   expect calculation_version text YES; computed_at timestamp with time zone YES.
--   select conname from pg_catalog.pg_constraint where conrelid = 'public.pp_team_game_clock'::regclass order by 1;
--   expect pp_team_game_clock_availability_check, _counts_check, _game_id_fkey, _official_class_check, _pkey,
--   _reference_source_check, _state_check.
--   select relrowsecurity from pg_catalog.pg_class where oid = 'public.pp_team_game_clock'::regclass;  -- expect t
--   select grantee, string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'pp_team_game_clock' group by 1 order by 1;
--   expect anon SELECT; authenticated SELECT; service_role DELETE,INSERT,SELECT,UPDATE.
--   select pg_catalog.has_function_privilege('anon', 'public.replace_power_play_game_v1(bigint, text,
--    timestamp with time zone, jsonb, jsonb)', 'execute');  -- expect f (service_role: t)
--   select count(*), max(created_at) from public."powerPlayCombinations";  -- expect N, D (unchanged)
--   select count(*) from public.pp_team_game_clock;  -- expect 0 until the first writer run
-- ROLLBACK: supabase/tests/f11_pp_team_game_clock_rollback.sql (revert the writer first).
-- PROOF: LC_ALL=C python3 -I supabase/tests/f11_pp_team_game_clock.py (disposable local PostgreSQL 15).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public."powerPlayCombinations"
  add column calculation_version text,
  add column computed_at timestamp with time zone,
  add constraint "powerPlayCombinations_calculation_provenance_check" check (
    (calculation_version is null and computed_at is null)
    or (calculation_version is not null and length(calculation_version) > 0 and computed_at is not null)
  );

comment on column public."powerPlayCombinations".calculation_version is
  'Decision 152: the writer calculation that produced this row (null = written by the earlier writer, before the stored calculation). Set together with computed_at.';
comment on column public."powerPlayCombinations".computed_at is
  'Decision 152: when the writer computed this row''s values. created_at is the first insert and does not change on upsert.';

create table public.pp_team_game_clock (
  game_id bigint not null,
  team_id smallint not null,
  availability text not null,
  unavailable_reason text,
  qualified boolean not null,
  clock_seconds integer,
  reference_source text not null,
  official_class text not null,
  official_seconds integer,
  penalty_summary_seconds integer,
  audit_checked_events integer,
  audit_disagreements integer,
  skater_seconds integer,
  calculation_version text not null,
  computed_at timestamp with time zone not null,
  constraint pp_team_game_clock_pkey primary key (game_id, team_id),
  constraint pp_team_game_clock_game_id_fkey foreign key (game_id) references public.games(id)
    on update cascade on delete cascade,
  constraint pp_team_game_clock_availability_check check (
    availability in ('available', 'not_applicable', 'unavailable')
  ),
  constraint pp_team_game_clock_reference_source_check check (
    reference_source in ('teamGameStats', 'nhlPenaltySummary')
  ),
  constraint pp_team_game_clock_official_class_check check (
    official_class in ('missing', 'malformed', 'placeholder', 'zero', 'nonzero')
  ),
  constraint pp_team_game_clock_counts_check check (
    (clock_seconds is null or clock_seconds >= 0)
    and (official_seconds is null or official_seconds >= 0)
    and (penalty_summary_seconds is null or penalty_summary_seconds >= 0)
    and (audit_checked_events is null or audit_checked_events >= 0)
    and (audit_disagreements is null or audit_disagreements >= 0)
    and (skater_seconds is null or skater_seconds >= 0)
    and length(calculation_version) > 0
  ),
  constraint pp_team_game_clock_state_check check (
    (
      availability = 'available'
      and qualified
      and clock_seconds > 0
      and unavailable_reason is null
      and skater_seconds is not null
      and skater_seconds >= 3 * clock_seconds
    )
    or (
      availability = 'not_applicable'
      and qualified
      and clock_seconds = 0
      and unavailable_reason is null
    )
    or (
      availability = 'unavailable'
      and unavailable_reason is not null
      and length(unavailable_reason) > 0
    )
  )
);

comment on table public.pp_team_game_clock is
  'Decision 152: the qualified team PP clock (buildTeamPpClock) per team-game, written with powerPlayCombinations by /api/v1/db/update-power-play-combinations/[gameId]. Readers show PP time and share only where availability = available; not_applicable means a verified no-PP game; unavailable carries its reason. Never capped.';

alter table public.pp_team_game_clock enable row level security;
create policy public_read on public.pp_team_game_clock for select to anon, authenticated using (true);
revoke all on table public.pp_team_game_clock from public, anon, authenticated, service_role;
grant select on table public.pp_team_game_clock to anon, authenticated;
grant select, insert, update, delete on table public.pp_team_game_clock to service_role;

create or replace function public.replace_power_play_game_v1(
  p_game_id bigint,
  p_calculation_version text,
  p_computed_at timestamp with time zone,
  p_clock_rows jsonb,
  p_player_rows jsonb
)
returns table (
  game_id bigint,
  deleted_player_rows integer,
  inserted_player_rows integer,
  clock_rows integer
)
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
set statement_timeout = '30s'
as $$
declare
  v_deleted integer;
  v_inserted integer;
  v_clock integer;
begin
  if p_game_id is null
    or p_calculation_version is null
    or length(p_calculation_version) = 0
    or p_computed_at is null
    or p_clock_rows is null
    or p_player_rows is null
    or pg_catalog.jsonb_typeof(p_clock_rows) <> 'array'
    or pg_catalog.jsonb_typeof(p_player_rows) <> 'array' then
    raise exception using errcode = '22023', message = 'PP_GAME_REPLACE_INVALID_ARGUMENTS';
  end if;

  -- One writer per game at a time.
  perform pg_catalog.pg_advisory_xact_lock(152, (p_game_id % 2147483647)::integer);

  -- Exactly the game's two teams, once each.
  if (
    select count(*) <> 2
      or count(distinct c.team_id) <> 2
      or bool_or(c.game_id is distinct from p_game_id)
      or bool_or(c.team_id not in (g."homeTeamId", g."awayTeamId"))
    from pg_catalog.jsonb_to_recordset(p_clock_rows) as c(game_id bigint, team_id smallint)
    cross join (select x."homeTeamId", x."awayTeamId" from public.games x where x.id = p_game_id) g
  ) is distinct from false then
    raise exception using errcode = '22023', message = 'PP_GAME_REPLACE_CLOCK_TEAMS';
  end if;

  -- Player rows: this game, unique players, and only for an available team-game, within its clock.
  if exists (
    with p as (
      select * from pg_catalog.jsonb_to_recordset(p_player_rows) as x(
        "gameId" bigint, "playerId" bigint, team_id smallint, unit smallint, "PPTOI" integer,
        pp_share_of_team double precision
      )
    ),
    c as (
      select * from pg_catalog.jsonb_to_recordset(p_clock_rows) as x(
        team_id smallint, availability text, clock_seconds integer, skater_seconds integer
      )
    )
    select 1
    from p
    left join c on c.team_id = p.team_id
    where p."gameId" is distinct from p_game_id
      or p."playerId" is null
      or c.availability is distinct from 'available'
      or p.unit is null or p.unit not in (1, 2, 3)
      or p."PPTOI" is null or p."PPTOI" <= 0 or p."PPTOI" > c.clock_seconds
      or p.pp_share_of_team is null or p.pp_share_of_team <= 0 or p.pp_share_of_team > 1
      or abs(p.pp_share_of_team - p."PPTOI"::double precision / c.clock_seconds) > 0.000001
    union all
    select 1 from p group by p."playerId" having count(*) > 1
    union all
    select 1 from p where p.unit in (1, 2) group by p.team_id, p.unit having count(*) > 5
    union all
    select 1
    from c
    left join (select p.team_id, sum(p."PPTOI") as total, count(*) as players from p group by p.team_id) s
      on s.team_id = c.team_id
    where c.availability = 'available'
      and (s.players is null or s.total is distinct from c.skater_seconds::bigint)
  ) then
    raise exception using errcode = '22023', message = 'PP_GAME_REPLACE_PLAYER_ROWS';
  end if;

  delete from public."powerPlayCombinations" pp where pp."gameId" = p_game_id;
  get diagnostics v_deleted = row_count;

  insert into public."powerPlayCombinations" (
    "gameId", "playerId", unit, "percentageOfPP", "PPTOI", pp_unit_usage_index, pp_unit_relative_toi,
    pp_vs_unit_avg, pp_share_of_team, calculation_version, computed_at
  )
  select
    x."gameId", x."playerId", x.unit, x."percentageOfPP", x."PPTOI", x.pp_unit_usage_index,
    x.pp_unit_relative_toi, x.pp_vs_unit_avg, x.pp_share_of_team, p_calculation_version, p_computed_at
  from pg_catalog.jsonb_to_recordset(p_player_rows) as x(
    "gameId" bigint, "playerId" bigint, unit smallint, "percentageOfPP" numeric, "PPTOI" integer,
    pp_unit_usage_index double precision, pp_unit_relative_toi integer, pp_vs_unit_avg double precision,
    pp_share_of_team double precision
  );
  get diagnostics v_inserted = row_count;

  delete from public.pp_team_game_clock t where t.game_id = p_game_id;
  insert into public.pp_team_game_clock (
    game_id, team_id, availability, unavailable_reason, qualified, clock_seconds, reference_source,
    official_class, official_seconds, penalty_summary_seconds, audit_checked_events, audit_disagreements,
    skater_seconds, calculation_version, computed_at
  )
  select
    x.game_id, x.team_id, x.availability, x.unavailable_reason, x.qualified, x.clock_seconds,
    x.reference_source, x.official_class, x.official_seconds, x.penalty_summary_seconds,
    x.audit_checked_events, x.audit_disagreements, x.skater_seconds, p_calculation_version, p_computed_at
  from pg_catalog.jsonb_to_recordset(p_clock_rows) as x(
    game_id bigint, team_id smallint, availability text, unavailable_reason text, qualified boolean,
    clock_seconds integer, reference_source text, official_class text, official_seconds integer,
    penalty_summary_seconds integer, audit_checked_events integer, audit_disagreements integer,
    skater_seconds integer
  );
  get diagnostics v_clock = row_count;

  return query select p_game_id, v_deleted, v_inserted, v_clock;
end;
$$;

comment on function public.replace_power_play_game_v1(bigint, text, timestamp with time zone, jsonb, jsonb) is
  'Decision 152: replaces one game''s powerPlayCombinations rows and its two pp_team_game_clock rows as one set in one transaction. Player rows only for available team-games, within the clock, share = PPTOI / clock, never capped.';

revoke all on function public.replace_power_play_game_v1(bigint, text, timestamp with time zone, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_power_play_game_v1(bigint, text, timestamp with time zone, jsonb, jsonb)
  to service_role;

commit;
