import { useState, useEffect } from "react";
import supabase from "lib/supabase";

// Updated interface to match the actual database schema
interface WGOTeamStats {
  team_id: number;
  franchise_name: string;
  date: string;
  season_id: number;
  faceoff_win_pct: number | null;
  games_played: number | null;
  goals_against: number | null;
  goals_against_per_game: number | null;
  goals_for: number | null;
  goals_for_per_game: number | null;
  losses: number | null;
  ot_losses: number | null;
  penalty_kill_pct: number | null;
  point_pct: number | null;
  points: number | null;
  power_play_pct: number | null;
  regulation_and_ot_wins: number | null;
  shots_against_per_game: number | null;
  shots_for_per_game: number | null;
  wins: number | null;
  wins_in_regulation: number | null;
  wins_in_shootout: number | null;
  // Additional fields from the database schema
  blocked_shots: number | null;
  blocked_shots_per_60: number | null;
  empty_net_goals: number | null;
  giveaways: number | null;
  giveaways_per_60: number | null;
  hits: number | null;
  hits_per_60: number | null;
  missed_shots: number | null;
  sat_pct: number | null;
  takeaways: number | null;
  takeaways_per_60: number | null;
  pp_opportunities: number | null;
  pp_opportunities_per_game: number | null;
  power_play_goals_for: number | null;
  pp_goals_per_game: number | null;
  pp_net_goals: number | null;
  pp_net_goals_per_game: number | null;
  pp_time_on_ice_per_game: number | null;
  sh_goals_against: number | null;
  sh_goals_against_per_game: number | null;
  penalty_kill_goals_for: number | null;
  pk_goals_per_game: number | null;
  pk_net_goals: number | null;
  pk_net_goals_per_game: number | null;
  times_shorthanded: number | null;
  times_shorthanded_per_game: number | null;
  pk_time_on_ice_per_game: number | null;
  shooting_pct: number | null;
  save_pct: number | null;
  pdo: number | null;
  shooting_pct_5v5: number | null;
  save_pct_5v5: number | null;
  pdo_5v5: number | null;
  shooting_plus_save_pct_5v5: number | null;
  usat_pct: number | null;
  usat_pct_ahead: number | null;
  goalsFor: number;
  goalsAgainst: number;
  goalDifferential: number;
}

export function useTeamStatsFromDb(teamId: number | string, seasonId: string) {
  const [teamStats, setTeamStats] = useState<TeamStatsRecord[]>([]);
  const [record, setRecord] = useState<TeamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeamStats = async () => {
      if (!teamId || !seasonId) {
        setError("Team ID and Season ID are required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("wgo_team_stats")
          .select("*")
          .eq("team_id", teamId)
          .eq("season_id", seasonId)
          .order("date", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        setTeamStats(data || []);

        // Calculate current record from the latest entry
        if (data && data.length > 0) {
          const latestStats = data[data.length - 1];
          setRecord({
            wins: latestStats.wins,
            losses: latestStats.losses,
            otLosses: latestStats.ot_losses,
            points: latestStats.points,
            gamesPlayed: latestStats.games_played,
            pointsPercentage: latestStats.points_percentage,
            regulationWins:
              latestStats.regulation_wins ||
              latestStats.wins_in_regulation ||
              0,
            overtimeWins:
              (latestStats.regulation_and_ot_wins || 0) -
              (latestStats.wins_in_regulation || 0),
            shootoutWins: latestStats.wins_in_shootout || 0,
            goalsFor: latestStats.goals_for,
            goalsAgainst: latestStats.goals_against,
            goalDifferential: latestStats.goal_differential
          });
        }
      } catch (err) {
        console.error("Error fetching team stats:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch team stats"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTeamStats();
  }, [teamId, seasonId]);

  return { teamStats, record, loading, error };
}

export function useTeamGameStats(gameId: number | null) {
  const [gameStats, setGameStats] = useState<TeamGameStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameStats = async () => {
      if (!gameId) {
        setGameStats([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("teamGameStats")
          .select("*")
          .eq("gameId", gameId);

        if (fetchError) {
          throw fetchError;
        }

        setGameStats(data || []);
      } catch (err) {
        console.error("Error fetching game stats:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch game stats"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchGameStats();
  }, [gameId]);

  return { gameStats, loading, error };
}
