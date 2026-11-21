-- The cached route reads four UTC windows. A read that spans midnight can
-- render on the following day. Keep the predecessors for both rendering dates.
create view public.yahoo_players_with_trend_history
with (security_invoker = true) as
select p.*,
       coalesce((
         with tail as materialized (
           select h.ownership_date, h.ownership_pct
           from public.yahoo_player_ownership_history h
           where h.player_key = p.player_key and h.ownership_pct is not null
           order by h.ownership_date desc
           limit 12
         ), cutoffs as (
           select utc::date + rollover - days as target
           from (select statement_timestamp() at time zone 'UTC' as utc) clock
           cross join unnest(array[1, 3, 5, 10]) as windows(days)
           cross join (values (0), (1)) as days_ahead(rollover)
           -- 240s request budget plus 60s snapshot lifetime.
           where rollover = 0 or utc::time >= time '23:55'
         ), points as (
           select * from tail
           union
           select prior.*
           from cutoffs c
           cross join lateral (
             select h.ownership_date, h.ownership_pct
             from public.yahoo_player_ownership_history h
             where h.player_key = p.player_key and h.ownership_pct is not null
               and h.ownership_date <= c.target
             order by h.ownership_date desc
             limit 1
           ) prior
           where (select count(*) = 12 and c.target < min(t.ownership_date) from tail t)
         )
         select jsonb_agg(jsonb_build_object('date', to_char(ownership_date, 'YYYY-MM-DD'),
                                            'value', ownership_pct) order by ownership_date)
         from points
       ), '[]'::jsonb) as normalized_ownership_timeline
from public.yahoo_players p;

revoke all on public.yahoo_players_with_trend_history from public, anon, authenticated;
grant select on public.yahoo_players_with_trend_history to anon, authenticated, service_role;
