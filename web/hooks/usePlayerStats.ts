import { useState, useEffect } from "react";
import supabase from "lib/supabase";

interface PlayerStatsHookResult {
  gameLog: any[];
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

        // Fetch game log data from WGO tables
        let gameLogQuery;
        if (isPlayerGoalie) {
          gameLogQuery = supabase
            .from("wgo_goalie_stats")
            .select("*")
            .eq("goalie_id", parseInt(playerId))
            .order("date", { ascending: true });
        } else {
          gameLogQuery = supabase
            .from("wgo_skater_stats")
            .select("*")
            .eq("player_id", parseInt(playerId))
            .order("date", { ascending: true });
        }

        // Add season filter if provided
        if (seasonId) {
          gameLogQuery = gameLogQuery.eq("season_id", parseInt(seasonId));
        }

        const { data: gameLogData, error: gameLogError } = await gameLogQuery;

        if (gameLogError) {
          setError(gameLogError.message);
          setIsLoading(false);
          return;
        }

        let mergedGameLog: any[] = gameLogData || [];

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

            // Fetch NST individual rates (per 60)
            let nstRatesQuery = supabase
              .from("nst_gamelog_as_rates")
              .select("*")
              .eq("player_id", parseInt(playerId))
              .order("date_scraped", { ascending: true });

            if (seasonId) {
              // FIXED: use 'season' not 'season_id' for NST tables
              nstRatesQuery = nstRatesQuery.eq("season", parseInt(seasonId));
            }

            const { data: nstRatesData } = await nstRatesQuery;
            console.log(
              "[usePlayerStats] NST Rates data length:",
              nstRatesData?.length || 0
            );

            // Fetch NST on-ice rates (per 60)
            let nstRatesOiQuery = supabase
              .from("nst_gamelog_as_rates_oi")
              .select("*")
              .eq("player_id", parseInt(playerId))
              .order("date_scraped", { ascending: true });

            if (seasonId) {
              // FIXED: use 'season' not 'season_id' for NST tables
              nstRatesOiQuery = nstRatesOiQuery.eq(
                "season",
                parseInt(seasonId)
              );
            }

            const { data: nstRatesOiData } = await nstRatesOiQuery;
            console.log(
              "[usePlayerStats] NST Rates OI data length:",
              nstRatesOiData?.length || 0
            );

            // Create lookup maps for NST data by date
            const nstCountsMap = new Map<string, any>();
            const nstCountsOiMap = new Map<string, any>();
            const nstRatesMap = new Map<string, any>();
            const nstRatesOiMap = new Map<string, any>();

            // Build lookup maps using date_scraped from NST data
            nstCountsData?.forEach((game: any) => {
              nstCountsMap.set(game.date_scraped, game);
            });

            nstCountsOiData?.forEach((game: any) => {
              nstCountsOiMap.set(game.date_scraped, game);
            });

            nstRatesData?.forEach((game: any) => {
              nstRatesMap.set(game.date_scraped, game);
            });

            nstRatesOiData?.forEach((game: any) => {
              nstRatesOiMap.set(game.date_scraped, game);
            });

            console.log("[usePlayerStats] NST lookup maps created. Sizes:", {
              counts: nstCountsMap.size,
              countsOi: nstCountsOiMap.size,
              rates: nstRatesMap.size,
              ratesOi: nstRatesOiMap.size
            });

