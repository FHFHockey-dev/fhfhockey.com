-- NOT APPLIED. Math-audit fix lane L4a (W2-P0-1, W2-1 D1/F1, PR-SQL-1 counts half; decisions 69, rule 5, rule 13).
-- Apply only with TJ's pop-up approval, singly, then record schema_migrations and migration-authority.json.
--
-- The eight NST season-long count views (es/pp/pk/as x individual/on-ice) summed every game-log row
-- for a player and season label, so they included playoff rows, rows whose date belongs to another
-- season (e.g. a 2025-05-28 playoff game labelled 20252026) and aggregate rows with GP > 1 that the
-- ingest had stamped as one game. Decision 69: season-long views are regular season only (type 2).
--
-- Change (columns, names, order and types unchanged; dependents keep working):
--   * a row counts only when gp = 1 and the row's season has a regular-season game (games.type = 2)
--     on its date. NHL regular-season and playoff dates never overlap, so no team join is needed;
--     an aggregate row (gp <> 1) is rejected even on a regular-season date.
--   * each summed count is NULL unless every admitted row reports it (a missing count is unknown,
--     never zero against known TOI). sh_percentage and faceoffs_percentage use those complete sums
--     and are NULL on a zero denominator instead of 0.
-- Playoff season views are a separate later change. The combined_* and percentile views read these
-- views and inherit the filter; their own formulas are unchanged here.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

CREATE OR REPLACE VIEW public.nst_seasonlong_es_counts AS
 SELECT nst_gamelog_es_counts.player_id,
    nst_gamelog_es_counts.season,
    CASE WHEN count(nst_gamelog_es_counts.gp) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.gp, 0)) END AS gp,
    CASE WHEN count(nst_gamelog_es_counts.toi) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.toi, 0)) END AS toi_seconds,
    CASE WHEN count(nst_gamelog_es_counts.goals) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.goals, 0)) END AS goals,
    CASE WHEN count(nst_gamelog_es_counts.total_assists) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.total_assists, 0)) END AS total_assists,
    CASE WHEN count(nst_gamelog_es_counts.first_assists) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.first_assists, 0)) END AS first_assists,
    CASE WHEN count(nst_gamelog_es_counts.second_assists) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.second_assists, 0)) END AS second_assists,
    CASE WHEN count(nst_gamelog_es_counts.total_points) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.total_points, 0)) END AS total_points,
    CASE WHEN count(nst_gamelog_es_counts.shots) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.shots, 0)) END AS shots,
    (((((CASE WHEN count(nst_gamelog_es_counts.goals) = count(*) THEN sum(nst_gamelog_es_counts.goals) END)::numeric * 100.0) / (NULLIF(CASE WHEN count(nst_gamelog_es_counts.shots) = count(*) THEN sum(nst_gamelog_es_counts.shots) END, 0))::numeric)))::double precision AS sh_percentage,
    CASE WHEN count(nst_gamelog_es_counts.ixg) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.ixg, (0.0)::double precision)) END AS ixg,
    CASE WHEN count(nst_gamelog_es_counts.icf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.icf, 0)) END AS icf,
    CASE WHEN count(nst_gamelog_es_counts.iff) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.iff, 0)) END AS iff,
    CASE WHEN count(nst_gamelog_es_counts.iscfs) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.iscfs, 0)) END AS iscfs,
    CASE WHEN count(nst_gamelog_es_counts.hdcf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.hdcf, 0)) END AS hdcf,
    CASE WHEN count(nst_gamelog_es_counts.rush_attempts) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.rush_attempts, 0)) END AS rush_attempts,
    CASE WHEN count(nst_gamelog_es_counts.rebounds_created) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.rebounds_created, 0)) END AS rebounds_created,
    CASE WHEN count(nst_gamelog_es_counts.pim) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.pim, 0)) END AS pim,
    CASE WHEN count(nst_gamelog_es_counts.total_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.total_penalties, 0)) END AS total_penalties,
    CASE WHEN count(nst_gamelog_es_counts.minor_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.minor_penalties, 0)) END AS minor_penalties,
    CASE WHEN count(nst_gamelog_es_counts.major_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.major_penalties, 0)) END AS major_penalties,
    CASE WHEN count(nst_gamelog_es_counts.misconduct_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.misconduct_penalties, 0)) END AS misconduct_penalties,
    CASE WHEN count(nst_gamelog_es_counts.penalties_drawn) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.penalties_drawn, 0)) END AS penalties_drawn,
    CASE WHEN count(nst_gamelog_es_counts.giveaways) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.giveaways, 0)) END AS giveaways,
    CASE WHEN count(nst_gamelog_es_counts.takeaways) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.takeaways, 0)) END AS takeaways,
    CASE WHEN count(nst_gamelog_es_counts.hits) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.hits, 0)) END AS hits,
    CASE WHEN count(nst_gamelog_es_counts.hits_taken) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.hits_taken, 0)) END AS hits_taken,
    CASE WHEN count(nst_gamelog_es_counts.shots_blocked) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.shots_blocked, 0)) END AS shots_blocked,
    CASE WHEN count(nst_gamelog_es_counts.faceoffs_won) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.faceoffs_won, 0)) END AS faceoffs_won,
    CASE WHEN count(nst_gamelog_es_counts.faceoffs_lost) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts.faceoffs_lost, 0)) END AS faceoffs_lost,
    (((((CASE WHEN count(nst_gamelog_es_counts.faceoffs_won) = count(*) THEN sum(nst_gamelog_es_counts.faceoffs_won) END)::numeric * 100.0) / (NULLIF((CASE WHEN count(nst_gamelog_es_counts.faceoffs_won) = count(*) THEN sum(nst_gamelog_es_counts.faceoffs_won) END + CASE WHEN count(nst_gamelog_es_counts.faceoffs_lost) = count(*) THEN sum(nst_gamelog_es_counts.faceoffs_lost) END), 0))::numeric)))::double precision AS faceoffs_percentage
   FROM public.nst_gamelog_es_counts
  WHERE ((nst_gamelog_es_counts.gp = 1) AND (EXISTS ( SELECT 1
           FROM public.games regular_season_game
          WHERE ((regular_season_game."seasonId" = nst_gamelog_es_counts.season) AND (regular_season_game.date = nst_gamelog_es_counts.date_scraped) AND (regular_season_game.type = 2)))))
  GROUP BY nst_gamelog_es_counts.player_id, nst_gamelog_es_counts.season;

