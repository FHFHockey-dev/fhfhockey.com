-- Last time the nightly official NHL roster refresh (update-players) listed this membership.
--
-- Additive only: is_current and ended_at keep their meaning, and no membership is ended.
-- The 2026-09-19 training-camp rosters stay is_current, so tweet identity met camp namesakes
-- (FLA Kai/Cole Schwindt, DAL Dylan/Justin Hryckowian). Tweet identity reads this stamp to break a
-- same-team, same-name tie toward the one candidate on the latest official refresh. Rows the
-- refresh never listed keep null and never win a tie by default.

alter table public.rosters add column if not exists official_seen_at timestamptz;

comment on column public.rosters.official_seen_at is
  'Last time the official NHL current roster listed this membership (stamped by upsert_current_roster_membership). Null = never seen on an official refresh since this column was added. Tweet identity uses it only to break same-name ties; it does not change is_current.';

-- Same signature, body and search_path as production, plus the stamp. CREATE OR REPLACE keeps the grants.
create or replace function public.upsert_current_roster_membership(
  _playerid bigint,
  _seasonid bigint,
  _teamid smallint,
  _sweater_number smallint default 0
) returns void
  language plpgsql
  set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $function$
begin
  update public.rosters
  set
    is_current = false,
    ended_at = now()
  where "playerId" = _playerid
    and "seasonId" = _seasonid
    and is_current = true
    and "teamId" <> _teamid;

  insert into public.rosters (
    "playerId",
    "seasonId",
    "teamId",
    "sweaterNumber",
    is_current,
    ended_at,
    official_seen_at
  )
  values (
    _playerid,
    _seasonid,
    _teamid,
    _sweater_number,
    true,
    null,
    now()
  )
  on conflict ("playerId", "seasonId", "teamId")
  do update set
    "sweaterNumber" = excluded."sweaterNumber",
    is_current = true,
    ended_at = null,
    official_seen_at = excluded.official_seen_at;
end;
$function$;
