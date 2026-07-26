create view public.yahoo_players_with_normalized_history
with (security_invoker = true)
as
select
  players.*,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(history.ownership_date, 'YYYY-MM-DD'),
          'value', history.ownership_pct
        )
        order by history.ownership_date
      )
      from public.yahoo_player_ownership_history as history
      where history.player_key = players.player_key
        and history.ownership_pct is not null
    ),
    '[]'::jsonb
  ) as normalized_ownership_timeline
from public.yahoo_players as players;

revoke all on public.yahoo_players_with_normalized_history
  from public, anon, authenticated;
grant select on public.yahoo_players_with_normalized_history
  to anon, authenticated, service_role;

comment on view public.yahoo_players_with_normalized_history is
  'Read-only Yahoo latest-player compatibility surface with ownership_timeline sourced from normalized daily history.';
