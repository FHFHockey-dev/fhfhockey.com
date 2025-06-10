import { useState, useEffect } from "react";
import supabase from "lib/supabase";
import { Database } from "lib/supabase/database-generated.types";

// Use the actual database types
type WGOSkaterStats = Database["public"]["Tables"]["wgo_skater_stats"]["Row"];
type WGOGoalieStats = Database["public"]["Tables"]["wgo_goalie_stats"]["Row"];

export function useWGOSkaterStats(
  playerId: number | string,
  seasonId: string | number
) {
  const [skaterStats, setSkaterStats] = useState<WGOSkaterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkaterStats = async () => {
      if (!playerId || !seasonId) {
        setError("Player ID and Season ID are required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("wgo_skater_stats")
          .select("*")
          .eq("player_id", Number(playerId))
          .eq("season_id", Number(seasonId))
          .order("date", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        setSkaterStats(data || []);
      } catch (err) {
        console.error("Error fetching skater stats:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch skater stats"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSkaterStats();
  }, [playerId, seasonId]);

  return { skaterStats, loading, error };
}

export function useWGOGoalieStats(
  goalieId: number | string,
  seasonId: string | number
) {
  const [goalieStats, setGoalieStats] = useState<WGOGoalieStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoalieStats = async () => {
      if (!goalieId || !seasonId) {
        setError("Goalie ID and Season ID are required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("wgo_goalie_stats")
          .select("*")
          .eq("goalie_id", Number(goalieId))
          .eq("season_id", Number(seasonId))
          .order("date", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        setGoalieStats(data || []);
      } catch (err) {
        console.error("Error fetching goalie stats:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch goalie stats"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchGoalieStats();
  }, [goalieId, seasonId]);

  return { goalieStats, loading, error };
}
