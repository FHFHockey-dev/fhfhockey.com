-- WiGO P-2 (tasks/artifacts/wigo-charts-overhaul-2026-11-01/P1-P2-MIGRATIONS.md): nst_percentile_as_offense and
-- _defense were one-off snapshot tables that nothing writes (no repo writer, no function, no cron job). They hold
-- no 20262027 rows, a 5-GP stub for 20252026 and inflated GP for 20242025, so the AS percentiles and the "All"
-- ratings are empty. This replaces them with views over the AS game logs, the same shape as the ES, PP and PK
-- views: nothing has to write or refresh them; the NST game log ingest that fills nst_gamelog_as_counts{,_oi}
-- is the only writer. Column names, order and types match the old tables, so the client reads them unchanged.
-- Depends on the same planner fix as P-1 (20261104010705), applied here to the AS game logs.
-- The snapshot tables are kept, renamed and closed to browser roles, for rollback (see the note).
set local lock_timeout = '5s';

create index if not exists nst_gamelog_as_counts_season_player_idx
  on public.nst_gamelog_as_counts (season, player_id);
create index if not exists nst_gamelog_as_counts_oi_season_player_idx
  on public.nst_gamelog_as_counts_oi (season, player_id);

alter table public.nst_gamelog_as_counts set (autovacuum_analyze_scale_factor = 0.002);
alter table public.nst_gamelog_as_counts_oi set (autovacuum_analyze_scale_factor = 0.002);

alter table public.nst_percentile_as_offense rename to nst_percentile_as_offense_legacy;
alter table public.nst_percentile_as_defense rename to nst_percentile_as_defense_legacy;
revoke all on public.nst_percentile_as_offense_legacy from anon, authenticated;
revoke all on public.nst_percentile_as_defense_legacy from anon, authenticated;

create view public.nst_percentile_as_offense with (security_invoker = true) as
select
  r.player_id,
  r.season,
  r.gp,
  r.toi_seconds,
  r.goals_per_60,
  r.total_assists_per_60,
  r.first_assists_per_60,
  r.second_assists_per_60,
  r.total_points_per_60,
  r.shots_per_60,
  r.ixg_per_60,
  r.icf_per_60,
  r.iff_per_60,
  r.iscfs_per_60,
  r.ihdcf_per_60 as i_hdcf_per_60,
  r.rush_attempts_per_60,
  r.rebounds_created_per_60,
  oi.cf_per_60,
  oi.ff_per_60,
  oi.sf_per_60,
  oi.gf_per_60,
  oi.xgf_per_60,
  oi.scf_per_60,
  oi.hdcf_per_60 as oi_hdcf_per_60,
  oi.hdgf_per_60,
  oi.mdgf_per_60,
  oi.ldgf_per_60,
  oi.cf_pct,
  oi.ff_pct,
  oi.sf_pct,
  oi.gf_pct,
  oi.xgf_pct,
  oi.scf_pct,
  oi.hdcf_pct,
  oi.hdgf_pct,
  oi.mdgf_pct,
  oi.ldgf_pct,
  r.ipp,
  r.sh_percentage,
  oi.on_ice_sh_pct,
  r.penalties_drawn_per_60
from public.nst_seasonlong_as_rates r
left join public.nst_seasonlong_as_rates_oi oi
  on r.player_id = oi.player_id and r.season = oi.season;

create view public.nst_percentile_as_defense with (security_invoker = true) as
select
  r.player_id,
  r.season,
  r.gp,
  r.toi_seconds,
  oi.ca_per_60,
  oi.fa_per_60,
  oi.sa_per_60,
  oi.ga_per_60,
  oi.xga_per_60,
  oi.sca_per_60,
  oi.hdca_per_60,
  oi.hdga_per_60,
  oi.mdga_per_60,
  oi.ldga_per_60,
  r.shots_blocked_per_60,
  r.takeaways_per_60,
  r.hits_per_60,
  r.pim_per_60,
  r.total_penalties_per_60,
  r.minor_penalties_per_60,
  r.major_penalties_per_60,
  r.misconduct_penalties_per_60,
  r.giveaways_per_60,
  oi.on_ice_sv_pct
from public.nst_seasonlong_as_rates r
left join public.nst_seasonlong_as_rates_oi oi
  on r.player_id = oi.player_id and r.season = oi.season;

grant select on public.nst_percentile_as_offense to anon, authenticated, service_role;
grant select on public.nst_percentile_as_defense to anon, authenticated, service_role;

analyze public.nst_gamelog_as_counts;
analyze public.nst_gamelog_as_counts_oi;

notify pgrst, 'reload schema';
