// @ts-nocheck
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";

interface SkaterStat {
  // Define the properties based on the wgo_skater_stats table structure
  [key: string]: any; // Adding an index signature
  player_id: number;
  player_name: string;
  sweater_number: number;
  date: string;
  shoots_catches: string;
  position_code: string;
  games_played: number;
  points: number;
  points_per_game: number;
  goals: number;
  assists: number;
  shots: number;
  shooting_percentage: number;
  plus_minus: number;
  ot_goals: number;
  gw_goals: number;
  pp_points: number;
  fow_percentage: number;
  toi_per_game: number;
  birth_date: string;
  current_team_abbreviation: string;
  current_team_name: string;
  birth_city: string;
  birth_country: string;
  birth_state_province: string;
  height: string;
  weight: number;
  draft_round: number;
  draft_pick: number;
  draft_year: number;
  draft_overall: number;
  blocked_shots: number;
  blocks_per_60: number;
  empty_net_assists: number;
  empty_net_goals: number;
  empty_net_points: number;
  first_goals: number;
  giveaways: number;
  giveaways_per_60: number;
  hits: number;
  hits_per_60: number;
  missed_shot_crossbar: number;
  missed_shot_post: number;
  missed_shot_over_net: number;
  missed_shot_short_side: number;
  missed_shot_wide_of_net: number;
  missed_shots: number;
  takeaways: number;
  takeaways_per_60: number;
  d_zone_fo_percentage: number;
  d_zone_faceoffs: number;
  ev_faceoff_percentage: number;
  ev_faceoffs: number;
  n_zone_fo_percentage: number;
  n_zone_faceoffs: number;
  o_zone_fo_percentage: number;
  o_zone_faceoffs: number;
  pp_faceoff_percentage: number;
  pp_faceoffs: number;
  sh_faceoff_percentage: number;
  sh_faceoffs: number;
  total_faceoffs: number;
  d_zone_fol: number;
  d_zone_fow: number;
  ev_fol: number;
  ev_fow: number;
  n_zone_fol: number;
  n_zone_fow: number;
  o_zone_fol: number;
  o_zone_fow: number;
  pp_fol: number;
  pp_fow: number;
  sh_fol: number;
  sh_fow: number;
  total_fol: number;
  total_fow: number;
  es_goal_diff: number;
  es_goals_against: number;
  es_goals_for: number;
  es_goals_for_percentage: number;
  es_toi_per_game: number;
  pp_goals_against: number;
  pp_goals_for: number;
  pp_toi_per_game: number;
  sh_goals_against: number;
  sh_goals_for: number;
  sh_toi_per_game: number;
  game_misconduct_penalties: number;
  major_penalties: number;
  match_penalties: number;
  minor_penalties: number;
  misconduct_penalties: number;
  net_penalties: number;
  net_penalties_per_60: number;
  penalties: number;
  penalties_drawn: number;
  penalties_drawn_per_60: number;
  penalties_taken_per_60: number;
  penalty_minutes: number;
  penalty_minutes_per_toi: number;
  penalty_seconds_per_game: number;
  pp_goals_against_per_60: number;
  sh_assists: number;
  sh_goals: number;
  sh_points: number;
  sh_goals_per_60: number;
  sh_individual_sat_for: number;
  sh_individual_sat_per_60: number;
  sh_points_per_60: number;
  sh_primary_assists: number;
  sh_primary_assists_per_60: number;
  sh_secondary_assists: number;
  sh_secondary_assists_per_60: number;
  sh_shooting_percentage: number;
  sh_shots: number;
  sh_shots_per_60: number;
  sh_time_on_ice: number;
  sh_time_on_ice_pct_per_game: number;
  pp_assists: number;
  pp_goals: number;
  pp_goals_for_per_60: number;
  pp_individual_sat_for: number;
  pp_individual_sat_per_60: number;
  pp_points_per_60: number;
  pp_primary_assists: number;
  pp_primary_assists_per_60: number;
  pp_secondary_assists: number;
  pp_secondary_assists_per_60: number;
  pp_shooting_percentage: number;
  pp_shots: number;
  pp_shots_per_60: number;
  pp_toi: number;
  pp_toi_pct_per_game: number;
  goals_pct: number;
  faceoff_pct_5v5: number;
  individual_sat_for_per_60: number;
  individual_shots_for_per_60: number;
  on_ice_shooting_pct: number;
  sat_pct: number;
  toi_per_game_5v5: number;
  usat_pct: number;
  zone_start_pct: number;
  sat_against: number;
  sat_ahead: number;
  sat_behind: number;
  sat_close: number;
  sat_for: number;
  sat_tied: number;
  sat_total: number;
  usat_against: number;
  usat_ahead: number;
  usat_behind: number;
  usat_close: number;
  usat_for: number;
  usat_tied: number;
  usat_total: number;
  sat_percentage: number;
  sat_percentage_ahead: number;
  sat_percentage_behind: number;
  sat_percentage_close: number;
  sat_percentage_tied: number;
  sat_relative: number;
  shooting_percentage_5v5: number;
  skater_shooting_plus_save_pct_5v5: number;
  usat_percentage: number;
  usat_percentage_ahead: number;
  usat_percentage_behind: number;
  usat_percentage_close: number;
  usat_percentage_tied: number;
  usat_relative: number;
  zone_start_pct_5v5: number;
  assists_5v5: number;
  assists_per_60_5v5: number;
  goals_5v5: number;
  goals_per_60_5v5: number;
  net_minor_penalties_per_60: number;
  o_zone_start_pct_5v5: number;
  on_ice_shooting_pct_5v5: number;
  points_5v5: number;
  points_per_60_5v5: number;
  primary_assists_5v5: number;
  primary_assists_per_60_5v5: number;
  sat_relative_5v5: number;
  secondary_assists_5v5: number;
  secondary_assists_per_60_5v5: number;
  assists_per_game: number;
  blocks_per_game: number;
  goals_per_game: number;
  hits_per_game: number;
  penalty_minutes_per_game: number;
  primary_assists_per_game: number;
  secondary_assists_per_game: number;
  shots_per_game: number;
  total_primary_assists: number;
  total_secondary_assists: number;
  goals_backhand: number;
  goals_bat: number;
  goals_between_legs: number;
  goals_cradle: number;
  goals_deflected: number;
  goals_poke: number;
  goals_slap: number;
  goals_snap: number;
  goals_tip_in: number;
  goals_wrap_around: number;
  goals_wrist: number;
  shooting_pct_backhand: number;
  shooting_pct_bat: number;
  shooting_pct_between_legs: number;
  shooting_pct_cradle: number;
  shooting_pct_deflected: number;
  shooting_pct_poke: number;
  shooting_pct_slap: number;
  shooting_pct_snap: number;
  shooting_pct_tip_in: number;
  shooting_pct_wrap_around: number;
  shooting_pct_wrist: number;
  shots_on_net_backhand: number;
  shots_on_net_bat: number;
  shots_on_net_between_legs: number;
  shots_on_net_cradle: number;
  shots_on_net_deflected: number;
  shots_on_net_poke: number;
  shots_on_net_slap: number;
  shots_on_net_snap: number;
  shots_on_net_tip_in: number;
  shots_on_net_wrap_around: number;
  shots_on_net_wrist: number;
  ev_time_on_ice: number;
  ev_time_on_ice_per_game: number;
  ot_time_on_ice: number;
  ot_time_on_ice_per_game: number;
  shifts: number;
  shifts_per_game: number;
  time_on_ice_per_shift: number;
}