CREATE OR REPLACE VIEW public.nst_seasonlong_es_counts_oi AS
 SELECT nst_gamelog_es_counts_oi.player_id,
    nst_gamelog_es_counts_oi.season,
    CASE WHEN count(nst_gamelog_es_counts_oi.gp) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.gp, 0)) END AS gp,
    CASE WHEN count(nst_gamelog_es_counts_oi.toi) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.toi, 0)) END AS toi_seconds_oi,
    CASE WHEN count(nst_gamelog_es_counts_oi.cf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.cf, 0)) END AS cf,
    CASE WHEN count(nst_gamelog_es_counts_oi.ca) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.ca, 0)) END AS ca,
    CASE WHEN count(nst_gamelog_es_counts_oi.ff) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.ff, 0)) END AS ff,
    CASE WHEN count(nst_gamelog_es_counts_oi.fa) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.fa, 0)) END AS fa,
    CASE WHEN count(nst_gamelog_es_counts_oi.sf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.sf, 0)) END AS sf,
    CASE WHEN count(nst_gamelog_es_counts_oi.sa) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.sa, 0)) END AS sa,
    (CASE WHEN count(nst_gamelog_es_counts_oi.gf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.gf, (0)::double precision)) END)::bigint AS gf,
    (CASE WHEN count(nst_gamelog_es_counts_oi.ga) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.ga, (0)::double precision)) END)::bigint AS ga,
    CASE WHEN count(nst_gamelog_es_counts_oi.xgf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.xgf, (0.0)::double precision)) END AS xgf,
    CASE WHEN count(nst_gamelog_es_counts_oi.xga) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.xga, (0.0)::double precision)) END AS xga,
    (CASE WHEN count(nst_gamelog_es_counts_oi.scf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.scf, (0)::double precision)) END)::bigint AS scf,
    (CASE WHEN count(nst_gamelog_es_counts_oi.sca) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.sca, (0)::double precision)) END)::bigint AS sca,
    CASE WHEN count(nst_gamelog_es_counts_oi.hdcf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.hdcf, 0)) END AS hdcf,
    (CASE WHEN count(nst_gamelog_es_counts_oi.hdca) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.hdca, (0)::double precision)) END)::bigint AS hdca,
    CASE WHEN count(nst_gamelog_es_counts_oi.hdgf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.hdgf, 0)) END AS hdgf,
    CASE WHEN count(nst_gamelog_es_counts_oi.hdga) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.hdga, 0)) END AS hdga,
    CASE WHEN count(nst_gamelog_es_counts_oi.mdcf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.mdcf, 0)) END AS mdcf,
    CASE WHEN count(nst_gamelog_es_counts_oi.mdca) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.mdca, 0)) END AS mdca,
    CASE WHEN count(nst_gamelog_es_counts_oi.mdgf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.mdgf, 0)) END AS mdgf,
    CASE WHEN count(nst_gamelog_es_counts_oi.mdga) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.mdga, 0)) END AS mdga,
    CASE WHEN count(nst_gamelog_es_counts_oi.ldcf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.ldcf, 0)) END AS ldcf,
    CASE WHEN count(nst_gamelog_es_counts_oi.ldca) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.ldca, 0)) END AS ldca,
    CASE WHEN count(nst_gamelog_es_counts_oi.ldgf) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.ldgf, 0)) END AS ldgf,
    CASE WHEN count(nst_gamelog_es_counts_oi.ldga) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.ldga, 0)) END AS ldga,
    CASE WHEN count(nst_gamelog_es_counts_oi.off_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.off_zone_starts, 0)) END AS off_zone_starts,
    CASE WHEN count(nst_gamelog_es_counts_oi.neu_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.neu_zone_starts, 0)) END AS neu_zone_starts,
    CASE WHEN count(nst_gamelog_es_counts_oi.def_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.def_zone_starts, 0)) END AS def_zone_starts,
    CASE WHEN count(nst_gamelog_es_counts_oi.off_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.off_zone_faceoffs, 0)) END AS off_zone_faceoffs,
    CASE WHEN count(nst_gamelog_es_counts_oi.neu_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.neu_zone_faceoffs, 0)) END AS neu_zone_faceoffs,
    CASE WHEN count(nst_gamelog_es_counts_oi.def_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_es_counts_oi.def_zone_faceoffs, 0)) END AS def_zone_faceoffs
   FROM public.nst_gamelog_es_counts_oi
  WHERE ((nst_gamelog_es_counts_oi.gp = 1) AND (EXISTS ( SELECT 1
           FROM public.games regular_season_game
          WHERE ((regular_season_game."seasonId" = nst_gamelog_es_counts_oi.season) AND (regular_season_game.date = nst_gamelog_es_counts_oi.date_scraped) AND (regular_season_game.type = 2)))))
  GROUP BY nst_gamelog_es_counts_oi.player_id, nst_gamelog_es_counts_oi.season;

