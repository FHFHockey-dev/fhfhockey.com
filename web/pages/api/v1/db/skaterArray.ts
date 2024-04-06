import type { NextApiRequest, NextApiResponse } from 'next';
import supabase from 'lib/supabase';

interface SkaterStat {
    // Define the properties based on the wgo_skater_stats table structure
    player_id: number;
    player_name: string;
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
    pp_primary_assists_per_60: number
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

interface DateStats {
    [date: string]: SkaterStat[];
}

interface PlayerStats {
    [playerId: string]: {
        player_name: string;
        stats: DateStats;
    };
}

async function fetchSkaterStats(playerId: string): Promise<PlayerStats | null> {
    let playerStats: PlayerStats = {};
    let offset = 0;
    const limit = 1000;  // Adjust based on what your API can handle

    while (true) {
        let query = supabase.from('wgo_skater_stats').select('*').order('date', { ascending: true }).range(offset, offset + limit - 1);

        if (playerId !== 'all') {
            query = query.eq('player_id', playerId);
        }

        const { data: skaterStats, error } = await query;

        if (error) {
            console.error('Error fetching skater stats:', error);
            break;
        }

        if (!skaterStats || skaterStats.length === 0) {
            break;
        }

        skaterStats.forEach(stat => {
            const { player_id, player_name, date } = stat;
            if (!playerStats[player_id]) {
                playerStats[player_id] = { player_name, stats: {} };
            }
            if (!playerStats[player_id].stats[date]) {
                playerStats[player_id].stats[date] = [];
            }
            playerStats[player_id].stats[date].push(stat);
        });

        if (skaterStats.length < limit) {
            break;
        }

        offset += limit;
    }

    return playerStats;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const playerId = req.query.playerId?.toString();

    if (!playerId) {
        res.status(400).json({ error: 'Player ID must be provided.' });
        return;
    }

    try {
        const playerStats = await fetchSkaterStats(playerId);
        res.status(200).json(playerStats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch skater stats' });
    }
}