import { useState, useEffect } from "react";
import supabase from "lib/supabase";
import { Database } from "lib/supabase/database-generated.types";

// Use the actual database types
type WGOTeamStats = Database["public"]["Tables"]["wgo_team_stats"]["Row"];

export interface TeamStatsRecord extends WGOTeamStats {}

export interface TeamRecord {
  wins: number | null;
  losses: number | null;
  otLosses: number | null;
  points: number | null;
  gamesPlayed: number | null;
  regulationWins?: number | null;
  overtimeWins?: number | null;
  shootoutWins?: number | null;
}

export interface TeamGameStats {
  gameId: number;
  teamId: number;
  score: number;
  sog: number;
  faceoffPctg: number;
  pim: number;
  powerPlayConversion: string;
  hits: number;
  blockedShots: number;
  giveaways: number;
  takeaways: number;
  powerPlay: string;
  powerPlayToi: string;
}

export function useTeamStatsFromDb(teamId: number | string, seasonId: string) {
  const [teamStats, setTeamStats] = useState<TeamStatsRecord[]>([]);
  const [record, setRecord] = useState<TeamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeamStats = async () => {
      if (!teamId || !seasonId) {
        console.log("❌ Missing required params:", { teamId, seasonId });
        setError("Team ID and Season ID are required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log("🔍 Fetching team stats from DB:", {
          teamId: Number(teamId),
          seasonId: Number(seasonId)
        });

        // Fetch daily team stats from wgo_team_stats (for calendar analysis)
        const { data, error: fetchError } = await supabase
          .from("wgo_team_stats")
          .select("*")
          .eq("team_id", Number(teamId))
          .eq("season_id", Number(seasonId))
          .order("date", { ascending: true });

        if (fetchError) {
          console.error("❌ Supabase error:", fetchError);
          throw fetchError;
        }

        console.log("✅ Fetched team stats:", {
          count: data?.length || 0,
          firstFew: data?.slice(0, 3) || [],
          lastFew: data?.slice(-3) || []
        });

        setTeamStats(data || []);

        // Fetch official record from team_summary_years (same as team page header)
        const { data: summaryData, error: summaryError } = await supabase
          .from("team_summary_years")
          .select(
            `
            games_played,
            wins,
            losses,
            ot_losses,
            points,
            regulation_and_ot_wins
          `
          )
          .eq("team_id", Number(teamId))
          .eq("season_id", Number(seasonId))
          .single();

        if (summaryError) {
          console.warn(
            "⚠️ Error fetching team summary (falling back to wgo_team_stats):",
            summaryError
          );
          // Fallback to wgo_team_stats if team_summary_years fails
          if (data && data.length > 0) {
            const latestStats = data[data.length - 1];
            const calculatedRecord = {
              wins: latestStats.wins,
              losses: latestStats.losses,
              otLosses: latestStats.ot_losses,
              points: latestStats.points,
              gamesPlayed: latestStats.games_played,
              regulationWins: latestStats.wins_in_regulation,
              overtimeWins:
                (latestStats.regulation_and_ot_wins || 0) -
                (latestStats.wins_in_regulation || 0),
              shootoutWins: latestStats.wins_in_shootout
            };
            setRecord(calculatedRecord);
          }
        } else if (summaryData) {
          // Use official team summary data (same as team page header)
          const officialRecord = {
            wins: summaryData.wins,
            losses: summaryData.losses,
            otLosses: summaryData.ot_losses,
            points: summaryData.points,
            gamesPlayed: summaryData.games_played,
            regulationWins: summaryData.regulation_and_ot_wins
          };

          console.log(
            "📈 Official record from team_summary_years:",
            officialRecord
          );
          setRecord(officialRecord);
        }
      } catch (err) {
        console.error("❌ Error fetching team stats:", err);
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