CREATE OR REPLACE VIEW public.nst_seasonlong_pp_counts AS
 SELECT nst_gamelog_pp_counts.player_id,
    nst_gamelog_pp_counts.season,
    CASE WHEN count((nst_gamelog_pp_counts.gp)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.gp)::integer, 0)) END AS gp,
    CASE WHEN count(nst_gamelog_pp_counts.toi) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts.toi, 0)) END AS toi_seconds,
    CASE WHEN count((nst_gamelog_pp_counts.goals)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.goals)::integer, 0)) END AS goals,
    CASE WHEN count((nst_gamelog_pp_counts.total_assists)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.total_assists)::integer, 0)) END AS total_assists,
    CASE WHEN count((nst_gamelog_pp_counts.first_assists)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.first_assists)::integer, 0)) END AS first_assists,
    CASE WHEN count((nst_gamelog_pp_counts.second_assists)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.second_assists)::integer, 0)) END AS second_assists,
    CASE WHEN count((nst_gamelog_pp_counts.total_points)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.total_points)::integer, 0)) END AS total_points,
    CASE WHEN count((nst_gamelog_pp_counts.shots)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.shots)::integer, 0)) END AS shots,
    (((((CASE WHEN count(nst_gamelog_pp_counts.goals) = count(*) THEN sum(nst_gamelog_pp_counts.goals) END)::numeric * 100.0) / (NULLIF(CASE WHEN count(nst_gamelog_pp_counts.shots) = count(*) THEN sum(nst_gamelog_pp_counts.shots) END, 0))::numeric)))::double precision AS sh_percentage,
    CASE WHEN count(nst_gamelog_pp_counts.ixg) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts.ixg, (0.0)::double precision)) END AS ixg,
    CASE WHEN count((nst_gamelog_pp_counts.icf)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.icf)::integer, 0)) END AS icf,
    CASE WHEN count((nst_gamelog_pp_counts.iff)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.iff)::integer, 0)) END AS iff,
    CASE WHEN count((nst_gamelog_pp_counts.iscfs)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.iscfs)::integer, 0)) END AS iscfs,
    CASE WHEN count((nst_gamelog_pp_counts.hdcf)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.hdcf)::integer, 0)) END AS hdcf,
    CASE WHEN count((nst_gamelog_pp_counts.rush_attempts)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.rush_attempts)::integer, 0)) END AS rush_attempts,
    CASE WHEN count((nst_gamelog_pp_counts.rebounds_created)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.rebounds_created)::integer, 0)) END AS rebounds_created,
    CASE WHEN count((nst_gamelog_pp_counts.pim)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.pim)::integer, 0)) END AS pim,
    CASE WHEN count((nst_gamelog_pp_counts.total_penalties)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.total_penalties)::integer, 0)) END AS total_penalties,
    CASE WHEN count((nst_gamelog_pp_counts.minor_penalties)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.minor_penalties)::integer, 0)) END AS minor_penalties,
    CASE WHEN count((nst_gamelog_pp_counts.major_penalties)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.major_penalties)::integer, 0)) END AS major_penalties,
    CASE WHEN count((nst_gamelog_pp_counts.misconduct_penalties)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.misconduct_penalties)::integer, 0)) END AS misconduct_penalties,
    CASE WHEN count((nst_gamelog_pp_counts.penalties_drawn)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.penalties_drawn)::integer, 0)) END AS penalties_drawn,
    CASE WHEN count((nst_gamelog_pp_counts.giveaways)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.giveaways)::integer, 0)) END AS giveaways,
    CASE WHEN count((nst_gamelog_pp_counts.takeaways)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.takeaways)::integer, 0)) END AS takeaways,
    CASE WHEN count((nst_gamelog_pp_counts.hits)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.hits)::integer, 0)) END AS hits,
    CASE WHEN count((nst_gamelog_pp_counts.hits_taken)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.hits_taken)::integer, 0)) END AS hits_taken,
    CASE WHEN count((nst_gamelog_pp_counts.shots_blocked)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.shots_blocked)::integer, 0)) END AS shots_blocked,
    CASE WHEN count((nst_gamelog_pp_counts.faceoffs_won)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.faceoffs_won)::integer, 0)) END AS faceoffs_won,
    CASE WHEN count((nst_gamelog_pp_counts.faceoffs_lost)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_pp_counts.faceoffs_lost)::integer, 0)) END AS faceoffs_lost,
    (((((CASE WHEN count(nst_gamelog_pp_counts.faceoffs_won) = count(*) THEN sum(nst_gamelog_pp_counts.faceoffs_won) END)::numeric * 100.0) / (NULLIF((CASE WHEN count(nst_gamelog_pp_counts.faceoffs_won) = count(*) THEN sum(nst_gamelog_pp_counts.faceoffs_won) END + CASE WHEN count(nst_gamelog_pp_counts.faceoffs_lost) = count(*) THEN sum(nst_gamelog_pp_counts.faceoffs_lost) END), 0))::numeric)))::double precision AS faceoffs_percentage
   FROM public.nst_gamelog_pp_counts
  WHERE ((nst_gamelog_pp_counts.gp = 1) AND (EXISTS ( SELECT 1
           FROM public.games regular_season_game
          WHERE ((regular_season_game."seasonId" = nst_gamelog_pp_counts.season) AND (regular_season_game.date = nst_gamelog_pp_counts.date_scraped) AND (regular_season_game.type = 2)))))
  GROUP BY nst_gamelog_pp_counts.player_id, nst_gamelog_pp_counts.season;

