// lib/hooks/useProcessedProjectionsData.tsx

import { useState, useEffect, useRef } from "react";
import { SupabaseClient, PostgrestResponse } from "@supabase/supabase-js"; // prettier-ignore
import { ColumnDef, RowData, SortingFnOption } from "@tanstack/react-table";

// Configuration Imports
import {
  STATS_MASTER_LIST,
  StatDefinition
} from "lib/projectionsConfig/statsMasterList";
import {
  PROJECTION_SOURCES_CONFIG,
  ProjectionSourceConfig
} from "lib/projectionsConfig/projectionSourcesConfig";
import {
  YAHOO_DRAFT_ANALYSIS_KEYS,
  YAHOO_PLAYER_MAP_KEYS,
  YAHOO_PLAYERS_TABLE_KEYS
} from "lib/projectionsConfig/yahooConfig";

// --- Types ---
interface RawPlayerStatFromSource {
  value: number | null;
  sourceId: string;
  sourceDisplayName: string;
  weight: number;
}

export interface AggregatedStatValue {
  value: number | null;
  contributingSources: Array<{
    name: string;
    weight: number;
    value: number | null;
  }>;
  missingFromSelectedSources: string[];
  statDefinition: StatDefinition;
}

export interface ProcessedPlayer {
  playerId: number;
  fullName: string;
  displayTeam: string | null;
  displayPosition: string | null;

  // New structure for combined stats
  combinedStats: Record<
    StatDefinition["key"],
    {
      projected: number | null;
      actual: number | null;
      diffPercentage: number | null;
      projectedDetail: AggregatedStatValue; // Original projection details
    }
  >;

  // Fantasy Points - also with projected, actual, diff
  fantasyPoints: {
    projected: number | null;
    actual: number | null;
    diffPercentage: number | null;
  };

  // Yahoo data (existing)
  yahooPlayerId?: string;
  yahooAvgPick?: number | null;
  yahooAvgRound?: number | null;
  yahooPctDrafted?: number | null;

  // Overall Ranks (across skaters & goalies)
  projectedRank?: number | null;
  actualRank?: number | null;
}

// Interface for the new round summary rows
export interface RoundSummaryRow {
  id: string; // Unique ID, e.g., "summary-round-1"
  type: "summary";
  roundNumber: number;
  fantasyPoints: {
    projected: null; // Not displaying summed FPs for now, could be added
    actual: null; // Not displaying summed FPs for now, could be added
    diffPercentage: number | null; // The key summary value for the round
  };
  // Fields to make it somewhat compatible with ProcessedPlayer for column definitions
  // These will mostly be null or placeholder for summary rows.
  playerId: string; // Can be the same as id
  fullName: string; // e.g., "Round 1 Summary"
  displayTeam: null;
  displayPosition: null;
  combinedStats: Record<string, any>; // Empty or placeholder
  yahooAvgPick?: number | null; // Set to sort summary row after players of its round
  // other ProcessedPlayer fields can be undefined or null
}

export type TableDataRow = ProcessedPlayer | RoundSummaryRow;

export interface UseProcessedProjectionsDataProps {
  activePlayerType: "skater" | "goalie";
  sourceControls: Record<string, { isSelected: boolean; weight: number }>;
  yahooDraftMode: "ALL" | "PRESEASON";
  fantasyPointSettings: Record<string, number>;
  supabaseClient: SupabaseClient<any, "public">; // Expect non-null from page
  currentSeasonId?: string; // Added to accept the current season ID
  styles: Record<string, string>; // To pass CSS Modules styles object
}

export interface UseProcessedProjectionsDataReturn {
  processedPlayers: TableDataRow[]; // Updated to be a union type
  tableColumns: ColumnDef<TableDataRow, any>[]; // Updated for union type
  isLoading: boolean;
  error: string | null;
}

// --- Cache Type Definitions ---
interface BaseCacheSnapshotInfo {
  sourceControlsSnapshot: string;
  yahooModeSnapshot: "ALL" | "PRESEASON";
  currentSeasonIdSnapshot?: string; // For caching based on season
}

interface CachedBasePlayerData extends BaseCacheSnapshotInfo {
  data: ProcessedPlayer[]; // Player data after main aggregation (projections, actuals, initial FPs)
  // but before round summaries are injected.
  columns: ColumnDef<TableDataRow, any>[]; // Columns are designed to handle TableDataRow from the start.
}

interface CachedFullPlayerData extends BaseCacheSnapshotInfo {
  data: TableDataRow[]; // Fully processed data including round summaries and final FPs.
  columns: ColumnDef<TableDataRow, any>[]; // Same columns as base, designed for TableDataRow.
  fantasyPointSettingsSnapshot: string; // Specific to the fully calculated FP data
}

interface RawProjectionSourcePlayer extends Record<string, any> {}
interface YahooNhlPlayerMapEntry extends Record<string, any> {}

// Augment ColumnMeta for custom properties
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    columnType?: "text" | "numeric" | "custom";
    higherIsBetter?: boolean;
    isDiffCell?: boolean; // Marker for diff cells that need full background
  }
}
interface YahooPlayerDetailData extends Record<string, any> {} // Keep as is
interface ActualPlayerStatsRow extends Record<string, any> {
  current_team_abbreviation?: string | null; // Add specific known field
}

// --- Constants for Actual Stats ---
const ACTUAL_SKATER_STATS_TABLE = "wgo_skater_stats_totals";
const ACTUAL_GOALIE_STATS_TABLE = "wgo_goalie_stats_totals";
const ACTUAL_STATS_COLUMN_MAP: Record<
  "skater" | "goalie",
  Partial<Record<StatDefinition["key"], string>>
> = {
  skater: {
    GAMES_PLAYED: "games_played",
    GOALS: "goals",
    ASSISTS: "assists",
    POINTS: "points",
    PLUS_MINUS: "plus_minus",
    SHOTS_ON_GOAL: "shots",
    HITS: "hits",
    BLOCKED_SHOTS: "blocked_shots",
    PENALTY_MINUTES: "penalty_minutes",
    PP_POINTS: "pp_points",
    PP_GOALS: "pp_goals",
    PP_ASSISTS: "pp_assists",
    SH_POINTS: "sh_points",
    TIME_ON_ICE_PER_GAME: "toi_per_game", // Assumed in seconds from DB
    FACEOFFS_WON: "total_fow",
    FACEOFFS_LOST: "total_fol"
  },
  goalie: {
    GAMES_PLAYED: "games_played",
    WINS_GOALIE: "wins",
    LOSSES_GOALIE: "losses",
    OTL_GOALIE: "ot_losses",
    SAVES_GOALIE: "saves",
    SHOTS_AGAINST_GOALIE: "shots_against",
    GOALS_AGAINST_GOALIE: "goals_against",
    GOALS_AGAINST_AVERAGE: "goals_against_avg",
    SAVE_PERCENTAGE: "save_pct", // Assumed decimal like 0.915
    SHUTOUTS_GOALIE: "shutouts"
  }
};

function calculateDiffPercentage(
  actual: number | null | undefined,
  projected: number | null | undefined
): number | null {
  if (actual == null || projected == null) return null;
  if (projected === 0) {
    if (actual === 0) return 0;
    return actual > 0 ? 99999 : -99999; // Special value for "infinite" percentage
  }
  return ((actual - projected) / projected) * 100;
}

// --- Helper function for paginated Supabase fetches ---
const SUPABASE_PAGE_SIZE = 1000;

