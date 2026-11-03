begin read only;
set local statement_timeout = '5s';
set local lock_timeout = '1s';
select id as "gameId", date as "gameDate", "startTime" as "scheduledAt"
from public.games where date = date '2026-11-02'
order by "startTime", id limit 17;
rollback;