CREATE OR REPLACE VIEW public.nst_seasonlong_pp_counts_oi AS
 SELECT nst_gamelog_pp_counts_oi.player_id,
    nst_gamelog_pp_counts_oi.season,
    CASE WHEN count(nst_gamelog_pp_counts_oi.gp) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.gp, 0)) END AS gp,
    CASE WHEN count(nst_gamelog_pp_counts_oi.toi) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.toi, 0)) END AS toi_seconds_oi,
    CASE WHEN count(nst_gamelog_pp_counts_oi.cf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.cf, 0)) END AS cf,
    CASE WHEN count(nst_gamelog_pp_counts_oi.ca) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.ca, 0)) END AS ca,
    CASE WHEN count(nst_gamelog_pp_counts_oi.ff) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.ff, 0)) END AS ff,
    CASE WHEN count(nst_gamelog_pp_counts_oi.fa) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.fa, 0)) END AS fa,
    CASE WHEN count(nst_gamelog_pp_counts_oi.sf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.sf, 0)) END AS sf,
    CASE WHEN count(nst_gamelog_pp_counts_oi.sa) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.sa, 0)) END AS sa,
    CASE WHEN count(nst_gamelog_pp_counts_oi.gf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.gf, 0)) END AS gf,
    CASE WHEN count(nst_gamelog_pp_counts_oi.ga) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.ga, 0)) END AS ga,
    CASE WHEN count(nst_gamelog_pp_counts_oi.xgf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.xgf, (0.0)::double precision)) END AS xgf,
    CASE WHEN count(nst_gamelog_pp_counts_oi.xga) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.xga, (0.0)::double precision)) END AS xga,
    CASE WHEN count(nst_gamelog_pp_counts_oi.scf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.scf, 0)) END AS scf,
    CASE WHEN count(nst_gamelog_pp_counts_oi.sca) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.sca, 0)) END AS sca,
    CASE WHEN count(nst_gamelog_pp_counts_oi.hdcf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.hdcf, 0)) END AS hdcf,
    CASE WHEN count(nst_gamelog_pp_counts_oi.hdca) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.hdca, 0)) END AS hdca,
    CASE WHEN count(nst_gamelog_pp_counts_oi.hdgf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.hdgf, 0)) END AS hdgf,
    (CASE WHEN count(nst_gamelog_pp_counts_oi.hdga) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.hdga, (0)::double precision)) END)::bigint AS hdga,
    CASE WHEN count(nst_gamelog_pp_counts_oi.mdcf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.mdcf, 0)) END AS mdcf,
    CASE WHEN count(nst_gamelog_pp_counts_oi.mdca) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.mdca, 0)) END AS mdca,
    CASE WHEN count(nst_gamelog_pp_counts_oi.mdgf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.mdgf, 0)) END AS mdgf,
    CASE WHEN count(nst_gamelog_pp_counts_oi.mdga) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.mdga, 0)) END AS mdga,
    CASE WHEN count(nst_gamelog_pp_counts_oi.ldcf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.ldcf, 0)) END AS ldcf,
    CASE WHEN count(nst_gamelog_pp_counts_oi.ldca) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.ldca, 0)) END AS ldca,
    CASE WHEN count(nst_gamelog_pp_counts_oi.ldgf) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.ldgf, 0)) END AS ldgf,
    CASE WHEN count(nst_gamelog_pp_counts_oi.ldga) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.ldga, 0)) END AS ldga,
    CASE WHEN count(nst_gamelog_pp_counts_oi.off_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.off_zone_starts, 0)) END AS off_zone_starts,
    CASE WHEN count(nst_gamelog_pp_counts_oi.neu_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.neu_zone_starts, 0)) END AS neu_zone_starts,
    CASE WHEN count(nst_gamelog_pp_counts_oi.def_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.def_zone_starts, 0)) END AS def_zone_starts,
    CASE WHEN count(nst_gamelog_pp_counts_oi.on_the_fly_starts) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.on_the_fly_starts, 0)) END AS on_the_fly_starts,
    CASE WHEN count(nst_gamelog_pp_counts_oi.off_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.off_zone_faceoffs, 0)) END AS off_zone_faceoffs,
    CASE WHEN count(nst_gamelog_pp_counts_oi.neu_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.neu_zone_faceoffs, 0)) END AS neu_zone_faceoffs,
    CASE WHEN count(nst_gamelog_pp_counts_oi.def_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_pp_counts_oi.def_zone_faceoffs, 0)) END AS def_zone_faceoffs
   FROM public.nst_gamelog_pp_counts_oi
  WHERE ((nst_gamelog_pp_counts_oi.gp = 1) AND (EXISTS ( SELECT 1
           FROM public.games regular_season_game
          WHERE ((regular_season_game."seasonId" = nst_gamelog_pp_counts_oi.season) AND (regular_season_game.date = nst_gamelog_pp_counts_oi.date_scraped) AND (regular_season_game.type = 2)))))
  GROUP BY nst_gamelog_pp_counts_oi.player_id, nst_gamelog_pp_counts_oi.season;

