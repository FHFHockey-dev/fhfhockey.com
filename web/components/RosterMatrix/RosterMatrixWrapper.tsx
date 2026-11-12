import React, { useState, useEffect, useCallback } from "react";
import { RosterMatrix } from "./RosterMatrix";
import supabase from "../../lib/supabase";
import useCurrentSeason from "../../hooks/useCurrentSeason";
import {
  aggregateNstGoalieGamelog,
  buildRosterPlayer,
  type PlayerData
} from "./rosterMatrixData";

// Team mapping from the database
const TEAM_MAPPING: Record<number, { abbrev: string; name: string }> = {
  1: { abbrev: "NJD", name: "New Jersey Devils" },
  2: { abbrev: "NYI", name: "New York Islanders" },
  3: { abbrev: "NYR", name: "New York Rangers" },
  4: { abbrev: "PHI", name: "Philadelphia Flyers" },
  5: { abbrev: "PIT", name: "Pittsburgh Penguins" },
  6: { abbrev: "BOS", name: "Boston Bruins" },
  7: { abbrev: "BUF", name: "Buffalo Sabres" },
  8: { abbrev: "MTL", name: "Montreal Canadiens" },
  9: { abbrev: "OTT", name: "Ottawa Senators" },
  10: { abbrev: "TOR", name: "Toronto Maple Leafs" },
  12: { abbrev: "CAR", name: "Carolina Hurricanes" },
  13: { abbrev: "FLA", name: "Florida Panthers" },
  14: { abbrev: "TBL", name: "Tampa Bay Lightning" },
  15: { abbrev: "WSH", name: "Washington Capitals" },
  16: { abbrev: "CHI", name: "Chicago Blackhawks" },
  17: { abbrev: "DET", name: "Detroit Red Wings" },
  18: { abbrev: "NSH", name: "Nashville Predators" },
  19: { abbrev: "STL", name: "St. Louis Blues" },
  20: { abbrev: "CGY", name: "Calgary Flames" },
  21: { abbrev: "COL", name: "Colorado Avalanche" },
  22: { abbrev: "EDM", name: "Edmonton Oilers" },
  23: { abbrev: "VAN", name: "Vancouver Canucks" },
  24: { abbrev: "ANA", name: "Anaheim Ducks" },
  25: { abbrev: "DAL", name: "Dallas Stars" },
  26: { abbrev: "LAK", name: "Los Angeles Kings" },
  28: { abbrev: "SJS", name: "San Jose Sharks" },
  29: { abbrev: "CBJ", name: "Columbus Blue Jackets" },
  30: { abbrev: "MIN", name: "Minnesota Wild" },
  52: { abbrev: "WPG", name: "Winnipeg Jets" },
  53: { abbrev: "ARI", name: "Arizona Coyotes" },
  54: { abbrev: "VGK", name: "Vegas Golden Knights" },
  55: { abbrev: "SEA", name: "Seattle Kraken" },
  56: { abbrev: "UTA", name: "Utah Hockey Club" }
};

// Position type that matches the database
type Position = "C" | "LW" | "RW" | "D" | "G";

// Define the type for database position values
type DatabasePositionValue = "C" | "L" | "R" | "D" | "G";

// Map Position to database values
const POSITION_MAPPING: Record<Position, DatabasePositionValue> = {
  C: "C",
  LW: "L", // Map LW to L for database
  RW: "R", // Map RW to R for database
  D: "D",
  G: "G"
};

interface RosterMatrixWrapperProps {
  teamId?: string;
  teamAbbrev?: string;
  seasonId?: string;
}

