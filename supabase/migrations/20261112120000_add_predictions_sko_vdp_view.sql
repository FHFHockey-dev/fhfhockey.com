-- NOT APPLIED. Math-audit fix lane L4a, SQL ticket from L20 (decision 134, model v0.4; 317c1ff4d,
-- tasks/artifacts/legacy-sko-definition-2026-11-12/DEFINITION.md production step 2). Apply only with TJ's pop-up
-- approval, singly, then record schema_migrations and migration-authority.json (order 140).
--
-- predictions_sko stores the Volatility-Discounted Points Pace (VDP) in `sko` and the population SD of points per
-- appearance in the misnamed `stability_cv`. This adds one view, public.predictions_sko_vdp, that serves both under
-- their correct names while the table stays as it is:
--   * every predictions_sko column, in table order, unchanged;
--   * stability_sd = stability_cv for model baseline-moving-average v0.2, v0.3 and v0.4 (the versions whose
--     stability_cv is that SD; PREDICTIONS_SKO_SD_VERSIONS in web/lib/predictions/legacyQuarantine.ts), NULL for
--     any other model or version and for a non-finite value, exactly as get-predictions-sko's stabilitySdOf;
--   * vdp = sko (a plain alias for every row).
-- Additive only: no column is added, renamed or dropped, nothing is backfilled and no stored row changes, so issued
-- v0.2 / v0.3 rows stay byte-identical (rule 21). Old columns stay until readers move. Nothing reads the view yet.
-- security_invoker, so the table's RLS ("Predictions read access" for anon and authenticated) and grants still
-- decide what each caller sees. SELECT granted to anon, authenticated and service_role, matching the table's read
-- grants; explicit because 20261020224500 removed default grants on new objects. Creates one view; no table lock
-- beyond the catalog entry.
--
-- READBACK (after apply):
--   select model_name, model_version, count(*) filter (where stability_sd is not null) as with_sd,
--          count(*) filter (where stability_sd is distinct from stability_cv) as sd_differs,
--          count(*) filter (where vdp is distinct from sko) as vdp_differs
--     from public.predictions_sko_vdp group by 1, 2 order by 1, 2;
--   expect vdp_differs 0 everywhere and sd_differs 0 for baseline-moving-average v0.2-v0.4.
--   select reloptions, relacl from pg_catalog.pg_class where oid = 'public.predictions_sko_vdp'::regclass;
--   expect {security_invoker=true} and SELECT for anon, authenticated and service_role.
-- ROLLBACK: supabase/tests/l4a_predictions_sko_vdp_rollback.sql (drops only the view).
-- PROOF: LC_ALL=C python3 -I supabase/tests/l4a_predictions_sko_vdp.py (disposable local PostgreSQL 15).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create view public.predictions_sko_vdp
with (security_invoker = true) as
select
  p.player_id,
  p.as_of_date,
  p.horizon_games,
  p.pred_points,
  p.pred_points_per_game,
  p.stability_cv,
  p.stability_multiplier,
  p.sko,
  p.top_features,
  p.model_name,
  p.model_version,
  p.created_at,
  p.updated_at,
  case
    when p.model_name = 'baseline-moving-average' and p.model_version in ('v0.2', 'v0.3', 'v0.4')
      and p.stability_cv not in ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)
    then p.stability_cv
  end as stability_sd,
  p.sko as vdp
from public.predictions_sko p;

comment on view public.predictions_sko_vdp is
  'Volatility-Discounted Points Pace (decision 134): predictions_sko with vdp (= sko) and stability_sd (= stability_cv, the population SD of points per appearance, for baseline-moving-average v0.2-v0.4 only; NULL otherwise). Unvalidated compatibility model.';

grant select on table public.predictions_sko_vdp to anon, authenticated, service_role;

commit;