async function fetchAllSupabaseData<T extends Record<string, any>>(
  queryBuilder: any,
  selectString: string
): Promise<T[]> {
  let allData: T[] = [];
  let offset = 0;
  let keepFetching = true;
  let page = 0;

  while (keepFetching) {
    const { data, error }: PostgrestResponse<T> = await queryBuilder
      .select(selectString)
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Supabase query failed (page ${page + 1}): ${error.message}`
      );
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
    }

    if (!data || data.length < SUPABASE_PAGE_SIZE) {
      keepFetching = false;
    } else {
      offset += SUPABASE_PAGE_SIZE;
      page++;
    }
  }
  return allData;
}

// Helper function to add round summaries to a list of processed players
function addRoundSummariesToPlayers(
  sortedPlayers: ProcessedPlayer[],
  calculateDiffFn: (
    actual: number | null | undefined,
    projected: number | null | undefined
  ) => number | null
): TableDataRow[] {
  const finalTableDataWithSummaries: TableDataRow[] = [];
  let currentRoundPlayersBuffer: ProcessedPlayer[] = [];
  let currentRoundNum = 0; // 0 means unranked or before first round

  for (const player of sortedPlayers) {
    const avgPick = player.yahooAvgPick;
    let playerRound = 0;
    if (avgPick != null && avgPick > 0) {
      // Use != null to check for both null and undefined
      playerRound = Math.ceil(avgPick / 12);
    }

    if (
      playerRound !== currentRoundNum &&
      currentRoundPlayersBuffer.length > 0
    ) {
      // End of a round (currentRoundNum must be > 0 here)
      let roundTotalProjectedFP = 0;
      let roundTotalActualFP = 0;
      currentRoundPlayersBuffer.forEach((p) => {
        if (p.fantasyPoints.projected !== null)
          roundTotalProjectedFP += p.fantasyPoints.projected;
        if (p.fantasyPoints.actual !== null)
          roundTotalActualFP += p.fantasyPoints.actual;
      });
      const roundDiffPercentage = calculateDiffFn(
        roundTotalActualFP,
        roundTotalProjectedFP
      );

      finalTableDataWithSummaries.push(...currentRoundPlayersBuffer);
      finalTableDataWithSummaries.push({
        id: `summary-round-${currentRoundNum}`,
        type: "summary",
        roundNumber: currentRoundNum,
        fantasyPoints: {
          projected: null,
          actual: null,
          diffPercentage: roundDiffPercentage
        },
        playerId: `summary-round-${currentRoundNum}`,
        fullName: `Round ${currentRoundNum} Summary`,
        displayTeam: null,
        displayPosition: null,
        combinedStats: {},
        yahooAvgPick: currentRoundNum * 12 + 0.00001 // Sorts summary just after its round players
      });
      currentRoundPlayersBuffer = [];
    }

    currentRoundNum = playerRound; // Update to the current player's round
    if (playerRound > 0) {
      // Only buffer players that belong to a round
      currentRoundPlayersBuffer.push(player);
    } else {
      // Players not in a round (e.g. ADP null or 0) are added directly
      finalTableDataWithSummaries.push(player);
    }
  }

  // Add the last buffered round's players and summary (if any)
  if (currentRoundPlayersBuffer.length > 0 && currentRoundNum > 0) {
    let roundTotalProjectedFP = 0;
    let roundTotalActualFP = 0;
    currentRoundPlayersBuffer.forEach((p) => {
      if (p.fantasyPoints.projected !== null)
        roundTotalProjectedFP += p.fantasyPoints.projected;
      if (p.fantasyPoints.actual !== null)
        roundTotalActualFP += p.fantasyPoints.actual;
    });
    const roundDiffPercentage = calculateDiffFn(
      roundTotalActualFP,
      roundTotalProjectedFP
    );
    finalTableDataWithSummaries.push(...currentRoundPlayersBuffer);
    finalTableDataWithSummaries.push({
      id: `summary-round-${currentRoundNum}`,
      type: "summary",
      roundNumber: currentRoundNum,
      fantasyPoints: {
        projected: null,
        actual: null,
        diffPercentage: roundDiffPercentage
      },
      playerId: `summary-round-${currentRoundNum}`,
      fullName: `Round ${currentRoundNum} Summary`,
      displayTeam: null,
      displayPosition: null,
      combinedStats: {},
      yahooAvgPick: currentRoundNum * 12 + 0.00001
    });
  }
  return finalTableDataWithSummaries;
}

export const useProcessedProjectionsData = ({
  activePlayerType,
  sourceControls,
  yahooDraftMode,
  supabaseClient,
  fantasyPointSettings,
  currentSeasonId,
  styles // Destructure styles
}: UseProcessedProjectionsDataProps): UseProcessedProjectionsDataReturn => {
  const [processedPlayers, setProcessedPlayers] = useState<TableDataRow[]>([]);
  const [tableColumns, setTableColumns] = useState<
    ColumnDef<TableDataRow, any>[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cache = useRef<{
    skater?: {
      base?: CachedBasePlayerData;
      full?: CachedFullPlayerData;
    };
    goalie?: {
      base?: CachedBasePlayerData;
      full?: CachedFullPlayerData;
    };
  }>({});

  useEffect(() => {
    // Always call this effect, but handle missing args inside
    if (!supabaseClient || !currentSeasonId) {
      setError("Supabase client or current season ID not available in hook.");
      setProcessedPlayers([]);
      setTableColumns([]);
      setIsLoading(false);
      return;
    }

    const fetchDataAndProcess = async () => {
      // --- Cache Check ---
      const stringifiedSourceControls = JSON.stringify(sourceControls);
      const stringifiedFantasyPointSettings =
        JSON.stringify(fantasyPointSettings);
      const cacheTypeKey = activePlayerType; // 'skater' or 'goalie'

      // Ensure cache structure for current player type exists
      if (!cache.current[cacheTypeKey]) {
        cache.current[cacheTypeKey] = {};
      }
      const currentTypeCache = cache.current[cacheTypeKey]!;

      // --- Full Cache Check (all settings match) ---
      if (
        currentTypeCache.full &&
        currentTypeCache.full.sourceControlsSnapshot ===
          stringifiedSourceControls &&
        currentTypeCache.full.yahooModeSnapshot === yahooDraftMode &&
        currentTypeCache.full.currentSeasonIdSnapshot === currentSeasonId && // Check season
        currentTypeCache.full.fantasyPointSettingsSnapshot === // Check fantasy settings last
          stringifiedFantasyPointSettings
      ) {
        // Full cache hit, use it directly
        setProcessedPlayers(currentTypeCache.full.data);
        setTableColumns(currentTypeCache.full.columns);
        setIsLoading(false);
        setError(null);
        // console.log(`[Cache] Full hit for ${cacheTypeKey}`);
        return; // Skip fetching and processing
      }

      // --- Base Cache Check (sourceControls & yahooMode match, but fantasyPointSettings differ) ---
      if (
        currentTypeCache.base &&
        currentTypeCache.base.sourceControlsSnapshot ===
          stringifiedSourceControls &&
        currentTypeCache.base.yahooModeSnapshot === yahooDraftMode &&
        currentTypeCache.base.currentSeasonIdSnapshot === currentSeasonId // Check season
        // Implicitly, fantasyPointSettingsSnapshot is different, or full cache would have hit
      ) {
        // Base data cache hit! Only fantasy points need recalculation.
        // console.log(`[Cache] Base hit for ${cacheTypeKey}. Recalculating FPs.`);
        setIsLoading(true); // Still show loading as FP recalc can take a moment for many players
        setError(null);

        const basePlayers = currentTypeCache.base.data; // Data from a previous full run
        const newPlayersWithRecalculatedFP = basePlayers.map((player) => {
          let calculatedProjectedFantasyPoints = 0;
          let calculatedActualFantasyPoints = 0;
          let hasValidStatForFP = false;

          for (const statKey in player.combinedStats) {
            const combinedStat = player.combinedStats[statKey];
            const pointValueForStat = fantasyPointSettings[statKey]; // Use NEW settings

            if (pointValueForStat !== undefined && pointValueForStat !== 0) {
              if (combinedStat?.projected !== null) {
                calculatedProjectedFantasyPoints +=
                  combinedStat.projected * pointValueForStat;
                hasValidStatForFP = true;
              }
              if (combinedStat?.actual !== null) {
                calculatedActualFantasyPoints +=
                  combinedStat.actual * pointValueForStat;
                hasValidStatForFP = true; // ensure this is set if actuals exist even if projected don't
              }
            }
          }
          const newFantasyPoints = {
            projected: hasValidStatForFP
              ? calculatedProjectedFantasyPoints
              : null,
            actual: hasValidStatForFP ? calculatedActualFantasyPoints : null,
            diffPercentage: calculateDiffPercentage(
              hasValidStatForFP ? calculatedActualFantasyPoints : null,
              hasValidStatForFP ? calculatedProjectedFantasyPoints : null
            )
          };

          return {
            ...player,
            fantasyPoints: newFantasyPoints
          };
        });

        // --- Perform Round Processing on Recalculated FP Data ---
        // Sort by yahooAvgPick to prepare for round grouping
        const sortedPlayersForRoundProcessing = [
          ...newPlayersWithRecalculatedFP
        ].sort((a, b) => {
          const pickA = a.yahooAvgPick ?? Infinity;
          const pickB = b.yahooAvgPick ?? Infinity;
          return pickA - pickB;
        });

        const tableDataWithSummaries = addRoundSummariesToPlayers(
          sortedPlayersForRoundProcessing,
          calculateDiffPercentage
        );

        setProcessedPlayers(tableDataWithSummaries); // This is TableDataRow[]
        setTableColumns(currentTypeCache.base.columns); // Columns from base cache are TableDataRow compatible

        // Update the full cache with this new data
        currentTypeCache.full = {
          data: tableDataWithSummaries, // Correctly store TableDataRow[]
          columns: currentTypeCache.base.columns,
          sourceControlsSnapshot: stringifiedSourceControls,
          yahooModeSnapshot: yahooDraftMode,
          currentSeasonIdSnapshot: currentSeasonId,
          fantasyPointSettingsSnapshot: stringifiedFantasyPointSettings
        };

        setIsLoading(false);
        return; // Data processed from base cache
      }

      // --- No Cache Hit / Stale Base Cache: Proceed with full data fetching and processing ---
      // console.log(`[Cache] Miss for ${cacheTypeKey}. Full fetch & process.`);
      setIsLoading(true);
      setError(null);

      try {
        const activeSourceConfigs = PROJECTION_SOURCES_CONFIG.filter(
          (src) =>
            src.playerType === activePlayerType &&
            sourceControls[src.id]?.isSelected
        );

        if (activeSourceConfigs.length === 0) {
          setProcessedPlayers([]);
          setTableColumns([]);
          setIsLoading(false);
          return;
        }

        const relevantStatDefinitions = STATS_MASTER_LIST.filter(
          (stat) =>
            (activePlayerType === "skater" && stat.isSkaterStat) ||
            (activePlayerType === "goalie" && stat.isGoalieStat)
        );

        const projectionDataPromises = activeSourceConfigs.map(
          async (sourceConfig) => {
            const selectKeys = new Set<string>([
              sourceConfig.primaryPlayerIdKey,
              sourceConfig.originalPlayerNameKey
            ]);
            if (sourceConfig.teamKey) selectKeys.add(sourceConfig.teamKey);
            if (sourceConfig.positionKey)
              selectKeys.add(sourceConfig.positionKey);
            sourceConfig.statMappings.forEach((mapping) =>
              selectKeys.add(mapping.dbColumnName)
            );
            const selectString = Array.from(selectKeys).join(",");

            const queryBuilder = supabaseClient.from(sourceConfig.tableName);

            const allRowsForSource =
              await fetchAllSupabaseData<RawProjectionSourcePlayer>(
                queryBuilder,
                selectString
              );

            return {
              sourceId: sourceConfig.id,
              data: allRowsForSource,
              config: sourceConfig
            };
          }
        );

        const fetchedProjectionResults = await Promise.all(
          projectionDataPromises
        );
        const rawProjectionDataBySourceId: Record<
          string,
          { data: RawProjectionSourcePlayer[]; config: ProjectionSourceConfig }
        > = {};
        fetchedProjectionResults.forEach((res) => {
          rawProjectionDataBySourceId[res.sourceId] = {
            data: res.data,
            config: res.config
          };
        });

        const uniqueNhlPlayerIds = new Set<number>();
        activeSourceConfigs.forEach((sourceConfig) => {
          const sourceData = rawProjectionDataBySourceId[sourceConfig.id]?.data;
          if (sourceData) {
            sourceData.forEach((row) => {
              const playerId = row[sourceConfig.primaryPlayerIdKey];
              if (playerId !== null && playerId !== undefined) {
                uniqueNhlPlayerIds.add(Number(playerId));
              }
            });
          }
        });

        if (uniqueNhlPlayerIds.size === 0) {
          setProcessedPlayers([]);
          setTableColumns([]);
          setIsLoading(false);
          return;
        }

        // --- Fetch Actual Stats ---
        let actualStatsMap = new Map<number, ActualPlayerStatsRow>();
        if (uniqueNhlPlayerIds.size > 0) {
          const actualStatsPlayerIdColumn =
            activePlayerType === "skater" ? "player_id" : "goalie_id";
          const actualStatsSeasonColumn =
            activePlayerType === "skater" ? "season" : "season_id";
          const actualStatsSeasonValue = // Use currentSeasonId here
            activePlayerType === "skater"
              ? currentSeasonId
              : parseInt(currentSeasonId, 10);
          const actualStatsTable =
            activePlayerType === "skater"
              ? ACTUAL_SKATER_STATS_TABLE
              : ACTUAL_GOALIE_STATS_TABLE;

          const relevantActualStatDbColumns = Object.values(
            ACTUAL_STATS_COLUMN_MAP[activePlayerType]
          );
          // Filter out undefined values more explicitly and ensure type safety
          const definedRelevantActualStatDbColumns =
            relevantActualStatDbColumns.filter(
              (colName): colName is string => typeof colName === "string"
            );
          // Ensure the ID column is always selected for mapping, and filter out any undefined/null from Object.values if keys were missing
          const actualStatsSelectColumns = new Set([
            actualStatsPlayerIdColumn,
            ...definedRelevantActualStatDbColumns,
            "current_team_abbreviation" // Explicitly select the team abbreviation
          ]);
          const actualStatsSelectString = Array.from(
            actualStatsSelectColumns
          ).join(",");

          if (actualStatsSelectColumns.size > 1) {
            // Only fetch if there are stats beyond just the ID
            try {
              const queryBuilder = supabaseClient
                .from(actualStatsTable)
                .select(actualStatsSelectString)
                .eq(actualStatsSeasonColumn, actualStatsSeasonValue)
                .in(actualStatsPlayerIdColumn, Array.from(uniqueNhlPlayerIds));

              const fetchedActualStats =
                await fetchAllSupabaseData<ActualPlayerStatsRow>(
                  queryBuilder,
                  actualStatsSelectString
                );

              fetchedActualStats.forEach((row) => {
                const playerIdFromRow = row[actualStatsPlayerIdColumn];
                if (
                  playerIdFromRow !== null &&
                  playerIdFromRow !== undefined &&
                  !isNaN(Number(playerIdFromRow))
                ) {
                  actualStatsMap.set(Number(playerIdFromRow), row);
                }
              });
            } catch (e: any) {
              console.warn(
                `Failed to fetch actual stats for ${activePlayerType}: ${e.message}`
              );
              // Continue without actual stats if fetching fails
            }
          }
        }

        const yahooMapSelectString = `${YAHOO_PLAYER_MAP_KEYS.nhlPlayerId}, ${YAHOO_PLAYER_MAP_KEYS.yahooPlayerId}, ${YAHOO_PLAYER_MAP_KEYS.teamAbbreviation}, ${YAHOO_PLAYER_MAP_KEYS.position}, ${YAHOO_PLAYER_MAP_KEYS.nhlPlayerName}, ${YAHOO_PLAYER_MAP_KEYS.yahooPlayerNameInMap}`;

        const yahooMapQueryBuilder = supabaseClient
          .from("yahoo_nhl_player_map_mat")
          .select(yahooMapSelectString)
          .in(
            YAHOO_PLAYER_MAP_KEYS.nhlPlayerId,
            Array.from(uniqueNhlPlayerIds).map(String)
          );

        const yahooMapData = await fetchAllSupabaseData<YahooNhlPlayerMapEntry>(
          yahooMapQueryBuilder,
          yahooMapSelectString
        );

        const nhlToYahooMap = new Map<number, YahooNhlPlayerMapEntry>(
          yahooMapData
            ?.map((m) => {
              const nhlIdNum = Number(m[YAHOO_PLAYER_MAP_KEYS.nhlPlayerId]);
              return isNaN(nhlIdNum) ? null : [nhlIdNum, m];
            })
            .filter(
              (entry): entry is [number, YahooNhlPlayerMapEntry] =>
                entry !== null
            ) || []
        );

        const uniqueYahooPlayerIdsFromMap = new Set<string>();
        if (yahooMapData) {
          yahooMapData.forEach((m) => {
            const yahooId = m[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId];
            if (yahooId) {
              uniqueYahooPlayerIdsFromMap.add(String(yahooId));
            }
          });
        }

        let yahooPlayersMap = new Map<string, YahooPlayerDetailData>();
        if (uniqueYahooPlayerIdsFromMap.size > 0) {
          const yahooPlayersSelectString = `${YAHOO_PLAYERS_TABLE_KEYS.primaryKey}, ${YAHOO_PLAYERS_TABLE_KEYS.yahooSpecificPlayerId}, ${YAHOO_PLAYERS_TABLE_KEYS.fullName}, ${YAHOO_PLAYERS_TABLE_KEYS.draftAnalysis}, ${YAHOO_PLAYERS_TABLE_KEYS.editorialTeamAbbreviation}, ${YAHOO_PLAYERS_TABLE_KEYS.displayPosition}, ${YAHOO_PLAYERS_TABLE_KEYS.eligiblePositions}`;

          const yahooPlayersQueryBuilder = supabaseClient
            .from("yahoo_players")
            .select(
              `${YAHOO_PLAYERS_TABLE_KEYS.primaryKey}, ${YAHOO_PLAYERS_TABLE_KEYS.yahooSpecificPlayerId}, ${YAHOO_PLAYERS_TABLE_KEYS.fullName}, ${YAHOO_PLAYERS_TABLE_KEYS.draftAnalysis}, ${YAHOO_PLAYERS_TABLE_KEYS.editorialTeamAbbreviation}, ${YAHOO_PLAYERS_TABLE_KEYS.displayPosition}, ${YAHOO_PLAYERS_TABLE_KEYS.eligiblePositions}`
            )
            .in(
              YAHOO_PLAYERS_TABLE_KEYS.yahooSpecificPlayerId,
              Array.from(uniqueYahooPlayerIdsFromMap)
            );

          const yahooPlayersDetailsData =
            await fetchAllSupabaseData<YahooPlayerDetailData>(
              yahooPlayersQueryBuilder,
              yahooPlayersSelectString
            );

          yahooPlayersMap = new Map<string, YahooPlayerDetailData>(
            yahooPlayersDetailsData?.map((yp) => [
              String(yp[YAHOO_PLAYERS_TABLE_KEYS.yahooSpecificPlayerId]),
              yp
            ]) || []
          );
        } else {
        }
        const tempProcessedPlayers: ProcessedPlayer[] = [];
        const playersRequiringNameDebug: Array<{
          nhlPlayerId: number;
          nameFromYahooMapNhlName: string | null; // From yahoo_nhl_player_map_mat.nhl_player_name
          nameFromYahooMapYahooName: string | null; // From yahoo_nhl_player_map_mat.yahoo_player_name
          nameFromYahooPlayersTable: string | null; // Name from yahoo_players.full_name (cleaned)
          nameFromProjectionSource: string | null; // Name from the first projection source fallback (cleaned)
          finalNameUsed: string; // Actual name used in the table
          sourcesProvidingThisId: Array<{
            sourceId: string;
            sourceDisplayName: string;
            originalPlayerNameInSource: string | null; // Name as per this specific source
          }>;
        }> = [];

        for (const nhlPlayerId of uniqueNhlPlayerIds) {
          const playerYahooMapEntry = nhlToYahooMap.get(nhlPlayerId);

          // --- Player Name Resolution ---
          // Attempt 1: From yahoo_nhl_player_map_mat.nhl_player_name
          const nameFromYahooMapNhlNameRaw =
            playerYahooMapEntry?.[YAHOO_PLAYER_MAP_KEYS.nhlPlayerName];
          const nameFromYahooMapNhlName =
            typeof nameFromYahooMapNhlNameRaw === "string" &&
            nameFromYahooMapNhlNameRaw.trim() !== ""
              ? nameFromYahooMapNhlNameRaw.trim()
              : null;

          let resolvedName = nameFromYahooMapNhlName;
          let logThisPlayer = !nameFromYahooMapNhlName; // Log if primary name (nhl_player_name from map) is missing

          // Attempt 2: From yahoo_nhl_player_map_mat.yahoo_player_name
          let nameFromYahooMapYahooName: string | null = null;
          if (!resolvedName && playerYahooMapEntry) {
            const nameFromYahooMapYahooNameRaw =
              playerYahooMapEntry?.[YAHOO_PLAYER_MAP_KEYS.yahooPlayerNameInMap];
            nameFromYahooMapYahooName =
              typeof nameFromYahooMapYahooNameRaw === "string" &&
              nameFromYahooMapYahooNameRaw.trim() !== ""
                ? nameFromYahooMapYahooNameRaw.trim()
                : null;
            if (nameFromYahooMapYahooName) {
              resolvedName = nameFromYahooMapYahooName;
              // logThisPlayer remains true if nameFromYahooMapNhlName was null
            }
          }

          const yahooPlayerDetail = playerYahooMapEntry?.[
            YAHOO_PLAYER_MAP_KEYS.yahooPlayerId
          ]
            ? yahooPlayersMap.get(
                String(playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId])
              )
            : null;

          // Attempt 3: From yahoo_players.full_name (if prior attempts failed and yahooPlayerDetail exists)
          let nameFromYahooPlayersTable: string | null = null;
          if (!resolvedName && yahooPlayerDetail) {
            const nameFromYahooPlayersTableRaw =
              yahooPlayerDetail[YAHOO_PLAYERS_TABLE_KEYS.fullName];
            nameFromYahooPlayersTable =
              typeof nameFromYahooPlayersTableRaw === "string" &&
              nameFromYahooPlayersTableRaw.trim() !== ""
                ? nameFromYahooPlayersTableRaw.trim()
                : null;
            if (nameFromYahooPlayersTable) {
              resolvedName = nameFromYahooPlayersTable;
              // logThisPlayer remains true if nameFromYahooMapNhlName was null
            }
          }

          if (!resolvedName) {
            // Attempt 4: From projection source (if all prior attempts failed)
            // logThisPlayer is already true if nameFromYahooMapNhlName was null.
            // If nameFromYahooPlayersTable was also null, logThisPlayer remains true.
            for (const sourceConfig of activeSourceConfigs) {
              const sourceDataForPlayer = rawProjectionDataBySourceId[
                sourceConfig.id
              ]?.data.find(
                (p: RawProjectionSourcePlayer) =>
                  Number(p[sourceConfig.primaryPlayerIdKey]) === nhlPlayerId
              );
              const nameFromSrcRaw =
                sourceDataForPlayer?.[sourceConfig.originalPlayerNameKey];
              const nameFromSrc =
                typeof nameFromSrcRaw === "string" &&
                nameFromSrcRaw.trim() !== ""
                  ? nameFromSrcRaw.trim()
                  : null;

              if (nameFromSrc) {
                resolvedName = nameFromSrc;
                // nameFromProjectionSource will be set later when constructing playersRequiringNameDebug
                break; // Found a usable name from a source
              }
            }
          }

          const finalName = resolvedName || "Unknown Player";

          // If the final name is "Unknown Player", ensure it's logged.
          if (finalName === "Unknown Player") {
            logThisPlayer = true;
          }
          // --- End Player Name Resolution ---

          const processedPlayer: ProcessedPlayer = {
            playerId: nhlPlayerId,
            fullName: finalName, // Use the resolved finalName
            displayTeam: null,
            displayPosition: null,
            combinedStats: {},
            fantasyPoints: {
              projected: null,
              actual: null,
              diffPercentage: null
            },
            yahooPlayerId: playerYahooMapEntry?.[
              YAHOO_PLAYER_MAP_KEYS.yahooPlayerId
            ]
              ? String(playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId])
              : undefined
          };

          // Get actual stats for this player
          const playerActualStatsRow = actualStatsMap.get(nhlPlayerId);

          if (logThisPlayer) {
            // Re-check nameFromProjectionSource for logging if resolvedName came from it
            let loggedNameFromProjectionSource: string | null = null;
            if (
              resolvedName && // A name was found
              !nameFromYahooMapNhlName && // But not from the primary map source
              !nameFromYahooMapYahooName && // Nor from the secondary map source
              !nameFromYahooPlayersTable // Nor from the yahoo_players table
            ) {
              // resolvedName must have come from a projection source
              for (const sourceConfig of activeSourceConfigs) {
                const sourceDataForPlayer = rawProjectionDataBySourceId[
                  sourceConfig.id
                ]?.data.find(
                  (p: RawProjectionSourcePlayer) =>
                    Number(p[sourceConfig.primaryPlayerIdKey]) === nhlPlayerId
                );
                const nameFromSrcRaw =
                  sourceDataForPlayer?.[sourceConfig.originalPlayerNameKey];
                const nameFromSrc =
                  typeof nameFromSrcRaw === "string" &&
                  nameFromSrcRaw.trim() !== ""
                    ? nameFromSrcRaw.trim()
                    : null;
                if (nameFromSrc && nameFromSrc === resolvedName) {
                  loggedNameFromProjectionSource = nameFromSrc;
                  break;
                }
              }
            }

            const sourcesInfo: Array<{
              sourceId: string;
              sourceDisplayName: string;
              originalPlayerNameInSource: string | null;
            }> = [];
            activeSourceConfigs.forEach((sourceConfig) => {
              const sourceDataForPlayer = rawProjectionDataBySourceId[
                sourceConfig.id
              ]?.data.find(
                (p: RawProjectionSourcePlayer) =>
                  Number(p[sourceConfig.primaryPlayerIdKey]) === nhlPlayerId
              );
              if (sourceDataForPlayer) {
                sourcesInfo.push({
                  sourceId: sourceConfig.id,
                  sourceDisplayName: sourceConfig.displayName,
                  originalPlayerNameInSource:
                    sourceDataForPlayer[sourceConfig.originalPlayerNameKey] ||
                    null
                });
              }
            });
            playersRequiringNameDebug.push({
              nhlPlayerId,
              nameFromYahooMapNhlName,
              nameFromYahooMapYahooName,
              nameFromYahooPlayersTable,
              finalNameUsed: finalName,
              nameFromProjectionSource: loggedNameFromProjectionSource,
              sourcesProvidingThisId: sourcesInfo
            });
          }

          for (const statDef of relevantStatDefinitions) {
            const currentStatValues: RawPlayerStatFromSource[] = [];
            const missingFromSelectedForStat: string[] = [];

            let projectedValue: number | null = null;

            for (const sourceConfig of activeSourceConfigs) {
              const sourceControl = sourceControls[sourceConfig.id];
              if (!sourceControl || !sourceControl.isSelected) continue;

              const statMapping = sourceConfig.statMappings.find(
                (m) => m.key === statDef.key
              );
              const sourceDataForPlayer = rawProjectionDataBySourceId[
                sourceConfig.id
              ]?.data.find(
                (p: RawProjectionSourcePlayer) =>
                  Number(p[sourceConfig.primaryPlayerIdKey]) === nhlPlayerId
              );

              if (statMapping && sourceDataForPlayer) {
                const rawValue = sourceDataForPlayer[statMapping.dbColumnName];
                let parsedValue: number | null = null;
                if (rawValue !== null && rawValue !== undefined) {
                  if (statMapping.parser)
                    parsedValue = statMapping.parser(rawValue);
                  else if (typeof rawValue === "number") parsedValue = rawValue;
                  else if (
                    typeof rawValue === "string" &&
                    !isNaN(parseFloat(rawValue))
                  )
                    parsedValue = parseFloat(rawValue);
                }
                if (parsedValue !== null) {
                  currentStatValues.push({
                    value: parsedValue,
                    sourceId: sourceConfig.id,
                    sourceDisplayName: sourceConfig.displayName,
                    weight: sourceControl.weight
                  });
                } else {
                  missingFromSelectedForStat.push(
                    `${sourceConfig.displayName} (No Data)`
                  );
                }
              } else if (statMapping && !sourceDataForPlayer) {
                missingFromSelectedForStat.push(
                  `${sourceConfig.displayName} (Player Not Found In Source)`
                );
              }
            }

            // Calculate weightedSum, totalWeight, and contributingToAvg from currentStatValues
            let weightedSum = 0;
            let totalWeight = 0;
            const contributingToAvg: AggregatedStatValue["contributingSources"] =
              [];

            currentStatValues.forEach((item) => {
              if (item.value !== null) {
                weightedSum += item.value * item.weight;
                totalWeight += item.weight;
                contributingToAvg.push({
                  name: item.sourceDisplayName,
                  weight: item.weight,
                  value: item.value
                });
              }
            });

            projectedValue = totalWeight > 0 ? weightedSum / totalWeight : null; // Now calculate projectedValue

            const projectedDetail: AggregatedStatValue = {
              value: projectedValue,
              contributingSources: contributingToAvg,
              missingFromSelectedSources: missingFromSelectedForStat,
              statDefinition: statDef
            };

            // --- Process Actual Stat ---
            let actualValue: number | null = null;
            const actualStatDbColumn =
              ACTUAL_STATS_COLUMN_MAP[activePlayerType]?.[statDef.key];

            if (
              playerActualStatsRow &&
              actualStatDbColumn && // This would be "toi_per_game"
              playerActualStatsRow[actualStatDbColumn] !== null &&
              playerActualStatsRow[actualStatDbColumn] !== undefined
            ) {
              let rawActual = playerActualStatsRow[actualStatDbColumn]; // Value from DB (e.g., 1230 seconds)

              if (statDef.key === "TIME_ON_ICE_PER_GAME") {
                if (typeof rawActual === "string") {
                  const parts = rawActual.split(":");
                  if (parts.length === 2) {
                    // Handles "MM:SS" string from DB
                    const minutes = parseInt(parts[0], 10);
                    const seconds = parseInt(parts[1], 10);
                    if (!isNaN(minutes) && !isNaN(seconds)) {
                      actualValue = minutes * 60 + seconds; // Converts to total seconds
                    } else {
                      actualValue = null;
                    }
                  } else {
                    // Assumes string is a number representing total seconds (e.g., "1230")
                    const numericVal = Number(rawActual);
                    actualValue = isNaN(numericVal) ? null : numericVal;
                  }
                } else if (typeof rawActual === "number") {
                  // Assumes number is total seconds (e.g., 1230)
                  // rawActual is total seconds from DB (e.g., 1067.6097)
                  // Convert to decimal minutes for storage, as the formatter expects decimal minutes.
                  actualValue = rawActual / 60; // e.g., 1067.6097 / 60 = 17.793495
                } else if (rawActual === null || rawActual === undefined) {
                  actualValue = null;
                } else {
                  // Fallback for unexpected types, try to convert to number then to decimal minutes
                  const numericVal = Number(rawActual);
                  actualValue = isNaN(numericVal) ? null : numericVal / 60;
                }
              } else if (statDef.key === "SAVE_PERCENTAGE") {
                let numValue: number | null = null;
                if (typeof rawActual === "number") {
                  // Handles 0.915 or 91.5 (converts 91.5 to 0.915)
                  numValue =
                    rawActual > 1 && rawActual <= 100
                      ? rawActual / 100
                      : rawActual;
                } else if (typeof rawActual === "string") {
                  if (rawActual.endsWith("%")) {
                    // "91.5%"
                    numValue = parseFloat(rawActual.replace("%", "")) / 100;
                  } else {
                    // "0.915"
                    numValue = parseFloat(rawActual);
                  }
                }
                actualValue =
                  numValue === null || isNaN(numValue) ? null : numValue;
              } else {
                // For all other stats
                const numericVal = Number(rawActual);
                actualValue = isNaN(numericVal) ? null : numericVal;
              }
            }

            processedPlayer.combinedStats[statDef.key] = {
              projected: projectedValue, // This should be in decimal minutes if from projections
              actual: actualValue, // This is now stored as decimal minutes
              diffPercentage: calculateDiffPercentage(
                actualValue,
                projectedValue
              ),
              projectedDetail: projectedDetail
            };
          }

          // --- Team and Position Resolution ---
          let teamFromSources: string | null = null;
          let positionFromSources: string | null = null;

          // 1. Try from projection sources
          for (const sourceConfig of activeSourceConfigs) {
            const sourceDataForPlayer = rawProjectionDataBySourceId[
              sourceConfig.id
            ]?.data.find(
              (p: RawProjectionSourcePlayer) =>
                Number(p[sourceConfig.primaryPlayerIdKey]) === nhlPlayerId
            );
            if (sourceDataForPlayer) {
              if (
                !teamFromSources &&
                sourceConfig.teamKey &&
                sourceDataForPlayer[sourceConfig.teamKey]
              ) {
                teamFromSources = sourceDataForPlayer[sourceConfig.teamKey];
              }
              if (
                !positionFromSources &&
                sourceConfig.positionKey &&
                sourceDataForPlayer[sourceConfig.positionKey]
              ) {
                positionFromSources =
                  sourceDataForPlayer[sourceConfig.positionKey];
              }
            }
            if (teamFromSources && positionFromSources) break;
          }

          // 2. Fallback to Yahoo map
          if (
            !teamFromSources &&
            playerYahooMapEntry?.[YAHOO_PLAYER_MAP_KEYS.teamAbbreviation]
          ) {
            teamFromSources =
              playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.teamAbbreviation];
          }
          if (
            !positionFromSources &&
            playerYahooMapEntry?.[YAHOO_PLAYER_MAP_KEYS.position]
          ) {
            positionFromSources =
              playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.position];
          }

          // 3. Fallback to Yahoo players table
          if (
            !teamFromSources &&
            yahooPlayerDetail?.[
              YAHOO_PLAYERS_TABLE_KEYS.editorialTeamAbbreviation
            ]
          ) {
            teamFromSources = // Corrected from finalTeam to teamFromSources
              yahooPlayerDetail[
                YAHOO_PLAYERS_TABLE_KEYS.editorialTeamAbbreviation
              ];
          }
          if (
            !positionFromSources &&
            yahooPlayerDetail?.[YAHOO_PLAYERS_TABLE_KEYS.displayPosition]
          ) {
            positionFromSources =
              yahooPlayerDetail[YAHOO_PLAYERS_TABLE_KEYS.displayPosition];
          }

          // 4. Prioritize current_team_abbreviation from actual stats for displayTeam
          const actualTeamAbbreviation =
            playerActualStatsRow?.current_team_abbreviation;

          if (
            actualTeamAbbreviation &&
            typeof actualTeamAbbreviation === "string" &&
            actualTeamAbbreviation.trim() !== ""
          ) {
            processedPlayer.displayTeam = actualTeamAbbreviation.trim();
          } else {
            processedPlayer.displayTeam = teamFromSources; // Use the team found from sources/Yahoo
          }
          processedPlayer.displayPosition = positionFromSources;
          if (
            yahooPlayerDetail &&
            yahooPlayerDetail[YAHOO_PLAYERS_TABLE_KEYS.draftAnalysis]
          ) {
            const draftAnalysisData = yahooPlayerDetail[
              YAHOO_PLAYERS_TABLE_KEYS.draftAnalysis
            ] as Record<string, string | number | null>;
            const modeKeys = YAHOO_DRAFT_ANALYSIS_KEYS[yahooDraftMode];
            const parseYahooStat = (
              val: string | number | null | undefined
            ) => {
              if (val === "-" || val === null || val === undefined) return null;
              const num = parseFloat(String(val));
              return isNaN(num) ? null : num;
            };
            processedPlayer.yahooAvgPick = parseYahooStat(
              draftAnalysisData[modeKeys.avgPick]
            );
            processedPlayer.yahooAvgRound = parseYahooStat(
              draftAnalysisData[modeKeys.avgRound]
            );
            const pctDraftedNum = parseYahooStat(
              draftAnalysisData[modeKeys.pctDrafted]
            );
            processedPlayer.yahooPctDrafted =
              pctDraftedNum !== null ? pctDraftedNum * 100 : null;
          }

          // Calculate Projected Fantasy Points
          let calculatedProjectedFP = 0;
          let calculatedActualFP = 0;
          let hasValidStatForFP = false; // To determine if FP should be null or 0

          for (const statKey in processedPlayer.combinedStats) {
            const combinedStat = processedPlayer.combinedStats[statKey];
            const pointValueForStat = fantasyPointSettings[statKey];

            if (pointValueForStat !== undefined && pointValueForStat !== 0) {
              if (combinedStat?.projected !== null) {
                calculatedProjectedFP +=
                  combinedStat.projected * pointValueForStat;
                hasValidStatForFP = true;
              }
              if (combinedStat?.actual !== null) {
                calculatedActualFP += combinedStat.actual * pointValueForStat;
                hasValidStatForFP = true;
              }
            }
          }
          processedPlayer.fantasyPoints.projected = hasValidStatForFP
            ? calculatedProjectedFP
            : null;
          processedPlayer.fantasyPoints.actual = hasValidStatForFP
            ? calculatedActualFP
            : null;
          processedPlayer.fantasyPoints.diffPercentage =
            calculateDiffPercentage(
              processedPlayer.fantasyPoints.actual,
              processedPlayer.fantasyPoints.projected
            );

          tempProcessedPlayers.push(processedPlayer);
        }

        if (playersRequiringNameDebug.length > 0) {
          console.warn(
            `[FHFHockey Debug] Player Name Resolution Issues Encountered (${playersRequiringNameDebug.length} players):`
          );
          console.log(
            "The following players may display as 'Unknown Player' or use a fallback name. This typically occurs if 'nhl_player_name' is missing or invalid in the 'yahoo_nhl_player_map_mat' table for the given 'nhlPlayerId'."
          );
          console.log(JSON.stringify(playersRequiringNameDebug, null, 2));
          console.info(
            "[FHFHockey Debug] Review 'nameFromYahooMapNhlName' (from 'yahoo_nhl_player_map_mat.nhl_player_name'), 'nameFromYahooMapYahooName' (from 'yahoo_nhl_player_map_mat.yahoo_player_name'), 'nameFromYahooPlayersTable' (from 'yahoo_players.full_name'), 'nameFromProjectionSource' (first fallback found from projection data), and 'finalNameUsed'. 'sourcesProvidingThisId' lists all selected projection sources that contain the 'nhlPlayerId' and the name they have for it. This can help identify discrepancies or missing data in 'yahoo_nhl_player_map_mat' or your primary player data."
          );
        }

        const newTableColumns: ColumnDef<TableDataRow, any>[] = [];
        newTableColumns.push({
          id: "fullName",
          header: "Player",
          accessorKey: "fullName",
          cell: (info) => {
            // Moved cell renderer here
            const rowData = info.row.original; // TableDataRow
            if ("type" in rowData && rowData.type === "summary") {
              // rowData is now RoundSummaryRow
              return (
                <strong className={styles.roundSummaryText}>
                  {rowData.fullName}
                </strong>
              );
            }
            return (rowData as ProcessedPlayer).fullName;
            // If not summary, it's ProcessedPlayer
          },
          meta: { columnType: "text" },
          enableSorting: true
        });
        newTableColumns.push({
          id: "displayTeam",
          header: "Team",
          accessorKey: "displayTeam",
          cell: (info) =>
            "type" in info.row.original && info.row.original.type === "summary"
              ? "-" // It's a RoundSummaryRow
              : (info.row.original as ProcessedPlayer).displayTeam, // It's a ProcessedPlayer
          meta: { columnType: "text" },
          enableSorting: true
        });
        newTableColumns.push({
          id: "displayPosition",
          header: "Pos",
          accessorKey: "displayPosition",
          cell: (info) => {
            const rowData = info.row.original;
            if ("type" in rowData && rowData.type === "summary") {
              // rowData is RoundSummaryRow
              return "-";
            }
            // rowData is ProcessedPlayer
            return (rowData as ProcessedPlayer).displayPosition;
          },
          meta: { columnType: "text" },
          enableSorting: true
        });

        relevantStatDefinitions.forEach((statDef) => {
          if (
            // Ensure defaultVisible is explicitly checked. If undefined, assume visible.
            // Keep GAMES_PLAYED always visible regardless of its defaultVisible setting.
            statDef.defaultVisible !== undefined &&
            statDef.defaultVisible === false &&
            statDef.key !== "GAMES_PLAYED"
          )
            return;

          // Create a group for each stat
          newTableColumns.push({
            id: `${statDef.key}_group`, // <-- ADDED ID FOR THE STAT GROUP
            header: () => {
              let tooltipText = `${statDef.displayName} (${statDef.key})\nProjected is a weighted average. Actual is from ${currentSeasonId} season totals.`; // Use dynamic currentSeasonId
              const definingSources =
                activeSourceConfigs
                  .filter(
                    (sc) =>
                      sourceControls[sc.id]?.isSelected &&
                      sc.statMappings.some((m) => m.key === statDef.key)
                  )
                  .map((sc) => sc.displayName)
                  .join(", ") || "None selected";
              tooltipText += `\nProjection sources for this stat: ${definingSources}`;
              return <div title={tooltipText}>{statDef.displayName}</div>;
            },
            columns: [
              // Sub-columns for Proj, Actual, Diff
              {
                id: `${statDef.key}_proj`,
                header: "Proj",
                accessorFn: (player) =>
                  "type" in player && player.type === "summary"
                    ? undefined
                    : ((player as ProcessedPlayer).combinedStats[statDef.key]
                        ?.projected ?? undefined),
                cell: (info) => {
                  const rowData = info.row.original;
                  if ("type" in rowData && rowData.type === "summary")
                    return "-";

                  const combinedStat = (rowData as ProcessedPlayer)
                    .combinedStats[statDef.key];
                  const val = combinedStat?.projected;
                  if (val === null || val === undefined) return "-";

                  const projectedDetail = combinedStat.projectedDetail;
                  let cellTooltip = `Projected Value: ${val.toFixed(statDef.decimalPlaces ?? (statDef.dataType === "percentage" && statDef.key !== "SAVE_PERCENTAGE" ? 1 : statDef.key === "TIME_ON_ICE_PER_GAME" ? 2 : 0))}\nContributing Sources:\n`;
                  projectedDetail?.contributingSources.forEach((cs) => {
                    cellTooltip += `  - ${cs.name} (Val: ${cs.value?.toFixed(2)}, W: ${cs.weight})\n`;
                  });
                  if (projectedDetail?.missingFromSelectedSources.length) {
                    cellTooltip += "Missing from projection sources:\n";
                    projectedDetail.missingFromSelectedSources.forEach((ms) => {
                      cellTooltip += `  - ${ms}\n`;
                    });
                  }

                  let displayValue: string;
                  if (statDef.formatter) displayValue = statDef.formatter(val);
                  else if (statDef.dataType === "percentage")
                    displayValue =
                      statDef.key === "SAVE_PERCENTAGE"
                        ? val.toFixed(statDef.decimalPlaces ?? 3)
                        : `${(val * 100).toFixed(statDef.decimalPlaces ?? 1)}%`;
                  else displayValue = val.toFixed(statDef.decimalPlaces ?? 0);
                  return <div title={cellTooltip.trim()}>{displayValue}</div>;
                },
                meta: {
                  columnType: "numeric",
                  higherIsBetter: statDef.higherIsBetter
                },
                enableSorting: true,
                sortUndefined: "last"
              },
              {
                id: `${statDef.key}_actual`,
                header: "REAL",
                accessorFn: (player) =>
                  "type" in player && player.type === "summary"
                    ? undefined
                    : ((player as ProcessedPlayer).combinedStats[statDef.key]
                        ?.actual ?? undefined),
                cell: (info) => {
                  const rowData = info.row.original;
                  if ("type" in rowData && rowData.type === "summary")
                    return "-";
                  const val = info.getValue() as number | null;

                  if (val === null || val === undefined) return "-";
                  let displayValue: string;
                  if (statDef.formatter) displayValue = statDef.formatter(val);
                  else if (statDef.dataType === "percentage")
                    displayValue =
                      statDef.key === "SAVE_PERCENTAGE"
                        ? val.toFixed(statDef.decimalPlaces ?? 3)
                        : `${(val * 100).toFixed(statDef.decimalPlaces ?? 1)}%`;
                  else displayValue = val.toFixed(statDef.decimalPlaces ?? 0);
                  return displayValue;
                },
                meta: {
                  columnType: "numeric",
                  higherIsBetter: statDef.higherIsBetter
                },
                enableSorting: true,
                sortUndefined: "last"
              },
              {
                id: `${statDef.key}_diff`,
                header: "DIFF",
                accessorFn: (player) =>
                  "type" in player && player.type === "summary"
                    ? undefined
                    : ((player as ProcessedPlayer).combinedStats[statDef.key]
                        ?.diffPercentage ?? undefined),
                cell: (info) => {
                  const rowData = info.row.original;
                  if ("type" in rowData && rowData.type === "summary")
                    return "-";
                  const val = info.getValue() as number | null;

                  if (val === null || val === undefined) return "-";

                  let diffStyleKey = ""; // e.g., "positiveDiffStrong"
                  if (val === 99999) {
                    diffStyleKey = "positiveDiffStrong";
                    return <span className={styles[diffStyleKey]}>++</span>;
                  }
                  if (val === -99999) {
                    diffStyleKey = "negativeDiffStrong";
                    return <span className={styles[diffStyleKey]}>--</span>;
                  }

                  if (val > 0) {
                    if (val <= 10) diffStyleKey = "positiveDiffLight";
                    else if (val <= 25)
                      diffStyleKey = "positiveDiff"; // Standard positive
                    else diffStyleKey = "positiveDiffStrong";
                  } else if (val < 0) {
                    const absVal = Math.abs(val);
                    if (absVal <= 10) diffStyleKey = "negativeDiffLight";
                    else if (absVal <= 25)
                      diffStyleKey = "negativeDiff"; // Standard negative
                    else diffStyleKey = "negativeDiffStrong";
                  }

                  const displayVal = `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
                  return (
                    <span className={styles[diffStyleKey] || ""}>
                      {displayVal}
                    </span>
                  );
                },
                meta: { columnType: "numeric", isDiffCell: true },
                enableSorting: true
              }
            ]
          });
        });

        const yahooStatConfigs = [
          {
            key: "yahooAvgPick",
            header: "ADP",
            decimals: 1,
            higherIsBetter: false
          }, // Lower is better
          {
            key: "yahooAvgRound",
            header: "Avg Rd",
            decimals: 1,
            higherIsBetter: false
          }, // Lower is better
          {
            key: "yahooPctDrafted",
            header: "Draft %",
            decimals: 1,
            isPercentage: true,
            higherIsBetter: true
          }
        ];
        yahooStatConfigs.forEach((yc) => {
          newTableColumns.push({
            id: yc.key,
            header: yc.header,
            // Ensure undefined is returned if value is null, for sortUndefined to work
            accessorFn: (player) => {
              if ("type" in player && player.type === "summary")
                return undefined; // Type guard
              return (
                (player as ProcessedPlayer)[yc.key as keyof ProcessedPlayer] ??
                undefined
              );
            },
            cell: (info) => {
              const rowData = info.row.original;
              if ("type" in rowData && rowData.type === "summary") return "-"; // Type guard
              const val = info.getValue() as number | null;
              if (val === null || val === undefined) return "-";
              return yc.isPercentage
                ? `${val.toFixed(yc.decimals)}%`
                : val.toFixed(yc.decimals);
            },
            meta: {
              columnType: "numeric",
              higherIsBetter: yc.higherIsBetter
            },
            enableSorting: true,
            sortUndefined: "last" // This will push undefined (formerly null) values to the bottom
          });
        });

        // --- Add Rank Columns ---
        // These columns will display ranks calculated at the page level
        newTableColumns.push({
          id: "projectedRank",
          header: "P-Rank",
          accessorFn: (player) =>
            "type" in player && player.type === "summary"
              ? undefined
              : ((player as ProcessedPlayer).projectedRank ?? undefined),
          cell: (info) => {
            const rowData = info.row.original;
            if ("type" in rowData && rowData.type === "summary") return "-";
            const val = info.getValue() as number | null;
            return val !== null && val !== undefined ? val : "-";
          },
          meta: { columnType: "numeric", higherIsBetter: false }, // Lower rank is better
          enableSorting: true,
          sortUndefined: "last"
        });

        newTableColumns.push({
          id: "actualRank",
          header: "A-Rank",
          accessorFn: (player) =>
            "type" in player && player.type === "summary"
              ? undefined
              : ((player as ProcessedPlayer).actualRank ?? undefined),
          cell: (info) => {
            const rowData = info.row.original;
            if ("type" in rowData && rowData.type === "summary") return "-";
            const val = info.getValue() as number | null;
            return val !== null && val !== undefined ? val : "-";
          },
          meta: { columnType: "numeric", higherIsBetter: false }, // Lower rank is better
          enableSorting: true,
          sortUndefined: "last"
        });
        // --- End Rank Columns ---

        // Add Projected Fantasy Points Column
        // This also becomes a group
        newTableColumns.push({
          id: "fantasyPoints_group", // <-- ADDED ID FOR THE FANTASY POINTS GROUP
          header: "Fantasy Pts",
          columns: [
            {
              id: "fp_proj",
              header: "Proj",
              accessorFn: (player) =>
                "type" in player && player.type === "summary"
                  ? undefined
                  : (player.fantasyPoints.projected ?? undefined),
              cell: (info) => {
                const rowData = info.row.original;
                if ("type" in rowData && rowData.type === "summary") return "-"; // Type guard

                const val = info.getValue() as number | null;
                if (val === null || val === undefined) return "-";
                return val.toFixed(1);
              },
              meta: { columnType: "numeric", higherIsBetter: true },
              enableSorting: true,
              sortUndefined: "last"
            },
            {
              id: "fp_actual",
              header: "fPts",
              accessorFn: (
                player // Type guard for accessor
              ) =>
                "type" in player && player.type === "summary"
                  ? undefined // Summary rows don't have actual FP sum
                  : ((player as ProcessedPlayer).fantasyPoints.actual ??
                    undefined),
              // For summary rows, this will be null as per RoundSummaryRow interface
              cell: (info) => {
                const rowData = info.row.original;
                if ("type" in rowData && rowData.type === "summary") return "-"; // Type guard
                const val = info.getValue() as number | null;

                if (val === null || val === undefined) return "-";
                return val.toFixed(1);
              },
              meta: { columnType: "numeric", higherIsBetter: true },
              enableSorting: true,
              sortUndefined: "last"
            },
            {
              id: "fp_diff",
              header: "DIFF",
              accessorFn: (player) =>
                player.fantasyPoints.diffPercentage ?? undefined,
              cell: (info) => {
                const val = info.getValue() as number | null;
                // This cell WILL display for summary rows, as fantasyPoints.diffPercentage is populated for them

                if (val === null || val === undefined) return "-";

                let diffStyleKey = ""; // e.g., "positiveDiffStrong"
                if (val === 99999) {
                  diffStyleKey = "positiveDiffStrong";
                  return <span className={styles[diffStyleKey]}>++</span>;
                }
                if (val === -99999) {
                  diffStyleKey = "negativeDiffStrong";
                  return <span className={styles[diffStyleKey]}>--</span>;
                }

                if (val > 0) {
                  if (val <= 10) diffStyleKey = "positiveDiffLight";
                  else if (val <= 25)
                    diffStyleKey = "positiveDiff"; // Standard positive
                  else diffStyleKey = "positiveDiffStrong";
                } else if (val < 0) {
                  const absVal = Math.abs(val);
                  if (absVal <= 10) diffStyleKey = "negativeDiffLight";
                  else if (absVal <= 25)
                    diffStyleKey = "negativeDiff"; // Standard negative
                  else diffStyleKey = "negativeDiffStrong";
                }

                const displayVal = `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
                return (
                  <span className={styles[diffStyleKey] || ""}>
                    {displayVal}
                  </span>
                );
              },
              meta: { columnType: "numeric", isDiffCell: true },
              enableSorting: true
            }
          ]
        });

        // --- After all player data is processed and columns are defined ---
        // Now, create the final array with players and injected summary rows
        const sortedPlayers = [...tempProcessedPlayers].sort((a, b) => {
          const pickA = a.yahooAvgPick ?? Infinity;
          const pickB = b.yahooAvgPick ?? Infinity;
          return pickA - pickB;
        });

        const byProj = [...tempProcessedPlayers].sort(
          (a, b) =>
            (b.fantasyPoints.projected ?? -Infinity) -
            (a.fantasyPoints.projected ?? -Infinity)
        );
        byProj.forEach((player, idx) => {
          player.projectedRank = idx + 1;
        });

        const byActual = [...tempProcessedPlayers].sort(
          (a, b) =>
            (b.fantasyPoints.actual ?? -Infinity) -
            (a.fantasyPoints.actual ?? -Infinity)
        );
        byActual.forEach((player, idx) => {
          player.actualRank = idx + 1;
        });

        const finalTableDataWithSummaries = addRoundSummariesToPlayers(
          sortedPlayers,
          calculateDiffPercentage
        );

        // --- Update Cache ---
        // Base cache stores ProcessedPlayer[] (before round summaries)
        currentTypeCache.base = {
          data: tempProcessedPlayers, // This is ProcessedPlayer[]
          columns: newTableColumns, // These are ColumnDef<TableDataRow, any>[]
          sourceControlsSnapshot: stringifiedSourceControls,
          yahooModeSnapshot: yahooDraftMode,
          currentSeasonIdSnapshot: currentSeasonId
        };
        // Full cache stores TableDataRow[] (with round summaries)
        currentTypeCache.full = {
          data: finalTableDataWithSummaries, // Store the data with summaries
          columns: newTableColumns,
          sourceControlsSnapshot: stringifiedSourceControls,
          yahooModeSnapshot: yahooDraftMode,
          fantasyPointSettingsSnapshot: stringifiedFantasyPointSettings,
          currentSeasonIdSnapshot: currentSeasonId // Store season ID in full cache
        };

        setProcessedPlayers(finalTableDataWithSummaries);
        setTableColumns(newTableColumns);
      } catch (e: any) {
        console.error("Error in useProcessedProjectionsData:", e);
        setError(
          e.message || "An unexpected error occurred during data processing."
        );
        setProcessedPlayers([]);
        setTableColumns([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDataAndProcess(); // supabaseClient is guaranteed from props
  }, [
    activePlayerType,
    JSON.stringify(sourceControls),
    yahooDraftMode,
    JSON.stringify(fantasyPointSettings),
    supabaseClient,
    currentSeasonId
  ]);

  return { processedPlayers, tableColumns, isLoading, error };
};