export default function RosterMatrixWrapper({
  teamId,
  teamAbbrev,
  seasonId
}: RosterMatrixWrapperProps) {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentSeason = useCurrentSeason();

  // Use provided seasonId or fall back to current season
  const effectiveSeasonId =
    seasonId || currentSeason?.seasonId?.toString() || "20242025";

  const fetchPlayers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!teamId) {
        setError("Team ID is required");
        return;
      }

      console.log(
        "Fetching players for team:",
        teamId,
        "season:",
        effectiveSeasonId
      );

      // Get team roster from players table using correct column names
      const { data: rosterData, error: rosterError } = await supabase
        .from("players")
        .select(
          `
          id,
          fullName,
          position,
          team_id,
          sweater_number,
          birthDate,
          heightInCentimeters,
          weightInKilograms
        `
        )
        .eq("team_id", parseInt(teamId));

      if (rosterError) {
        console.error("Error fetching roster:", rosterError);
        setError(`Failed to fetch roster: ${rosterError.message}`);
        return;
      }

      if (!rosterData || rosterData.length === 0) {
        console.log("No roster data found for team:", teamId);
        setPlayers([]);
        return;
      }

      console.log("Found roster players:", rosterData.length);

      // Get player IDs for stat queries
      const playerIds = rosterData.map((p) => p.id).filter(Boolean);
      console.log("Player IDs for stats lookup:", playerIds.length);

      // Fetch season totals for basic stats from wgo_skater_stats_totals
      const { data: skaterStatsData, error: skaterError } = await supabase
        .from("wgo_skater_stats_totals")
        .select(
          `
          player_id,
          games_played,
          goals,
          assists,
          points,
          plus_minus,
          penalty_minutes,
          shots,
          shooting_percentage,
          toi_per_game,
          pp_toi_per_game,
          shoots_catches,
          season
        `
        )
        .in("player_id", playerIds)
        .eq("season", effectiveSeasonId);

      if (skaterError) {
        console.error("Error fetching skater stats:", skaterError);
      }

      console.log("Skater stats data found:", skaterStatsData?.length || 0);

      // Create map of player stats
      const skaterStatsMap = new Map();
      skaterStatsData?.forEach((stat) => {
        skaterStatsMap.set(stat.player_id, stat);
      });

      // Fetch season totals for advanced stats from nst_seasonlong_as_counts (all situations)
      const { data: advancedCountsData, error: advancedCountsError } =
        await supabase
          .from("nst_seasonlong_as_counts")
          .select(
            `
          player_id,
          season,
          gp,
          toi_seconds,
          goals,
          total_assists,
          total_points,
          shots,
          ixg,
          pim
        `
          )
          .in("player_id", playerIds)
          .eq("season", parseInt(effectiveSeasonId));

      if (advancedCountsError) {
        console.error("Error fetching advanced counts:", advancedCountsError);
      }

      // Create map of advanced counts
      const advancedCountsMap = new Map();
      advancedCountsData?.forEach((stat) => {
        advancedCountsMap.set(stat.player_id, stat);
      });

      // Fetch on-ice stats for percentages from nst_seasonlong_as_rates_oi
      const { data: onIceStatsData, error: onIceError } = await supabase
        .from("nst_seasonlong_as_rates_oi")
        .select(
          `
          player_id,
          season,
          cf_pct,
          ff_pct,
          sf_pct,
          gf_pct,
          xgf_pct,
          hdcf_pct,
          pdo
        `
        )
        .in("player_id", playerIds)
        .eq("season", parseInt(effectiveSeasonId));

      if (onIceError) {
        console.error("Error fetching on-ice stats:", onIceError);
      }

      // Create map of on-ice stats
      const onIceStatsMap = new Map();
      onIceStatsData?.forEach((stat) => {
        onIceStatsMap.set(stat.player_id, stat);
      });

      // Fetch per-60 stats from nst_seasonlong_as_rates
      const { data: ratesData, error: ratesError } = await supabase
        .from("nst_seasonlong_as_rates")
        .select(
          `
          player_id,
          season,
          total_points_per_60,
          ixg_per_60
        `
        )
        .in("player_id", playerIds)
        .eq("season", parseInt(effectiveSeasonId));

      if (ratesError) {
        console.error("Error fetching rates data:", ratesError);
      }

      // Create map of rates stats
      const ratesStatsMap = new Map();
      ratesData?.forEach((stat) => {
        ratesStatsMap.set(stat.player_id, stat);
      });

      // Fetch goalie stats from wgo_goalie_stats_totals
      const { data: goalieStatsData, error: goalieError } = await supabase
        .from("wgo_goalie_stats_totals")
        .select(
          `
          goalie_id,
          games_played,
          games_started,
          wins,
          losses,
          ot_losses,
          save_pct,
          saves,
          goals_against,
          goals_against_avg,
          shots_against,
          time_on_ice,
          shutouts,
          goals,
          assists,
          shoots_catches,
          quality_start,
          quality_starts_pct,
          regulation_wins,
          regulation_losses,
          complete_games,
          complete_game_pct,
          season_id
        `
        )
        .in("goalie_id", playerIds)
        .eq("season_id", parseInt(effectiveSeasonId));

      if (goalieError) {
        console.error("Error fetching goalie stats:", goalieError);
      }

      // Create map of goalie stats
      const goalieStatsMap = new Map();
      goalieStatsData?.forEach((stat) => {
        goalieStatsMap.set(stat.goalie_id, stat);
      });

      // For goalies without season totals, aggregate from gamelog data
      const goalieIds = rosterData
        .filter((p) => p.position === "G")
        .map((p) => p.id);
      let aggregatedGoalieStats = new Map();

      if (goalieIds.length > 0) {
        // Fetch all gamelog data for goalies and aggregate
        const { data: goalieGamelogData, error: goalieGamelogError } =
          await supabase
            .from("nst_gamelog_goalie_all_counts")
            .select(
              `
            player_id,
            season,
            gp,
            toi,
            shots_against,
            saves,
            goals_against,
            xg_against,
            hd_shots_against,
            hd_saves,
            md_shots_against,
            md_saves
          `
            )
            .in("player_id", goalieIds)
            .eq("season", parseInt(effectiveSeasonId));

        if (goalieGamelogError) {
          console.error(
            "Error fetching goalie gamelog data:",
            goalieGamelogError
          );
        }

        // Pooled fallback season line (minutes adapter, no per-game GSAA sum)
        aggregatedGoalieStats = aggregateNstGoalieGamelog(
          goalieGamelogData ?? []
        );
      }

      console.log(
        "Stats found - Skater:",
        skaterStatsMap.size,
        "Advanced:",
        advancedCountsMap.size,
        "OnIce:",
        onIceStatsMap.size,
        "Rates:",
        ratesStatsMap.size,
        "Goalie:",
        goalieStatsMap.size,
        "Aggregated Goalie:",
        aggregatedGoalieStats.size
      );

      // Transform and combine all data using proper player data
      const transformedPlayers: PlayerData[] = rosterData.map((player) =>
        buildRosterPlayer(player, {
          skaterStat: skaterStatsMap.get(player.id),
          advancedStat: advancedCountsMap.get(player.id),
          onIceStat: onIceStatsMap.get(player.id),
          ratesStat: ratesStatsMap.get(player.id),
          goalieStat:
            goalieStatsMap.get(player.id) ||
            aggregatedGoalieStats.get(player.id)
        })
      );

      console.log("Transformed players with stats:", transformedPlayers.length);

      // Log sample of player data for debugging
      const samplePlayer =
        transformedPlayers.find((p) => p.goals && p.goals > 0) ||
        transformedPlayers[0];
      if (samplePlayer) {
        console.log("Sample player data:", {
          name: samplePlayer.nhl_player_name,
          position: samplePlayer.mapped_position,
          games: samplePlayer.games_played,
          goals: samplePlayer.goals,
          assists: samplePlayer.assists,
          points: samplePlayer.points,
          cf_pct: samplePlayer.cf_pct,
          total_points_per_60: samplePlayer.total_points_per_60,
          ixg_per_60: samplePlayer.ixg_per_60
        });
      }

      setPlayers(transformedPlayers);
    } catch (err) {
      console.error("Error in fetchPlayers:", err);
      setError(
        `An unexpected error occurred: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [teamId, effectiveSeasonId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  return (
    <RosterMatrix
      players={players}
      teamAbbreviation={teamAbbrev || ""}
      isLoading={isLoading}
      error={error}
    />
  );
}
