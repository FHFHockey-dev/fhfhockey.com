begin;

set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.predictions_sko
  drop constraint predictions_sko_pk;

alter table public.predictions_sko
  add constraint predictions_sko_pk primary key (
    player_id,
    as_of_date,
    horizon_games,
    model_name,
    model_version
  );

revoke all on table public.predictions_sko from anon, authenticated;
grant select on table public.predictions_sko to anon, authenticated;
grant select, insert, update on table public.predictions_sko to service_role;

comment on constraint predictions_sko_pk on public.predictions_sko is
  'Preserves one prediction per player/date/horizon/model identity without overwriting prior model history.';

reset lock_timeout;
reset statement_timeout;

commit;
