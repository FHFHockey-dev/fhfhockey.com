-- NOT APPLIED. Math-audit fix lane L4a, SQL ticket from L4b (decision 15, W1 P0 #8 radar).
-- Apply only with TJ's pop-up approval, singly, then record schema_migrations and migration-authority.json (order 136).
--
-- Adds three 5v5 season-long views over the 5v5 game-log tables (nst_gamelog_5v5_counts / _counts_oi), so the
-- radar can read 5v5 instead of es. Each is the even-strength sibling as fixed by 20261111180000 (125) and
-- 20261111180100 (126), with the source and view names changed and nothing else:
--   * nst_seasonlong_5v5_counts, nst_seasonlong_5v5_counts_oi: a row counts only when gp = 1 and its season has a
--     regular-season game (games.type = 2) on its date (decision 69; playoff and aggregate rows are rejected); each
--     summed count is NULL unless every admitted row reports it (rule 13); sh% / FO% NULL on a zero denominator.
--   * nst_seasonlong_5v5_rates: per-60 rates, sh%, FO% and IPP from those views, NULL when unknown or on zero TOI
--     (rule 5). Same column names, order and types as nst_seasonlong_es_rates.
-- The 5v5 on-ice rates view (and so 126's OZ / (OZ + DZ) rule) is not part of this ticket.
-- Grants: SELECT for anon, authenticated and service_role, the readable part of the sibling views' grants
-- (aggregate views are not updatable, so the siblings' write grants do nothing). Needed explicitly since
-- 20261020224500 removed the default grants on new objects. Owner-run views like their siblings.
-- Independent of 125 / 126 (either order); creates objects only, writes no data.
--
-- READBACK (after apply; one player):
--   select player_id, season, gp, toi_seconds, goals_per_60, total_points_per_60, ixg_per_60, ihdcf_per_60
--     from public.nst_seasonlong_5v5_rates where player_id = 8478402 and season = 20252026;
--   select player_id, season, gp, toi_seconds_oi, cf, ca, xgf, xga, hdcf, hdca
--     from public.nst_seasonlong_5v5_counts_oi where player_id = 8478402 and season = 20252026;
--   expect gp <= 82 and toi_seconds below the player's es TOI for the same season.
-- ROLLBACK: supabase/tests/l4a_nst_5v5_views_rollback.sql (drops only these three new views).
-- PROOF: LC_ALL=C python3 -I supabase/tests/l4a_nst_5v5_views.py (disposable local PostgreSQL 15).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

CREATE VIEW public.nst_seasonlong_5v5_counts AS
 SELECT nst_gamelog_5v5_counts.player_id,
    nst_gamelog_5v5_counts.season,
    CASE WHEN count(nst_gamelog_5v5_counts.gp) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.gp, 0)) END AS gp,
    CASE WHEN count(nst_gamelog_5v5_counts.toi) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.toi, 0)) END AS toi_seconds,
    CASE WHEN count(nst_gamelog_5v5_counts.goals) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.goals, 0)) END AS goals,
    CASE WHEN count(nst_gamelog_5v5_counts.total_assists) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.total_assists, 0)) END AS total_assists,
    CASE WHEN count(nst_gamelog_5v5_counts.first_assists) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.first_assists, 0)) END AS first_assists,
    CASE WHEN count(nst_gamelog_5v5_counts.second_assists) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.second_assists, 0)) END AS second_assists,
    CASE WHEN count(nst_gamelog_5v5_counts.total_points) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.total_points, 0)) END AS total_points,
    CASE WHEN count(nst_gamelog_5v5_counts.shots) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.shots, 0)) END AS shots,
    (((((CASE WHEN count(nst_gamelog_5v5_counts.goals) = count(*) THEN sum(nst_gamelog_5v5_counts.goals) END)::numeric * 100.0) / (NULLIF(CASE WHEN count(nst_gamelog_5v5_counts.shots) = count(*) THEN sum(nst_gamelog_5v5_counts.shots) END, 0))::numeric)))::double precision AS sh_percentage,
    CASE WHEN count(nst_gamelog_5v5_counts.ixg) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.ixg, (0.0)::double precision)) END AS ixg,
    CASE WHEN count(nst_gamelog_5v5_counts.icf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.icf, 0)) END AS icf,
    CASE WHEN count(nst_gamelog_5v5_counts.iff) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.iff, 0)) END AS iff,
    CASE WHEN count(nst_gamelog_5v5_counts.iscfs) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.iscfs, 0)) END AS iscfs,
    CASE WHEN count(nst_gamelog_5v5_counts.hdcf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.hdcf, 0)) END AS hdcf,
    CASE WHEN count(nst_gamelog_5v5_counts.rush_attempts) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.rush_attempts, 0)) END AS rush_attempts,
    CASE WHEN count(nst_gamelog_5v5_counts.rebounds_created) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.rebounds_created, 0)) END AS rebounds_created,
    CASE WHEN count(nst_gamelog_5v5_counts.pim) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.pim, 0)) END AS pim,
    CASE WHEN count(nst_gamelog_5v5_counts.total_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.total_penalties, 0)) END AS total_penalties,
    CASE WHEN count(nst_gamelog_5v5_counts.minor_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.minor_penalties, 0)) END AS minor_penalties,
    CASE WHEN count(nst_gamelog_5v5_counts.major_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.major_penalties, 0)) END AS major_penalties,
    CASE WHEN count(nst_gamelog_5v5_counts.misconduct_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.misconduct_penalties, 0)) END AS misconduct_penalties,
    CASE WHEN count(nst_gamelog_5v5_counts.penalties_drawn) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.penalties_drawn, 0)) END AS penalties_drawn,
    CASE WHEN count(nst_gamelog_5v5_counts.giveaways) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.giveaways, 0)) END AS giveaways,
    CASE WHEN count(nst_gamelog_5v5_counts.takeaways) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.takeaways, 0)) END AS takeaways,
    CASE WHEN count(nst_gamelog_5v5_counts.hits) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.hits, 0)) END AS hits,
    CASE WHEN count(nst_gamelog_5v5_counts.hits_taken) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.hits_taken, 0)) END AS hits_taken,
    CASE WHEN count(nst_gamelog_5v5_counts.shots_blocked) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.shots_blocked, 0)) END AS shots_blocked,
    CASE WHEN count(nst_gamelog_5v5_counts.faceoffs_won) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.faceoffs_won, 0)) END AS faceoffs_won,
    CASE WHEN count(nst_gamelog_5v5_counts.faceoffs_lost) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts.faceoffs_lost, 0)) END AS faceoffs_lost,
    (((((CASE WHEN count(nst_gamelog_5v5_counts.faceoffs_won) = count(*) THEN sum(nst_gamelog_5v5_counts.faceoffs_won) END)::numeric * 100.0) / (NULLIF((CASE WHEN count(nst_gamelog_5v5_counts.faceoffs_won) = count(*) THEN sum(nst_gamelog_5v5_counts.faceoffs_won) END + CASE WHEN count(nst_gamelog_5v5_counts.faceoffs_lost) = count(*) THEN sum(nst_gamelog_5v5_counts.faceoffs_lost) END), 0))::numeric)))::double precision AS faceoffs_percentage
   FROM public.nst_gamelog_5v5_counts
  WHERE ((nst_gamelog_5v5_counts.gp = 1) AND (EXISTS ( SELECT 1
           FROM public.games regular_season_game
          WHERE ((regular_season_game."seasonId" = nst_gamelog_5v5_counts.season) AND (regular_season_game.date = nst_gamelog_5v5_counts.date_scraped) AND (regular_season_game.type = 2)))))
  GROUP BY nst_gamelog_5v5_counts.player_id, nst_gamelog_5v5_counts.season;