CREATE OR REPLACE VIEW public.nst_seasonlong_pk_counts AS
 SELECT nst_gamelog_pk_counts.player_id,
    nst_gamelog_pk_counts.season,
    CASE WHEN count(nst_gamelog_pk_counts.gp) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.gp, 0)) END AS gp,
    CASE WHEN count(nst_gamelog_pk_counts.toi) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.toi, 0)) END AS toi_seconds,
    CASE WHEN count(nst_gamelog_pk_counts.goals) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.goals, 0)) END AS goals,
    CASE WHEN count(nst_gamelog_pk_counts.total_assists) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.total_assists, 0)) END AS total_assists,
    CASE WHEN count(nst_gamelog_pk_counts.first_assists) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.first_assists, 0)) END AS first_assists,
    CASE WHEN count(nst_gamelog_pk_counts.second_assists) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.second_assists, 0)) END AS second_assists,
    CASE WHEN count(nst_gamelog_pk_counts.total_points) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.total_points, 0)) END AS total_points,
    CASE WHEN count(nst_gamelog_pk_counts.shots) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.shots, 0)) END AS shots,
    (((((CASE WHEN count(nst_gamelog_pk_counts.goals) = count(*) THEN sum(nst_gamelog_pk_counts.goals) END)::numeric * 100.0) / (NULLIF(CASE WHEN count(nst_gamelog_pk_counts.shots) = count(*) THEN sum(nst_gamelog_pk_counts.shots) END, 0))::numeric)))::double precision AS sh_percentage,
    CASE WHEN count(nst_gamelog_pk_counts.ixg) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.ixg, (0.0)::double precision)) END AS ixg,
    CASE WHEN count(nst_gamelog_pk_counts.icf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.icf, 0)) END AS icf,
    CASE WHEN count(nst_gamelog_pk_counts.iff) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.iff, 0)) END AS iff,
    CASE WHEN count(nst_gamelog_pk_counts.iscfs) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.iscfs, 0)) END AS iscfs,
    CASE WHEN count(nst_gamelog_pk_counts.hdcf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.hdcf, 0)) END AS hdcf,
    CASE WHEN count(nst_gamelog_pk_counts.rush_attempts) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.rush_attempts, 0)) END AS rush_attempts,
    CASE WHEN count(nst_gamelog_pk_counts.rebounds_created) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.rebounds_created, 0)) END AS rebounds_created,
    CASE WHEN count(nst_gamelog_pk_counts.pim) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.pim, 0)) END AS pim,
    CASE WHEN count(nst_gamelog_pk_counts.total_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.total_penalties, 0)) END AS total_penalties,
    CASE WHEN count(nst_gamelog_pk_counts.minor_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.minor_penalties, 0)) END AS minor_penalties,
    CASE WHEN count(nst_gamelog_pk_counts.major_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.major_penalties, 0)) END AS major_penalties,
    CASE WHEN count(nst_gamelog_pk_counts.misconduct_penalties) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.misconduct_penalties, 0)) END AS misconduct_penalties,
    CASE WHEN count(nst_gamelog_pk_counts.penalties_drawn) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.penalties_drawn, 0)) END AS penalties_drawn,
    CASE WHEN count(nst_gamelog_pk_counts.giveaways) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.giveaways, 0)) END AS giveaways,
    CASE WHEN count(nst_gamelog_pk_counts.takeaways) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.takeaways, 0)) END AS takeaways,
    CASE WHEN count(nst_gamelog_pk_counts.hits) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.hits, 0)) END AS hits,
    CASE WHEN count(nst_gamelog_pk_counts.hits_taken) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.hits_taken, 0)) END AS hits_taken,
    CASE WHEN count(nst_gamelog_pk_counts.shots_blocked) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.shots_blocked, 0)) END AS shots_blocked,
    CASE WHEN count(nst_gamelog_pk_counts.faceoffs_won) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.faceoffs_won, 0)) END AS faceoffs_won,
    CASE WHEN count(nst_gamelog_pk_counts.faceoffs_lost) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts.faceoffs_lost, 0)) END AS faceoffs_lost,
    (((((CASE WHEN count(nst_gamelog_pk_counts.faceoffs_won) = count(*) THEN sum(nst_gamelog_pk_counts.faceoffs_won) END)::numeric * 100.0) / (NULLIF((CASE WHEN count(nst_gamelog_pk_counts.faceoffs_won) = count(*) THEN sum(nst_gamelog_pk_counts.faceoffs_won) END + CASE WHEN count(nst_gamelog_pk_counts.faceoffs_lost) = count(*) THEN sum(nst_gamelog_pk_counts.faceoffs_lost) END), 0))::numeric)))::double precision AS faceoffs_percentage
   FROM public.nst_gamelog_pk_counts
  WHERE ((nst_gamelog_pk_counts.gp = 1) AND (EXISTS ( SELECT 1
           FROM public.games regular_season_game
          WHERE ((regular_season_game."seasonId" = nst_gamelog_pk_counts.season) AND (regular_season_game.date = nst_gamelog_pk_counts.date_scraped) AND (regular_season_game.type = 2)))))
  GROUP BY nst_gamelog_pk_counts.player_id, nst_gamelog_pk_counts.season;

