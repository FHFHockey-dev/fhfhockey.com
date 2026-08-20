-- Full rolling-metric resets are an operator-only destructive maintenance
-- action.  Preserve the evidenced service-role pipeline while denying browser
-- roles direct access to the SECURITY DEFINER truncation routine.

revoke execute on function public.truncate_rolling_player_game_metrics()
from public, anon, authenticated;

grant execute on function public.truncate_rolling_player_game_metrics()
to service_role;