CREATE VIEW public.nst_seasonlong_5v5_counts_oi AS
 SELECT nst_gamelog_5v5_counts_oi.player_id,
    nst_gamelog_5v5_counts_oi.season,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.gp) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.gp, 0)) END AS gp,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.toi) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.toi, 0)) END AS toi_seconds_oi,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.cf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.cf, 0)) END AS cf,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.ca) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.ca, 0)) END AS ca,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.ff) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.ff, 0)) END AS ff,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.fa) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.fa, 0)) END AS fa,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.sf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.sf, 0)) END AS sf,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.sa) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.sa, 0)) END AS sa,
    (CASE WHEN count(nst_gamelog_5v5_counts_oi.gf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.gf, (0)::double precision)) END)::bigint AS gf,
    (CASE WHEN count(nst_gamelog_5v5_counts_oi.ga) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.ga, (0)::double precision)) END)::bigint AS ga,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.xgf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.xgf, (0.0)::double precision)) END AS xgf,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.xga) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.xga, (0.0)::double precision)) END AS xga,
    (CASE WHEN count(nst_gamelog_5v5_counts_oi.scf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.scf, (0)::double precision)) END)::bigint AS scf,
    (CASE WHEN count(nst_gamelog_5v5_counts_oi.sca) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.sca, (0)::double precision)) END)::bigint AS sca,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.hdcf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.hdcf, 0)) END AS hdcf,
    (CASE WHEN count(nst_gamelog_5v5_counts_oi.hdca) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.hdca, (0)::double precision)) END)::bigint AS hdca,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.hdgf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.hdgf, 0)) END AS hdgf,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.hdga) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.hdga, 0)) END AS hdga,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.mdcf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.mdcf, 0)) END AS mdcf,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.mdca) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.mdca, 0)) END AS mdca,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.mdgf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.mdgf, 0)) END AS mdgf,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.mdga) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.mdga, 0)) END AS mdga,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.ldcf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.ldcf, 0)) END AS ldcf,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.ldca) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.ldca, 0)) END AS ldca,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.ldgf) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.ldgf, 0)) END AS ldgf,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.ldga) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.ldga, 0)) END AS ldga,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.off_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.off_zone_starts, 0)) END AS off_zone_starts,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.neu_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.neu_zone_starts, 0)) END AS neu_zone_starts,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.def_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.def_zone_starts, 0)) END AS def_zone_starts,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.off_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.off_zone_faceoffs, 0)) END AS off_zone_faceoffs,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.neu_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.neu_zone_faceoffs, 0)) END AS neu_zone_faceoffs,
    CASE WHEN count(nst_gamelog_5v5_counts_oi.def_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_5v5_counts_oi.def_zone_faceoffs, 0)) END AS def_zone_faceoffs
   FROM public.nst_gamelog_5v5_counts_oi
  WHERE ((nst_gamelog_5v5_counts_oi.gp = 1) AND (EXISTS ( SELECT 1
           FROM public.games regular_season_game
          WHERE ((regular_season_game."seasonId" = nst_gamelog_5v5_counts_oi.season) AND (regular_season_game.date = nst_gamelog_5v5_counts_oi.date_scraped) AND (regular_season_game.type = 2)))))
  GROUP BY nst_gamelog_5v5_counts_oi.player_id, nst_gamelog_5v5_counts_oi.season;

