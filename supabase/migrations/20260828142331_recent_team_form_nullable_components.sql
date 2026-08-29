-- Recent Team Form v2 can produce a valid, renormalized score when an
-- individual formula component is unavailable. Keep the score columns
-- required, but allow unavailable components to remain NULL instead of
-- coercing them to a misleading zero. PDO/luck is contextual in v2 and is
-- therefore nullable as well.
alter table public.team_ctpi_daily
  alter column offense drop not null,
  alter column defense drop not null,
  alter column goaltending drop not null,
  alter column special_teams drop not null,
  alter column luck drop not null;
