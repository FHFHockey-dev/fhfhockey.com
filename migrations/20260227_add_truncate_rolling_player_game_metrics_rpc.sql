-- Fast full-refresh clear path for rolling player metrics.
-- Called by: supabase.rpc('truncate_rolling_player_game_metrics')

create or replace function public.truncate_rolling_player_game_metrics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table public.rolling_player_game_metrics;
end;
$$;

revoke all on function public.truncate_rolling_player_game_metrics() from public;
grant execute on function public.truncate_rolling_player_game_metrics() to service_role;
