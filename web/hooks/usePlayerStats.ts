import { useState, useEffect } from "react";
import supabase from "lib/supabase";

interface PlayerStatsHookResult {
  gameLog: any[];
  playoffGameLog: any[]; // Add playoff game log
  seasonTotals: any[];
  playerInfo: {
    id: number;
    fullName: string;
    position: string;
    team: string;
  } | null;
  isGoalie: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePlayerStats(
  playerId: string | undefined,
  seasonId?: string
): PlayerStatsHookResult {
  const [gameLog, setGameLog] = useState<any[]>([]);
  const [playoffGameLog, setPlayoffGameLog] = useState<any[]>([]); // Add playoff state
  const [seasonTotals, setSeasonTotals] = useState<any[]>([]);
  const [playerInfo, setPlayerInfo] = useState<any>(null);
  const [isGoalie, setIsGoalie] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      setIsLoading(false);
      return;
    }

    const fetchPlayerData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First, try to fetch from skater stats to determine player type
        const { data: skaterCheck } = await supabase
          .from("wgo_skater_stats")
          .select(
            "player_id, player_name, position_code, current_team_abbreviation"
          )
          .eq("player_id", parseInt(playerId))
          .limit(1);

        let isPlayerGoalie = false;
        let playerData = null;

        if (skaterCheck && skaterCheck.length > 0) {
          // Player is a skater
          playerData = skaterCheck[0];
          isPlayerGoalie = false;
        } else {
          // Check if player is a goalie
          const { data: goalieCheck } = await supabase
            .from("wgo_goalie_stats")
            .select("goalie_id, goalie_name, position_code")
            .eq("goalie_id", parseInt(playerId))
            .limit(1);

          if (goalieCheck && goalieCheck.length > 0) {
            playerData = {
              player_id: goalieCheck[0].goalie_id,
              player_name: goalieCheck[0].goalie_name,
              position_code: goalieCheck[0].position_code,
              current_team_abbreviation: null
            };
            isPlayerGoalie = true;
          }
        }

        if (!playerData) {
          setError("Player not found");
          setIsLoading(false);
          return;
        }

        setIsGoalie(isPlayerGoalie);
        setPlayerInfo({
          id: playerData.player_id,
          fullName: playerData.player_name,
          position: playerData.position_code || "G",
          team: playerData.current_team_abbreviation || "N/A"
        });

        // Fetch regular season game log data from WGO tables
        let gameLogQuery;
        let playoffGameLogQuery;

        if (isPlayerGoalie) {
          gameLogQuery = supabase
            .from("wgo_goalie_stats")
            .select("*")
            .eq("goalie_id", parseInt(playerId))
            .order("date", { ascending: true });

          // TODO: Add playoff goalie stats table when available
          playoffGameLogQuery = null;
        } else {
          // Regular season data
          gameLogQuery = supabase
            .from("wgo_skater_stats")
            .select("*")
            .eq("player_id", parseInt(playerId))
            .order("date", { ascending: true });

          // Playoff data from wgo_skater_stats_playoffs (filter by year from season)
          playoffGameLogQuery = supabase
            .from("wgo_skater_stats_playoffs")
            .select("*")
            .eq("player_id", parseInt(playerId))
            .order("date", { ascending: true });

          // Filter playoff data by year if we have a seasonId
          if (seasonId) {
            // Extract playoff year from season ID (e.g., 20242025 -> 2025)
            const playoffYear = Math.floor(parseInt(seasonId) % 10000);
            if (playoffYear >= 2020) {
              playoffGameLogQuery = playoffGameLogQuery
                .gte("date", `${playoffYear}-01-01`)
                .lt("date", `${playoffYear + 1}-01-01`);
            }
          }
        }

        // Note: No season filter for playoff data since playoffs table has no season_id column
        if (seasonId && gameLogQuery) {
          gameLogQuery = gameLogQuery.eq("season_id", parseInt(seasonId));
        }

        // Fetch both regular season and playoff data
        const [regularSeasonResult, playoffResult] = await Promise.all([
          gameLogQuery,
          playoffGameLogQuery
        ]);

        const { data: gameLogData, error: gameLogError } = regularSeasonResult;
        const { data: playoffGameLogData, error: playoffGameLogError } =
          playoffResult || { data: [], error: null };

        if (gameLogError) {
          setError(gameLogError.message);
          setIsLoading(false);
          return;
        }

        if (playoffGameLogError) {
          console.warn(
            "Error fetching playoff data:",
            playoffGameLogError.message
          );
          // Don't fail completely, just log the warning and continue with empty playoff data
        }