interface PlayerSummaryStats {
  gameLog: DateStats;
  L7: Partial<SkaterStat>;
  L14: Partial<SkaterStat>;
  L30: Partial<SkaterStat>;
  Totals: Partial<SkaterStat>;
}
interface PlayerStats {
  [playerId: string]: {
    player_name: string;
    stats: {
      gameLog: DateStats;
      L7: Partial<SkaterStat>;
      L14: Partial<SkaterStat>;
      L30: Partial<SkaterStat>;
      Totals: Partial<SkaterStat>;
    };
  };
}

interface DateStats {
  [date: string]: SkaterStat[];
}

// Fields to summarize with total sums
const fieldsToSummarize = [
  "games_played",
  "points",
  "goals",
  "assists",
  "shots",
  "plus_minus",
  "ot_goals",
  "gw_goals",
  "pp_points",
  "blocked_shots",
  "empty_net_assists",
  "empty_net_goals",
  "empty_net_points",
  "first_goals",
  "giveaways",
  "hits",
  "missed_shot_crossbar",
  "missed_shot_post",
  "missed_shot_over_net",
  "missed_shot_short_side",
  "missed_shot_wide_of_net",
  "missed_shots",
  "takeaways",
  "d_zone_faceoffs",
  "ev_faceoffs",
  "n_zone_faceoffs",
  "o_zone_faceoffs",
  "pp_faceoffs",
  "sh_faceoffs",
  "total_faceoffs",
  "d_zone_fol",
  "d_zone_fow",
  "ev_fol",
  "ev_fow",
  "n_zone_fol",
  "n_zone_fow",
  "o_zone_fol",
  "o_zone_fow",
  "pp_fol",
  "pp_fow",
  "sh_fol",
  "sh_fow",
  "total_fol",
  "total_fow",
  "es_goal_diff",
  "es_goals_against",
  "es_goals_for",
  "pp_goals_against",
  "pp_goals_for",
  "sh_goals_against",
  "sh_goals_for",
  "game_misconduct_penalties",
  "major_penalties",
  "match_penalties",
  "minor_penalties",
  "misconduct_penalties",
  "net_penalties",
  "penalties",
  "penalties_drawn",
  "penalty_minutes",
  "sh_assists",
  "sh_goals",
  "sh_points",
  "sh_individual_sat_for",
  "sh_primary_assists",
  "sh_secondary_assists",
  "sh_shots",
  "pp_assists",
  "pp_goals",
  "pp_individual_sat_for",
  "pp_primary_assists",
  "pp_secondary_assists",
  "pp_shots",
  "sat_against",
  "sat_ahead",
  "sat_behind",
  "sat_close",
  "sat_for",
  "sat_tied",
  "sat_total",
  "usat_against",
  "usat_ahead",
  "usat_behind",
  "usat_close",
  "usat_for",
  "usat_tied",
  "usat_total",
  "points_5v5",
  "primary_assists_5v5",
  "secondary_assists_5v5",
  "goals_5v5",
  "assists_5v5",
  "total_primary_assists",
  "total_secondary_assists",
  "goals_backhand",
  "goals_bat",
  "goals_between_legs",
  "goals_cradle",
  "goals_deflected",
  "goals_poke",
  "goals_slap",
  "goals_snap",
  "goals_tip_in",
  "goals_wrap_around",
  "goals_wrist",
  "shots_on_net_backhand",
  "shots_on_net_bat",
  "shots_on_net_between_legs",
  "shots_on_net_cradle",
  "shots_on_net_deflected",
  "shots_on_net_poke",
  "shots_on_net_slap",
  "shots_on_net_snap",
  "shots_on_net_tip_in",
  "shots_on_net_wrap_around",
  "shots_on_net_wrist",
  "shifts",
];
// Fields to average
const fieldsToAverage = [
  "shooting_percentage",
  "points_per_game",
  "fow_percentage",
  "toi_per_game",
  "blocks_per_60",
  "giveaways_per_60",
  "hits_per_60",
  "takeaways_per_60",
  "d_zone_fo_percentage",
  "ev_faceoff_percentage",
  "n_zone_fo_percentage",
  "o_zone_fo_percentage",
  "pp_faceoff_percentage",
  "sh_faceoff_percentage",
  "es_goals_for_percentage",
  "es_toi_per_game",
  "pp_toi_per_game",
  "sh_toi_per_game",
  "net_penalties_per_60",
  "penalties_drawn_per_60",
  "penalties_taken_per_60",
  "penalty_minutes_per_toi",
  "penalty_seconds_per_game",
  "pp_goals_against_per_60",
  "sh_goals_per_60",
  "sh_individual_sat_per_60",
  "sh_points_per_60",
  "sh_primary_assists_per_60",
  "sh_secondary_assists_per_60",
  "sh_shooting_percentage",
  "sh_shots_per_60",
  "sh_time_on_ice_pct_per_game",
  "pp_goals_for_per_60",
  "pp_individual_sat_per_60",
  "pp_points_per_60",
  "pp_primary_assists_per_60",
  "pp_secondary_assists_per_60",
  "pp_shooting_percentage",
  "pp_shots_per_60",
  "pp_toi_pct_per_game",
  "pp_toi",
  "goals_pct",
  "faceoff_pct_5v5",
  "individual_sat_for_per_60",
  "individual_shots_for_per_60",
  "on_ice_shooting_pct",
  "sat_pct",
  "toi_per_game_5v5",
  "usat_pct",
  "zone_start_pct",
  "sat_percentage",
  "sat_percentage_ahead",
  "sat_percentage_behind",
  "sat_percentage_close",
  "sat_percentage_tied",
  "sat_relative",
  "shooting_percentage_5v5",
  "skater_shooting_plus_save_pct_5v5",
  "usat_percentage",
  "usat_percentage_ahead",
  "usat_percentage_behind",
  "usat_percentage_close",
  "usat_percentage_tied",
  "usat_relative",
  "zone_start_pct_5v5",
  "assists_per_60_5v5",
  "goals_per_60_5v5",
  "net_minor_penalties_per_60",
  "o_zone_start_pct_5v5",
  "on_ice_shooting_pct_5v5",
  "points_per_60_5v5",
  "primary_assists_per_60_5v5",
  "sat_relative_5v5",
  "secondary_assists_per_60_5v5",
  "assists_per_game",
  "blocks_per_game",
  "goals_per_game",
  "hits_per_game",
  "penalty_minutes_per_game",
  "primary_assists_per_game",
  "secondary_assists_per_game",
  "shots_per_game",
  "shooting_pct_backhand",
  "shooting_pct_bat",
  "shooting_pct_between_legs",
  "shooting_pct_cradle",
  "shooting_pct_deflected",
  "shooting_pct_poke",
  "shooting_pct_slap",
  "shooting_pct_snap",
  "shooting_pct_tip_in",
  "shooting_pct_wrap_around",
  "shooting_pct_wrist",
  "ev_time_on_ice",
  "ev_time_on_ice_per_game",
  "ot_time_on_ice",
  "ot_time_on_ice_per_game",
  "shifts_per_game",
  "time_on_ice_per_shift",
];