CREATE OR REPLACE VIEW public.nst_seasonlong_pk_counts_oi AS
 SELECT nst_gamelog_pk_counts_oi.player_id,
    nst_gamelog_pk_counts_oi.season,
    CASE WHEN count(nst_gamelog_pk_counts_oi.gp) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.gp, 0)) END AS gp,
    CASE WHEN count(nst_gamelog_pk_counts_oi.toi) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.toi, 0)) END AS toi_seconds_oi,
    CASE WHEN count(nst_gamelog_pk_counts_oi.cf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.cf, 0)) END AS cf,
    CASE WHEN count(nst_gamelog_pk_counts_oi.ca) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.ca, 0)) END AS ca,
    CASE WHEN count(nst_gamelog_pk_counts_oi.ff) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.ff, 0)) END AS ff,
    CASE WHEN count(nst_gamelog_pk_counts_oi.fa) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.fa, 0)) END AS fa,
    CASE WHEN count(nst_gamelog_pk_counts_oi.sf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.sf, 0)) END AS sf,
    CASE WHEN count(nst_gamelog_pk_counts_oi.sa) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.sa, 0)) END AS sa,
    (CASE WHEN count(nst_gamelog_pk_counts_oi.gf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.gf, (0)::double precision)) END)::bigint AS gf,
    (CASE WHEN count(nst_gamelog_pk_counts_oi.ga) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.ga, (0)::double precision)) END)::bigint AS ga,
    CASE WHEN count(nst_gamelog_pk_counts_oi.xgf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.xgf, (0.0)::double precision)) END AS xgf,
    CASE WHEN count(nst_gamelog_pk_counts_oi.xga) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.xga, (0.0)::double precision)) END AS xga,
    (CASE WHEN count(nst_gamelog_pk_counts_oi.scf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.scf, (0)::double precision)) END)::bigint AS scf,
    (CASE WHEN count(nst_gamelog_pk_counts_oi.sca) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.sca, (0)::double precision)) END)::bigint AS sca,
    CASE WHEN count(nst_gamelog_pk_counts_oi.hdcf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.hdcf, 0)) END AS hdcf,
    (CASE WHEN count(nst_gamelog_pk_counts_oi.hdca) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.hdca, (0)::double precision)) END)::bigint AS hdca,
    CASE WHEN count(nst_gamelog_pk_counts_oi.hdgf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.hdgf, 0)) END AS hdgf,
    CASE WHEN count(nst_gamelog_pk_counts_oi.hdga) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.hdga, 0)) END AS hdga,
    CASE WHEN count(nst_gamelog_pk_counts_oi.mdcf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.mdcf, 0)) END AS mdcf,
    CASE WHEN count(nst_gamelog_pk_counts_oi.mdca) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.mdca, 0)) END AS mdca,
    CASE WHEN count(nst_gamelog_pk_counts_oi.mdgf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.mdgf, 0)) END AS mdgf,
    CASE WHEN count(nst_gamelog_pk_counts_oi.mdga) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.mdga, 0)) END AS mdga,
    CASE WHEN count(nst_gamelog_pk_counts_oi.ldcf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.ldcf, 0)) END AS ldcf,
    CASE WHEN count(nst_gamelog_pk_counts_oi.ldca) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.ldca, 0)) END AS ldca,
    CASE WHEN count(nst_gamelog_pk_counts_oi.ldgf) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.ldgf, 0)) END AS ldgf,
    CASE WHEN count(nst_gamelog_pk_counts_oi.ldga) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.ldga, 0)) END AS ldga,
    CASE WHEN count(nst_gamelog_pk_counts_oi.off_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.off_zone_starts, 0)) END AS off_zone_starts,
    CASE WHEN count(nst_gamelog_pk_counts_oi.neu_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.neu_zone_starts, 0)) END AS neu_zone_starts,
    CASE WHEN count(nst_gamelog_pk_counts_oi.def_zone_starts) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.def_zone_starts, 0)) END AS def_zone_starts,
    CASE WHEN count(nst_gamelog_pk_counts_oi.off_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.off_zone_faceoffs, 0)) END AS off_zone_faceoffs,
    CASE WHEN count(nst_gamelog_pk_counts_oi.neu_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.neu_zone_faceoffs, 0)) END AS neu_zone_faceoffs,
    CASE WHEN count(nst_gamelog_pk_counts_oi.def_zone_faceoffs) = count(*) THEN sum(COALESCE(nst_gamelog_pk_counts_oi.def_zone_faceoffs, 0)) END AS def_zone_faceoffs
   FROM public.nst_gamelog_pk_counts_oi
  WHERE ((nst_gamelog_pk_counts_oi.gp = 1) AND (EXISTS ( SELECT 1
           FROM public.games regular_season_game
          WHERE ((regular_season_game."seasonId" = nst_gamelog_pk_counts_oi.season) AND (regular_season_game.date = nst_gamelog_pk_counts_oi.date_scraped) AND (regular_season_game.type = 2)))))
  GROUP BY nst_gamelog_pk_counts_oi.player_id, nst_gamelog_pk_counts_oi.season;