CREATE VIEW public.nst_seasonlong_5v5_rates AS
 SELECT c.player_id,
    c.season,
    c.gp,
    c.toi_seconds,
    (((((c.goals)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS goals_per_60,
    (((((c.total_assists)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS total_assists_per_60,
    (((((c.first_assists)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS first_assists_per_60,
    (((((c.second_assists)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS second_assists_per_60,
    (((((c.total_points)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS total_points_per_60,
    (((((c.shots)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS shots_per_60,
    (((c.ixg * (3600.0)::double precision) / (NULLIF(c.toi_seconds, 0))::double precision)) AS ixg_per_60,
    (((((c.icf)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS icf_per_60,
    (((((c.iff)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS iff_per_60,
    (((((c.iscfs)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS iscfs_per_60,
    (((((c.hdcf)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS ihdcf_per_60,
    (((((c.rush_attempts)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS rush_attempts_per_60,
    (((((c.rebounds_created)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS rebounds_created_per_60,
    (((((c.pim)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS pim_per_60,
    (((((c.total_penalties)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS total_penalties_per_60,
    (((((c.minor_penalties)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS minor_penalties_per_60,
    (((((c.major_penalties)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS major_penalties_per_60,
    (((((c.misconduct_penalties)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS misconduct_penalties_per_60,
    (((((c.penalties_drawn)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS penalties_drawn_per_60,
    (((((c.giveaways)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS giveaways_per_60,
    (((((c.takeaways)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS takeaways_per_60,
    (((((c.hits)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS hits_per_60,
    (((((c.hits_taken)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS hits_taken_per_60,
    (((((c.shots_blocked)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS shots_blocked_per_60,
    (((((c.faceoffs_won)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS faceoffs_won_per_60,
    (((((c.faceoffs_lost)::numeric * 3600.0) / (NULLIF(c.toi_seconds, 0))::numeric)))::double precision AS faceoffs_lost_per_60,
    c.sh_percentage,
    c.faceoffs_percentage,
    (((((c.total_points)::numeric * 100.0) / (NULLIF(oi.gf, 0))::numeric)))::double precision AS ipp
   FROM (public.nst_seasonlong_5v5_counts c
     LEFT JOIN public.nst_seasonlong_5v5_counts_oi oi ON (((c.player_id = oi.player_id) AND (c.season = oi.season))));

GRANT SELECT ON TABLE public.nst_seasonlong_5v5_counts TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.nst_seasonlong_5v5_counts_oi TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.nst_seasonlong_5v5_rates TO anon, authenticated, service_role;

commit;
