create schema if not exists fhfh_internal;

revoke all on schema fhfh_internal from public, anon, authenticated, service_role;

create or replace function fhfh_internal.require_cron_request_headers()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_count bigint;
  secret_value text;
begin
  select pg_catalog.count(*), pg_catalog.min(ds.decrypted_secret)
  into secret_count, secret_value
  from vault.decrypted_secrets as ds
  where ds.name = 'cron_secret';

  if secret_count <> 1 or secret_value is null or pg_catalog.btrim(secret_value) = '' then
    raise exception 'Canonical cron authorization is unavailable.';
  end if;

  return pg_catalog.jsonb_build_object(
    'Authorization',
    pg_catalog.concat('Bearer ', secret_value)
  );
end;
$$;

revoke all on function fhfh_internal.require_cron_request_headers()
from public, anon, authenticated, service_role;

create or replace function public.on_new_line_combo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_headers jsonb;
begin
  request_headers := fhfh_internal.require_cron_request_headers();

  perform net.http_post(
    url := pg_catalog.concat(
      'https://fhfhockey.com/api/v1/webhooks/on-new-line-combo?gameId=',
      new."gameId",
      '&teamId=',
      new."teamId"
    ),
    headers := request_headers,
    timeout_milliseconds := 60000
  );

  return new;
end;
$$;

create or replace function public.on_new_player_underlying_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  home_team_id bigint;
  request_headers jsonb;
begin
  select g."homeTeamId"
  into home_team_id
  from public.games as g
  where g.id = new."gameId";

  if home_team_id = new."teamId" then
    request_headers := fhfh_internal.require_cron_request_headers();

    perform net.http_post(
      url := pg_catalog.concat(
        'https://fhfhockey.com/api/v1/db/update-player-underlying-stats?gameId=',
        new."gameId",
        '&warmLandingCache=true'
      ),
      headers := request_headers,
      timeout_milliseconds := 270000
    );
  end if;

  return new;
end;
$$;

create or replace function public.update_power_play_combinations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_headers jsonb;
begin
  request_headers := fhfh_internal.require_cron_request_headers();

  perform net.http_post(
    url := pg_catalog.concat(
      'https://fhfhockey.com/api/v1/db/update-power-play-combinations/',
      new."gameId"
    ),
    headers := request_headers,
    timeout_milliseconds := 60000
  );

  return new;
end;
$$;

revoke all on function public.on_new_line_combo()
from public, anon, authenticated, service_role;
revoke all on function public.on_new_player_underlying_stats()
from public, anon, authenticated, service_role;
revoke all on function public.update_power_play_combinations()
from public, anon, authenticated, service_role;

drop trigger if exists after_line_combo_insert on public."lineCombinations";
create trigger after_line_combo_insert
after insert on public."lineCombinations"
for each row execute function public.on_new_line_combo();

drop trigger if exists after_player_underlying_stats_insert on public."lineCombinations";
create trigger after_player_underlying_stats_insert
after insert on public."lineCombinations"
for each row execute function public.on_new_player_underlying_stats();

drop trigger if exists update_power_play_combinations_after_line_combo_insert
on public."lineCombinations";
create trigger update_power_play_combinations_after_line_combo_insert
after insert on public."lineCombinations"
for each row execute function public.update_power_play_combinations();