CREATE OR REPLACE VIEW public.nst_seasonlong_as_counts AS
 SELECT nst_gamelog_as_counts.player_id,
    nst_gamelog_as_counts.season,
    CASE WHEN count((nst_gamelog_as_counts.gp)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.gp)::integer, 0)) END AS gp,
    CASE WHEN count(nst_gamelog_as_counts.toi) = count(*) THEN sum(COALESCE(nst_gamelog_as_counts.toi, 0)) END AS toi_seconds,
    CASE WHEN count((nst_gamelog_as_counts.goals)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.goals)::integer, 0)) END AS goals,
    CASE WHEN count((nst_gamelog_as_counts.total_assists)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.total_assists)::integer, 0)) END AS total_assists,
    CASE WHEN count((nst_gamelog_as_counts.first_assists)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.first_assists)::integer, 0)) END AS first_assists,
    CASE WHEN count((nst_gamelog_as_counts.second_assists)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.second_assists)::integer, 0)) END AS second_assists,
    CASE WHEN count((nst_gamelog_as_counts.total_points)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.total_points)::integer, 0)) END AS total_points,
    CASE WHEN count((nst_gamelog_as_counts.shots)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.shots)::integer, 0)) END AS shots,
    (((((CASE WHEN count((nst_gamelog_as_counts.goals)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.goals)::integer, 0)) END)::numeric * 100.0) / (NULLIF(CASE WHEN count((nst_gamelog_as_counts.shots)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.shots)::integer, 0)) END, 0))::numeric)))::double precision AS sh_percentage,
    CASE WHEN count(nst_gamelog_as_counts.ixg) = count(*) THEN sum(COALESCE(nst_gamelog_as_counts.ixg, (0.0)::double precision)) END AS ixg,
    CASE WHEN count((nst_gamelog_as_counts.icf)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.icf)::integer, 0)) END AS icf,
    CASE WHEN count((nst_gamelog_as_counts.iff)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.iff)::integer, 0)) END AS iff,
    CASE WHEN count((nst_gamelog_as_counts.iscfs)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.iscfs)::integer, 0)) END AS iscfs,
    CASE WHEN count((nst_gamelog_as_counts.hdcf)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.hdcf)::integer, 0)) END AS hdcf,
    CASE WHEN count((nst_gamelog_as_counts.rush_attempts)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.rush_attempts)::integer, 0)) END AS rush_attempts,
    CASE WHEN count((nst_gamelog_as_counts.rebounds_created)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.rebounds_created)::integer, 0)) END AS rebounds_created,
    CASE WHEN count((nst_gamelog_as_counts.pim)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.pim)::integer, 0)) END AS pim,
    CASE WHEN count((nst_gamelog_as_counts.total_penalties)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.total_penalties)::integer, 0)) END AS total_penalties,
    CASE WHEN count((nst_gamelog_as_counts.minor_penalties)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.minor_penalties)::integer, 0)) END AS minor_penalties,
    CASE WHEN count((nst_gamelog_as_counts.major_penalties)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.major_penalties)::integer, 0)) END AS major_penalties,
    CASE WHEN count((nst_gamelog_as_counts.misconduct_penalties)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.misconduct_penalties)::integer, 0)) END AS misconduct_penalties,
    CASE WHEN count((nst_gamelog_as_counts.penalties_drawn)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.penalties_drawn)::integer, 0)) END AS penalties_drawn,
    CASE WHEN count((nst_gamelog_as_counts.giveaways)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.giveaways)::integer, 0)) END AS giveaways,
    CASE WHEN count((nst_gamelog_as_counts.takeaways)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.takeaways)::integer, 0)) END AS takeaways,
    CASE WHEN count((nst_gamelog_as_counts.hits)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.hits)::integer, 0)) END AS hits,
    CASE WHEN count((nst_gamelog_as_counts.hits_taken)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.hits_taken)::integer, 0)) END AS hits_taken,
    CASE WHEN count((nst_gamelog_as_counts.shots_blocked)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.shots_blocked)::integer, 0)) END AS shots_blocked,
    CASE WHEN count((nst_gamelog_as_counts.faceoffs_won)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.faceoffs_won)::integer, 0)) END AS faceoffs_won,
    CASE WHEN count((nst_gamelog_as_counts.faceoffs_lost)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.faceoffs_lost)::integer, 0)) END AS faceoffs_lost,
    (((((CASE WHEN count((nst_gamelog_as_counts.faceoffs_won)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.faceoffs_won)::integer, 0)) END)::numeric * 100.0) / (NULLIF((CASE WHEN count((nst_gamelog_as_counts.faceoffs_won)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.faceoffs_won)::integer, 0)) END + CASE WHEN count((nst_gamelog_as_counts.faceoffs_lost)::integer) = count(*) THEN sum(COALESCE((nst_gamelog_as_counts.faceoffs_lost)::integer, 0)) END), 0))::numeric)))::double precision AS faceoffs_percentage
   FROM public.nst_gamelog_as_counts
  WHERE ((nst_gamelog_as_counts.gp = 1) AND (EXISTS ( SELECT 1
           FROM public.games regular_season_game
          WHERE ((regular_season_game."seasonId" = nst_gamelog_as_counts.season) AND (regular_season_game.date = nst_gamelog_as_counts.date_scraped) AND (regular_season_game.type = 2)))))
  GROUP BY nst_gamelog_as_counts.player_id, nst_gamelog_as_counts.season;