// Utility function to calculate summaries based on the last N games
function calculatePeriodSummary(
  stats: SkaterStat[],
  summarizeFields: string[],
  averageFields: string[]
): Partial<SkaterStat> & { date_range: string } {
  const summary: Partial<SkaterStat> = {};

  stats.forEach((stat) => {
    summarizeFields.forEach((field) => {
      if (typeof stat[field] === "number") {
        summary[field] = (summary[field] || 0) + stat[field];
      }
    });
    averageFields.forEach((field) => {
      if (typeof stat[field] === "number") {
        summary[field] = (summary[field] || 0) + stat[field];
      }
    });
  });

  averageFields.forEach((field) => {
    if (summary[field] !== undefined) {
      summary[field] /= stats.length;
    }
  });

  let date_range = "N/A";
  if (stats.length > 0) {
    const dates = stats.map((stat) => stat.date);
    const sortedDates = dates.sort((a, b) => a.localeCompare(b));
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    date_range = `${startDate} - ${endDate}`;
  }

  return { ...summary, date_range };
}

async function fetchSkaterStats(playerId: string): Promise<PlayerStats | null> {
  let playerStats: PlayerStats = {};
  let offset = 0;
  const limit = 1000;

  while (true) {
    let query = supabase
      .from("wgo_skater_stats")
      .select("*")
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (playerId !== "all") {
      query = query.eq("player_id", Number.parseInt(playerId));
    }

    const { data: skaterStats, error } = await query;

    if (error) {
      console.error("Error fetching skater stats:", error);
      break;
    }

    if (!skaterStats || skaterStats.length === 0) {
      break;
    }

    skaterStats.forEach((stat) => {
      const { player_id, player_name, date } = stat;
      if (!playerStats[player_id]) {
        playerStats[player_id] = {
          player_name,
          stats: {
            gameLog: {},
            L7: {},
            L14: {},
            L30: {},
            Totals: {},
          },
        };
      }

      if (!playerStats[player_id].stats.gameLog[date]) {
        playerStats[player_id].stats.gameLog[date] = [];
      }
      playerStats[player_id].stats.gameLog[date].push(stat);
    });

    if (skaterStats.length < limit) {
      break;
    }

    offset += limit;
  }

  for (const playerId in playerStats) {
    const allStats = Object.values(playerStats[playerId].stats.gameLog)
      .flat()
      .sort((a, b) => b.date.localeCompare(a.date));

    playerStats[playerId].stats.L7 = calculatePeriodSummary(
      allStats.slice(0, 7),
      fieldsToSummarize,
      fieldsToAverage
    );
    playerStats[playerId].stats.L14 = calculatePeriodSummary(
      allStats.slice(0, 14),
      fieldsToSummarize,
      fieldsToAverage
    );
    playerStats[playerId].stats.L30 = calculatePeriodSummary(
      allStats.slice(0, 30),
      fieldsToSummarize,
      fieldsToAverage
    );
  }

  // Fetch season-long data from the wgo_skater_stats_totals table
  if (playerId !== "all") {
    const { data: seasonStats, error: seasonError } = await supabase
      .from("wgo_skater_stats_totals")
      .select("*")
      .eq("player_id", playerId)
      .single();

    if (seasonError) {
      console.error("Error fetching season-long stats:", seasonError);
      return null;
    }

    if (seasonStats) {
      for (const playerId in playerStats) {
        playerStats[playerId].stats.Totals = seasonStats;
      }
    }
  } else {
    const { data: seasonStats, error: seasonError } = await supabase
      .from("wgo_skater_stats_totals")
      .select("*");

    if (seasonError) {
      console.error("Error fetching season-long stats:", seasonError);
      return null;
    }

    if (seasonStats) {
      seasonStats.forEach((seasonStat) => {
        const { player_id } = seasonStat;
        if (playerStats[player_id]) {
          playerStats[player_id].stats.Totals = seasonStat;
        }
      });
    }
  }

  return playerStats;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const playerId = req.query.playerId?.toString();

  if (!playerId) {
    res.status(400).json({ error: "Player ID must be provided." });
    return;
  }

  try {
    const playerStats = await fetchSkaterStats(playerId);
    res.setHeader(
      "Cache-Control",
      "max-age=86400, s-maxage=86400, stale-while-revalidate"
    );
    res.status(200).json(playerStats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch skater stats" });
  }
}

export default withCronJobAudit(handler);