            // Merge WGO and NST data for each game
            mergedGameLog = gameLogData.map((wgoGame: any) => {
              // Use WGO game date to match with NST date_scraped (both are YYYY-MM-DD format)
              const nstCounts: any = nstCountsMap.get(wgoGame.date) || {};
              const nstCountsOi: any = nstCountsOiMap.get(wgoGame.date) || {};
              const nstRates: any = nstRatesMap.get(wgoGame.date) || {};
              const nstRatesOi: any = nstRatesOiMap.get(wgoGame.date) || {};

              // Debug logging for the first game
              if (wgoGame === gameLogData[0]) {
                console.log("[usePlayerStats] First game merge debug:", {
                  wgoDate: wgoGame.date,
                  hasNstCounts: Object.keys(nstCounts).length > 0,
                  hasNstCountsOi: Object.keys(nstCountsOi).length > 0,
                  hasNstRates: Object.keys(nstRates).length > 0,
                  hasNstRatesOi: Object.keys(nstRatesOi).length > 0,
                  sampleNstStats: {
                    // FIXED: These should come from on-ice counts (nstCountsOi)
                    cf_pct: nstCountsOi.cf_pct,
                    ff_pct: nstCountsOi.ff_pct,
                    sf_pct: nstCountsOi.sf_pct,
                    xgf_pct: nstCountsOi.xgf_pct,
                    hdcf_pct: nstCountsOi.hdcf_pct,
                    ixg_per_60: nstRates.ixg_per_60,
                    on_ice_sh_pct: nstCountsOi.on_ice_sh_pct,
                    pdo: nstCountsOi.pdo,
                    off_zone_start_pct: nstCountsOi.off_zone_start_pct,
                    off_zone_faceoff_pct: nstCountsOi.off_zone_faceoff_pct
                  }
                });
              }

              // Calculate zone usage percentages if we have the raw counts
              // FIXED: Use nstCountsOi (on-ice) instead of nstRates for zone start calculations
              let def_zone_start_pct = null;
              let neu_zone_start_pct = null;

              if (
                nstCountsOi.off_zone_starts &&
                nstCountsOi.neu_zone_starts &&
                nstCountsOi.def_zone_starts
              ) {
                const totalStarts =
                  nstCountsOi.off_zone_starts +
                  nstCountsOi.neu_zone_starts +
                  nstCountsOi.def_zone_starts;
                if (totalStarts > 0) {
                  def_zone_start_pct =
                    (nstCountsOi.def_zone_starts / totalStarts) * 100;
                  neu_zone_start_pct =
                    (nstCountsOi.neu_zone_starts / totalStarts) * 100;
                }
              }

              return {
                ...wgoGame,

                // NST On-Ice Advanced Stats - Possession Percentages (from nst_gamelog_as_counts_oi)
                // FIXED: These percentage stats come from the counts_oi table, not rates_oi
                cf_pct: nstCountsOi.cf_pct || null,
                ff_pct: nstCountsOi.ff_pct || null,
                sf_pct: nstCountsOi.sf_pct || null,
                gf_pct: nstCountsOi.gf_pct || null,
                xgf_pct: nstCountsOi.xgf_pct || null,
                scf_pct: nstCountsOi.scf_pct || null,
                hdcf_pct: nstCountsOi.hdcf_pct || null,
                mdcf_pct: nstCountsOi.mdcf_pct || null,
                ldcf_pct: nstCountsOi.ldcf_pct || null,

                // NST Individual Production Per 60 (from nst_gamelog_as_rates)
                ixg_per_60: nstRates.ixg_per_60 || null,
                icf_per_60: nstRates.icf_per_60 || null,
                iff_per_60: nstRates.iff_per_60 || null,
                iscfs_per_60: nstRates.iscfs_per_60 || null,
                hdcf_per_60: nstRates.hdcf_per_60 || null,
                shots_per_60: nstRates.shots_per_60 || null,
                goals_per_60: nstRates.goals_per_60 || null,
                total_assists_per_60: nstRates.total_assists_per_60 || null,
                total_points_per_60: nstRates.total_points_per_60 || null,
                rush_attempts_per_60: nstRates.rush_attempts_per_60 || null,
                rebounds_created_per_60:
                  nstRates.rebounds_created_per_60 || null,

                // NST Defensive Per 60 (from nst_gamelog_as_rates)
                hdca_per_60: nstRates.hdca_per_60 || null,
                sca_per_60: nstRates.sca_per_60 || null,
                shots_blocked_per_60: nstRates.shots_blocked_per_60 || null,
                xga_per_60: nstRates.xga_per_60 || null,
                ga_per_60: nstRates.ga_per_60 || null,

                // NST Zone Usage Percentages (from nst_gamelog_as_counts_oi)
                // FIXED: Use direct mapping from counts_oi table and calculated percentages
                off_zone_start_pct: nstCountsOi.off_zone_start_pct || null,
                def_zone_start_pct: def_zone_start_pct,
                neu_zone_start_pct: neu_zone_start_pct,
                off_zone_faceoff_pct: nstCountsOi.off_zone_faceoff_pct || null,

                // NST On-Ice Impact (from nst_gamelog_as_counts_oi)
                on_ice_sh_pct: nstCountsOi.on_ice_sh_pct || null,
                on_ice_sv_pct: nstCountsOi.on_ice_sv_pct || null,
                // FIXED: PDO should come from counts_oi stats and be handled properly
                pdo: nstCountsOi.pdo || null,

                // NST Discipline Per 60 (from nst_gamelog_as_rates)
                pim_per_60: nstRates.pim_per_60 || null,
                total_penalties_per_60: nstRates.total_penalties_per_60 || null,
                penalties_drawn_per_60: nstRates.penalties_drawn_per_60 || null,
                giveaways_per_60: nstRates.giveaways_per_60 || null,
                takeaways_per_60: nstRates.takeaways_per_60 || null,
                hits_per_60: nstRates.hits_per_60 || null,

                // NST Raw Counts (for reference, from nst_gamelog_as_counts)
                ixg: nstCounts.ixg || null,
                icf: nstCounts.icf || null,
                iff: nstCounts.iff || null,
                hdcf: nstCounts.hdcf || null,
                hdca: nstCounts.hdca || null,
                rush_attempts: nstCounts.rush_attempts || null,
                rebounds_created: nstCounts.rebounds_created || null,

                // NST On-Ice Raw Counts (from nst_gamelog_as_counts_oi)
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
            });

            console.log(
              "[usePlayerStats] Merged game log length:",
              mergedGameLog.length
            );
            if (mergedGameLog.length > 0) {
              const firstGame = mergedGameLog[0];
              const advancedStatsCount = Object.keys(firstGame).filter(
                (key) =>
                  key.includes("_per_60") ||
                  key.includes("_pct") ||
                  key.includes("cf_") ||
                  key.includes("ff_") ||
                  key.includes("xg") ||
                  key.includes("pdo")
              ).length;
              console.log(
                "[usePlayerStats] Advanced stats found in merged data:",
                advancedStatsCount
              );

              // Sample a few key advanced stats to verify they're being populated
              const sampleStats = {
                cf_pct: firstGame.cf_pct,
                ixg_per_60: firstGame.ixg_per_60,
                hdcf_pct: firstGame.hdcf_pct,
                pdo: firstGame.pdo,
                on_ice_sh_pct: firstGame.on_ice_sh_pct
              };
              console.log(
                "[usePlayerStats] Sample advanced stats from first game:",
                sampleStats
              );
            }
          } catch (nstError) {
            console.warn("Error fetching NST data:", nstError);
            // Continue with WGO data only if NST fetch fails
          }
        }

        // Set the merged game log to state (this was missing!)
        setGameLog(mergedGameLog);

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
    seasonTotals,
    playerInfo,
    isGoalie,
    isLoading,
    error
  };
}
