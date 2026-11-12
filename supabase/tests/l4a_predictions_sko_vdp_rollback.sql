-- Rollback for 20261112120000_add_predictions_sko_vdp_view.sql: drops the view it created. predictions_sko and its
-- rows were never touched, so nothing else needs restoring. Fails (and changes nothing) if a later object depends on
-- the view.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
drop view public.predictions_sko_vdp;
commit;