        console.log("[usePlayerStats] Fetched data:", {
          regularSeasonGames: gameLogData?.length || 0,
          playoffGames: playoffGameLogData?.length || 0
        });

        let mergedGameLog: any[] = gameLogData || [];
        let mergedPlayoffGameLog: any[] = playoffGameLogData || [];

        // For skaters, fetch NST advanced stats and merge with WGO data
        if (!isPlayerGoalie && gameLogData && gameLogData.length > 0) {
          try {
            console.log(
              "[usePlayerStats] Fetching NST data for player:",
              playerId,
              "season:",
              seasonId
            );

            // Fetch NST individual advanced stats (counts)
            let nstCountsQuery = supabase
              .from("nst_gamelog_as_counts")
              .select("*")
              .eq("player_id", parseInt(playerId))
              .order("date_scraped", { ascending: true });

            if (seasonId) {
              // FIXED: use 'season' not 'season_id' for NST tables
              nstCountsQuery = nstCountsQuery.eq("season", parseInt(seasonId));
            }

            const { data: nstCountsData } = await nstCountsQuery;
            console.log(
              "[usePlayerStats] NST Counts data length:",
              nstCountsData?.length || 0
            );

            // Fetch NST on-ice advanced stats (counts)
            let nstCountsOiQuery = supabase
              .from("nst_gamelog_as_counts_oi")
              .select("*")
              .eq("player_id", parseInt(playerId))
              .order("date_scraped", { ascending: true });

            if (seasonId) {
              // FIXED: use 'season' not 'season_id' for NST tables
              nstCountsOiQuery = nstCountsOiQuery.eq(
                "season",
                parseInt(seasonId)
              );
            }

            const { data: nstCountsOiData } = await nstCountsOiQuery;
            console.log(
              "[usePlayerStats] NST Counts OI data length:",
              nstCountsOiData?.length || 0
            );

            // Create lookup maps for NST data by date
            const nstCountsMap = new Map<string, any>();
            const nstCountsOiMap = new Map<string, any>();

            // Build lookup maps using date_scraped from NST data
            nstCountsData?.forEach((game: any) => {
              nstCountsMap.set(game.date_scraped, game);
            });

            nstCountsOiData?.forEach((game: any) => {
              nstCountsOiMap.set(game.date_scraped, game);
            });

            console.log("[usePlayerStats] NST lookup maps created. Sizes:", {
              counts: nstCountsMap.size,
              countsOi: nstCountsOiMap.size
            });

            // Helper function to merge WGO and NST data
            const mergeGameWithNSTData = (wgoGame: any) => {
              const nstCounts: any = nstCountsMap.get(wgoGame.date) || {};
              const nstCountsOi: any = nstCountsOiMap.get(wgoGame.date) || {};

              // Calculate zone usage percentages if we have the raw counts
              let def_zone_start_pct = null;
              let neu_zone_start_pct = null;

              if (
                nstCounts.off_zone_starts &&
                nstCounts.neu_zone_starts &&
                nstCounts.def_zone_starts
              ) {
                const totalStarts =
                  nstCounts.off_zone_starts +
                  nstCounts.neu_zone_starts +
                  nstCounts.def_zone_starts;
                if (totalStarts > 0) {
                  def_zone_start_pct =
                    (nstCounts.def_zone_starts / totalStarts) * 100;
                  neu_zone_start_pct =
                    (nstCounts.neu_zone_starts / totalStarts) * 100;
                }
              }

              return {
                ...wgoGame,
                // Add isPlayoff flag to distinguish playoff games
                isPlayoff: wgoGame.hasOwnProperty("isPlayoff")
                  ? wgoGame.isPlayoff
                  : false,

                // NST Individual Advanced Stats - Possession Percentages
                cf_pct: nstCounts.cf_pct || null,
                ff_pct: nstCounts.ff_pct || null,
                sf_pct: nstCounts.sf_pct || null,
                gf_pct: nstCounts.gf_pct || null,
                xgf_pct: nstCounts.xgf_pct || null,
                scf_pct: nstCounts.scf_pct || null,
                hdcf_pct: nstCounts.hdcf_pct || null,
                mdcf_pct: nstCounts.mdcf_pct || null,
                ldcf_pct: nstCounts.ldcf_pct || null,

                // NST Individual Production Per 60
                ixg_per_60: nstCounts.ixg_per_60 || null,
                icf_per_60: nstCounts.icf_per_60 || null,
                iff_per_60: nstCounts.iff_per_60 || null,
                iscfs_per_60: nstCounts.iscfs_per_60 || null,
                hdcf_per_60: nstCounts.hdcf_per_60 || null,
                shots_per_60: nstCounts.shots_per_60 || null,
                goals_per_60: nstCounts.goals_per_60 || null,
                total_assists_per_60: nstCounts.total_assists_per_60 || null,
                total_points_per_60: nstCounts.total_points_per_60 || null,
                rush_attempts_per_60: nstCounts.rush_attempts_per_60 || null,
                rebounds_created_per_60:
                  nstCounts.rebounds_created_per_60 || null,

                // NST Defensive Per 60
                hdca_per_60: nstCounts.hdca_per_60 || null,
                sca_per_60: nstCounts.sca_per_60 || null,
                shots_blocked_per_60: nstCounts.shots_blocked_per_60 || null,
                xga_per_60: nstCounts.xga_per_60 || null,
                ga_per_60: nstCounts.ga_per_60 || null,

                // NST Zone Usage Percentages
                off_zone_start_pct: nstCounts.off_zone_start_pct || null,
                def_zone_start_pct: def_zone_start_pct,
                neu_zone_start_pct: neu_zone_start_pct,
                off_zone_faceoff_pct: nstCounts.off_zone_faceoff_pct || null,

                // NST On-Ice Impact
                on_ice_sh_pct: nstCounts.on_ice_sh_pct || null,
                on_ice_sv_pct: nstCounts.on_ice_sv_pct || null,
                pdo: nstCounts.pdo || null,

                // NST Discipline Per 60
                pim_per_60: nstCounts.pim_per_60 || null,
                total_penalties_per_60:
                  nstCounts.total_penalties_per_60 || null,
                penalties_drawn_per_60:
                  nstCounts.penalties_drawn_per_60 || null,
                giveaways_per_60: nstCounts.giveaways_per_60 || null,
                takeaways_per_60: nstCounts.takeaways_per_60 || null,
                hits_per_60: nstCounts.hits_per_60 || null,

                // NST Raw Counts
                ixg: nstCounts.ixg || null,
                icf: nstCounts.icf || null,
                iff: nstCounts.iff || null,
                hdcf: nstCounts.hdcf || null,
                hdca: nstCounts.hdca || null,
                rush_attempts: nstCounts.rush_attempts || null,
                rebounds_created: nstCounts.rebounds_created || null,

                // NST On-Ice Raw Counts
                cf: nstCountsOi.cf || null,
                ca: nstCountsOi.ca || null,
                ff: nstCountsOi.ff || null,
                fa: nstCountsOi.fa || null,
                sf: nstCountsOi.sf || null,
                sa: nstCountsOi.sa || null,
                gf: nstCountsOi.gf || null,
                ga: nstCountsOi.ga || null,
                xgf: nstCountsOi.xgf || null,
                xga: nstCountsOi.xga || null,
                scf: nstCountsOi.scf || null,
                sca: nstCountsOi.sca || null
              };
            };

            // Merge regular season games with NST data
            mergedGameLog = gameLogData.map(mergeGameWithNSTData);

            // Merge playoff games with NST data and mark as playoff games
            mergedPlayoffGameLog = (playoffGameLogData || []).map(
              (playoffGame: any) => ({
                ...mergeGameWithNSTData(playoffGame),
                isPlayoff: true // Explicitly mark playoff games
              })
            );

            console.log("[usePlayerStats] Merged data lengths:", {
              regularSeason: mergedGameLog.length,
              playoffs: mergedPlayoffGameLog.length
            });
          } catch (nstError) {
            console.warn("Error fetching NST data:", nstError);
            // Continue with WGO data only if NST fetch fails
            mergedPlayoffGameLog = (playoffGameLogData || []).map(
              (game: any) => ({
                ...game,
                isPlayoff: true
              })
            );
          }
        } else {
          // For goalies or when no NST data, just mark playoff games
          mergedPlayoffGameLog = (playoffGameLogData || []).map(
            (game: any) => ({
              ...game,
              isPlayoff: true
            })
          );
        }

        // Set both regular season and playoff game logs
        setGameLog(mergedGameLog);
        setPlayoffGameLog(mergedPlayoffGameLog);

        // Fetch season totals if the table exists (for future implementation)
        if (!isPlayerGoalie) {
          const { data: seasonTotalsData } = await supabase
            .from("wgo_skater_stats_totals")
            .select("*")
            .eq("player_id", parseInt(playerId))
            .order("season_id", { ascending: false });

          setSeasonTotals(seasonTotalsData || []);
        } else {
          // For goalies, we could aggregate from game log or use a totals table if it exists
          setSeasonTotals([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayerData();
  }, [playerId, seasonId]);

  return {
    gameLog,
    playoffGameLog, // Return playoff game log
    seasonTotals,
    playerInfo,
    isGoalie,
    isLoading,
    error
  };
}
