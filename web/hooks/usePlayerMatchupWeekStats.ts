import { useState, useEffect, useMemo } from "react";
import supabase from "lib/supabase";
import { PostgrestResponse } from "@supabase/supabase-js";
import { STATS_MASTER_LIST } from "lib/projectionsConfig/statsMasterList";

interface MatchupWeek {
  week: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  name?: string;
}

interface SkaterStatGameLog {
  player_id: number;
  date: string; // YYYY-MM-DD
  games_played: number | null;
  // ...other stat columns
  [key: string]: any;
}

export interface MatchupWeekStats {
  week: number;
  start_date: string;
  end_date: string;
  totalFantasyPoints: number;
  gamesPlayed: number;
  avgFantasyPoints: number | null;
}

export interface GameStatPoint {
  date: string;
  fantasyPoints: number;
  gamesPlayed: number;
}

interface UsePlayerMatchupWeekStatsProps {
  playerId: number | null;
  season: string | null; // e.g. "2023"
  fantasyPointSettings: Record<string, number>;
  isEnabled?: boolean;
}

const usePlayerMatchupWeekStats = ({
  playerId,
  season,
  fantasyPointSettings,
  isEnabled = true
}: UsePlayerMatchupWeekStatsProps) => {
  const [matchupWeeks, setMatchupWeeks] = useState<MatchupWeek[]>([]);
  const [matchupWeekStats, setMatchupWeekStats] = useState<MatchupWeekStats[]>(
    []
  );
  const [gameStatPoints, setGameStatPoints] = useState<GameStatPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize stat key mapping
  const statDbColumnMap = useMemo(() => {
    const map: Record<string, string> = {};
    STATS_MASTER_LIST.forEach((statDef) => {
      if (statDef.isSkaterStat) {
        if (statDef.key === "SHOTS_ON_GOAL") {
          map[statDef.key] = "shots";
        } else if (statDef.key === "PENALTY_MINUTES") {
          map[statDef.key] = "penalty_minutes";
        } else if (statDef.key === "BLOCKED_SHOTS") {
          map[statDef.key] = "blocked_shots";
        } else if (statDef.key === "PP_POINTS") {
          map[statDef.key] = "pp_points";
        } else if (statDef.key === "SH_POINTS") {
          map[statDef.key] = "sh_points";
        } else {
          map[statDef.key] = statDef.key.toLowerCase();
        }
      }
    });
    return map;
  }, []);

  useEffect(() => {
    if (!isEnabled || !playerId || !season) {
      setMatchupWeeks([]);
      setMatchupWeekStats([]);
      setGameStatPoints([]);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch matchup weeks for the season
        const { data: weeks, error: weeksError }: PostgrestResponse<any> =
          await supabase
            .from("yahoo_matchup_weeks")
            .select("season, week, start_date, end_date") // Changed here
            .eq("season", season)
            .order("week", { ascending: true });
        if (weeksError) throw weeksError;
        if (!weeks || weeks.length === 0)
          throw new Error("No matchup weeks found for season");
        setMatchupWeeks(weeks);

        // 2. Fetch all game logs for the player in the season
        // Use the earliest start_date and latest end_date from matchup weeks
        const minStart = weeks[0].start_date;
        const maxEnd = weeks[weeks.length - 1].end_date;
        const {
          data: gameLogs,
          error: logsError
        }: PostgrestResponse<SkaterStatGameLog> = await supabase
          .from("wgo_skater_stats")
          .select("*")
          .eq("player_id", playerId)
          .gte("date", minStart)
          .lte("date", maxEnd)
          .order("date", { ascending: true });
        if (logsError) throw logsError;

        // 3. Calculate fantasy points for each game
        const dailyPoints: GameStatPoint[] = (gameLogs || []).map((log) => {
          let fp = 0;
          for (const statKey in fantasyPointSettings) {
            const pointValue = fantasyPointSettings[statKey];
            if (pointValue === 0) continue;
            const dbColumn = statDbColumnMap[statKey];
            if (
              dbColumn &&
              log[dbColumn] !== null &&
              typeof log[dbColumn] === "number"
            ) {
              fp += log[dbColumn] * pointValue;
            }
          }
          return {
            date: log.date,
            fantasyPoints: fp,
            gamesPlayed: log.games_played || 0
          };
        });
        setGameStatPoints(dailyPoints);

        // 4. Aggregate by matchup week
        const weekStats: MatchupWeekStats[] = weeks.map((week: MatchupWeek) => {
          // Get all games in this week
          const gamesInWeek = dailyPoints.filter(
            (g) => g.date >= week.start_date && g.date <= week.end_date
          );
          const totalFP = gamesInWeek.reduce(
            (sum, g) => sum + g.fantasyPoints,
            0
          );
          const totalGP = gamesInWeek.reduce(
            (sum, g) => sum + g.gamesPlayed,
            0
          );
          return {
            week: week.week,
            start_date: week.start_date,
            end_date: week.end_date,
            totalFantasyPoints: totalFP,
            gamesPlayed: totalGP,
            avgFantasyPoints: totalGP > 0 ? totalFP / totalGP : null
          };
        });
        setMatchupWeekStats(weekStats);
      } catch (e: any) {
        setError(e.message || "An error occurred");
        setMatchupWeeks([]);
        setMatchupWeekStats([]);
        setGameStatPoints([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [
    playerId,
    season,
    JSON.stringify(fantasyPointSettings),
    isEnabled,
    statDbColumnMap
  ]);

  return { matchupWeeks, matchupWeekStats, gameStatPoints, isLoading, error };
};

export default usePlayerMatchupWeekStats;
