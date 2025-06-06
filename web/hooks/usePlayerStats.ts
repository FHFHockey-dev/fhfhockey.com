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
            // Fetch NST individual advanced stats (counts)
            let nstCountsQuery = supabase
              .from("nst_gamelog_as_counts")
              .select("*")
              .eq("player_id", parseInt(playerId))
              .order("date_scraped", { ascending: true });

            if (seasonId) {
              nstCountsQuery = nstCountsQuery.eq(
                "season_id",
                parseInt(seasonId)
              );
            }

            const { data: nstCountsData } = await nstCountsQuery;

            // Fetch NST on-ice advanced stats (counts)
            let nstCountsOiQuery = supabase
              .from("nst_gamelog_as_counts_oi")
              .select("*")
              .eq("player_id", parseInt(playerId))
              .order("date_scraped", { ascending: true });

            if (seasonId) {
              nstCountsOiQuery = nstCountsOiQuery.eq(
                "season_id",
                parseInt(seasonId)
              );
            }

            const { data: nstCountsOiData } = await nstCountsOiQuery;

            // Fetch NST individual rates (per 60)
            let nstRatesQuery = supabase
              .from("nst_gamelog_as_rates")
              .select("*")
              .eq("player_id", parseInt(playerId))
              .order("date_scraped", { ascending: true });

            if (seasonId) {
              nstRatesQuery = nstRatesQuery.eq("season_id", parseInt(seasonId));
            }

            const { data: nstRatesData } = await nstRatesQuery;

            // Fetch NST on-ice rates (per 60)
            let nstRatesOiQuery = supabase
              .from("nst_gamelog_as_rates_oi")
              .select("*")
              .eq("player_id", parseInt(playerId))
              .order("date_scraped", { ascending: true });

            if (seasonId) {
              nstRatesOiQuery = nstRatesOiQuery.eq(
                "season_id",
                parseInt(seasonId)
              );
            }

            const { data: nstRatesOiData } = await nstRatesOiQuery;

            // Create lookup maps for NST data by date_scraped
            const nstCountsMap = new Map();
            const nstCountsOiMap = new Map();
            const nstRatesMap = new Map();
            const nstRatesOiMap = new Map();

            nstCountsData?.forEach((game) => {
              nstCountsMap.set(game.date_scraped, game);
            });

            nstCountsOiData?.forEach((game) => {
              nstCountsOiMap.set(game.date_scraped, game);
            });

            nstRatesData?.forEach((game) => {
              nstRatesMap.set(game.date_scraped, game);
            });

            nstRatesOiData?.forEach((game) => {
              nstRatesOiMap.set(game.date_scraped, game);
            });

            // Merge WGO and NST data for each game
            mergedGameLog = gameLogData.map((wgoGame: any) => {
              const nstCounts = nstCountsMap.get(wgoGame.date) || {};
              const nstCountsOi = nstCountsOiMap.get(wgoGame.date) || {};
              const nstRates = nstRatesMap.get(wgoGame.date) || {};
              const nstRatesOi = nstRatesOiMap.get(wgoGame.date) || {};

              return {
                ...wgoGame,
                // NST Individual Advanced Stats - Possession Percentages
                cf_pct: nstRates.cf_pct || null,
                ff_pct: nstRates.ff_pct || null,
                sf_pct: nstRates.sf_pct || null,
                gf_pct: nstRates.gf_pct || null,
                xgf_pct: nstRates.xgf_pct || null,
                scf_pct: nstRates.scf_pct || null,
                hdcf_pct: nstRates.hdcf_pct || null,
                mdcf_pct: nstRates.mdcf_pct || null,
                ldcf_pct: nstRates.ldcf_pct || null,

                // NST Individual Production Per 60
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

                // NST Defensive Per 60
                hdca_per_60: nstRates.hdca_per_60 || null,
                sca_per_60: nstRates.sca_per_60 || null,
                shots_blocked_per_60: nstRates.shots_blocked_per_60 || null,
                xga_per_60: nstRates.xga_per_60 || null,
                ga_per_60: nstRates.ga_per_60 || null,

                // NST Zone Usage Percentages
                off_zone_start_pct: nstRates.off_zone_start_pct || null,
                def_zone_start_pct: nstRates.def_zone_start_pct || null,
                neu_zone_start_pct: nstRates.neu_zone_start_pct || null,
                off_zone_faceoff_pct: nstRates.off_zone_faceoff_pct || null,

                // NST On-Ice Impact
                on_ice_sh_pct: nstRatesOi.on_ice_sh_pct || null,
                on_ice_sv_pct: nstRatesOi.on_ice_sv_pct || null,
                pdo: nstRatesOi.pdo || null,

                // NST Discipline Per 60
                pim_per_60: nstRates.pim_per_60 || null,
                total_penalties_per_60: nstRates.total_penalties_per_60 || null,
                penalties_drawn_per_60: nstRates.penalties_drawn_per_60 || null,
                giveaways_per_60: nstRates.giveaways_per_60 || null,
                takeaways_per_60: nstRates.takeaways_per_60 || null,
                hits_per_60: nstRates.hits_per_60 || null,

                // NST Raw Counts (for reference)
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
            });
          } catch (nstError) {
            console.warn("Error fetching NST data:", nstError);
            // Continue with WGO data only if NST fetch fails
          }
        }

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