CREATE OR REPLACE VIEW public.nst_seasonlong_as_counts_oi AS
 SELECT g.player_id,
    g.season,
    CASE WHEN count(g.gp) = count(*) THEN sum(COALESCE(g.gp, 0)) END AS gp,
    CASE WHEN count(g.toi) = count(*) THEN sum(COALESCE(g.toi, 0)) END AS toi_seconds_oi,
    CASE WHEN count(g.cf) = count(*) THEN sum(COALESCE(g.cf, 0)) END AS cf,
    CASE WHEN count(g.ca) = count(*) THEN sum(COALESCE(g.ca, 0)) END AS ca,
    CASE WHEN count(g.ff) = count(*) THEN sum(COALESCE(g.ff, 0)) END AS ff,
    CASE WHEN count(g.fa) = count(*) THEN sum(COALESCE(g.fa, 0)) END AS fa,
    CASE WHEN count(g.sf) = count(*) THEN sum(COALESCE(g.sf, 0)) END AS sf,
    CASE WHEN count(g.sa) = count(*) THEN sum(COALESCE(g.sa, 0)) END AS sa,
    (CASE WHEN count((g.gf)::double precision) = count(*) THEN sum(COALESCE((g.gf)::double precision, (0)::double precision)) END)::bigint AS gf,
    (CASE WHEN count((g.ga)::double precision) = count(*) THEN sum(COALESCE((g.ga)::double precision, (0)::double precision)) END)::bigint AS ga,
    CASE WHEN count(g.xgf) = count(*) THEN sum(COALESCE(g.xgf, (0.0)::double precision)) END AS xgf,
    CASE WHEN count(g.xga) = count(*) THEN sum(COALESCE(g.xga, (0.0)::double precision)) END AS xga,
    (CASE WHEN count((g.scf)::double precision) = count(*) THEN sum(COALESCE((g.scf)::double precision, (0)::double precision)) END)::bigint AS scf,
    (CASE WHEN count((g.sca)::double precision) = count(*) THEN sum(COALESCE((g.sca)::double precision, (0)::double precision)) END)::bigint AS sca,
    CASE WHEN count(g.hdcf) = count(*) THEN sum(COALESCE(g.hdcf, 0)) END AS hdcf,
    (CASE WHEN count((g.hdca)::double precision) = count(*) THEN sum(COALESCE((g.hdca)::double precision, (0)::double precision)) END)::bigint AS hdca,
    CASE WHEN count(g.hdgf) = count(*) THEN sum(COALESCE(g.hdgf, 0)) END AS hdgf,
    CASE WHEN count(g.hdga) = count(*) THEN sum(COALESCE(g.hdga, (0)::double precision)) END AS hdga,
    CASE WHEN count(g.mdcf) = count(*) THEN sum(COALESCE(g.mdcf, 0)) END AS mdcf,
    CASE WHEN count(g.mdca) = count(*) THEN sum(COALESCE(g.mdca, 0)) END AS mdca,
    CASE WHEN count(g.mdgf) = count(*) THEN sum(COALESCE(g.mdgf, 0)) END AS mdgf,
    CASE WHEN count(g.mdga) = count(*) THEN sum(COALESCE(g.mdga, 0)) END AS mdga,
    CASE WHEN count(g.ldcf) = count(*) THEN sum(COALESCE(g.ldcf, 0)) END AS ldcf,
    CASE WHEN count(g.ldca) = count(*) THEN sum(COALESCE(g.ldca, 0)) END AS ldca,
    CASE WHEN count(g.ldgf) = count(*) THEN sum(COALESCE(g.ldgf, 0)) END AS ldgf,
    CASE WHEN count(g.ldga) = count(*) THEN sum(COALESCE(g.ldga, 0)) END AS ldga,
    CASE WHEN count(g.off_zone_starts) = count(*) THEN sum(COALESCE(g.off_zone_starts, 0)) END AS off_zone_starts,
    CASE WHEN count(g.neu_zone_starts) = count(*) THEN sum(COALESCE(g.neu_zone_starts, 0)) END AS neu_zone_starts,
    CASE WHEN count(g.def_zone_starts) = count(*) THEN sum(COALESCE(g.def_zone_starts, 0)) END AS def_zone_starts,
    CASE WHEN count(g.off_zone_faceoffs) = count(*) THEN sum(COALESCE(g.off_zone_faceoffs, 0)) END AS off_zone_faceoffs,
    CASE WHEN count(g.neu_zone_faceoffs) = count(*) THEN sum(COALESCE(g.neu_zone_faceoffs, 0)) END AS neu_zone_faceoffs,
    CASE WHEN count(g.def_zone_faceoffs) = count(*) THEN sum(COALESCE(g.def_zone_faceoffs, 0)) END AS def_zone_faceoffs
   FROM public.nst_gamelog_as_counts_oi g
  WHERE ((g.gp = 1) AND (EXISTS ( SELECT 1
           FROM public.games regular_season_game
          WHERE ((regular_season_game."seasonId" = g.season) AND (regular_season_game.date = g.date_scraped) AND (regular_season_game.type = 2)))))
  GROUP BY g.player_id, g.season;

commit;

-- READBACK (bounded; one player and season):
-- select season, gp, toi_seconds, goals from public.nst_seasonlong_as_counts
--  where player_id = 8478402 and season in (20242025, 20252026);   -- expect gp <= 82 (was 99 / 97)
-- select count(*) filter (where toi_seconds is null) as unknown_toi, count(*) from public.nst_seasonlong_as_counts
--  where season = 20252026;                                          -- complete-support NULLs, expect few
-- ROLLBACK: supabase/tests/nst_seasonlong_l4a_rollback.sql (restores the baseline definitions verbatim).
