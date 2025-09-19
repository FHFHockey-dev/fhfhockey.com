// lib/hooks/useProcessedProjectionsData.tsx

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  startTransition
} from "react";
import { SupabaseClient, PostgrestResponse } from "@supabase/supabase-js"; // prettier-ignore
import {
  ColumnDef,
  RowData,
  SortingFnOption,
  GroupColumnDef
} from "@tanstack/react-table";

// Configuration Imports
import {
  STATS_MASTER_LIST,
  StatDefinition
} from "lib/projectionsConfig/statsMasterList";
import {
  PROJECTION_SOURCES_CONFIG,
  ProjectionSourceConfig,
  SourceStatMapping
} from "lib/projectionsConfig/projectionSourcesConfig";
import {
  YAHOO_DRAFT_ANALYSIS_KEYS,
  YAHOO_PLAYER_MAP_KEYS,
  YAHOO_PLAYERS_TABLE_KEYS
} from "lib/projectionsConfig/yahooConfig";

// Central constant: current Yahoo game/season prefix for filtering ADP rows.
// Ensure all yahoo_players and mapping data are restricted to this prefix to avoid prior season leakage.
export const CURRENT_YAHOO_GAME_PREFIX = "465."; // (Prev season prefix: 453.)

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
  eligiblePositions?: string[]; // From yahoo_players.eligible_positions when available

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
    projectedPerGame: number | null; // Added for fPts/Gm
    actualPerGame: number | null; // Added for fPts/Gm
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
    projectedPerGame: number | null; // Projected FP / Gm
    actualPerGame: number | null; // Actual FP / Gm
    diffPercentagePerGame: number | null; // Diff of FP / Gm
  };
  totalProjectedGP: number | null;
  totalActualGP: number | null;
  // Fields to make it somewhat compatible with ProcessedPlayer for column definitions
  // These will mostly be null or placeholder for summary rows.
  playerId: string; // Can be the same as id
  fullName: string; // e.g., "Round 1 Summary"
  displayTeam: null;
  displayPosition: null;
  combinedStats: Record<string, any>; // Empty or placeholder
  yahooAvgPick?: number | null; // Set to sort summary row after players
  // other ProcessedPlayer fields can be undefined or null
}

export type TableDataRow = ProcessedPlayer | RoundSummaryRow;

export interface CustomAdditionalProjectionSource {
  id: string; // expected to be 'custom_csv'
  displayName: string; // e.g. 'Custom CSV'
  playerType: "skater" | "goalie";
  // Raw row objects shaped similarly to Supabase rows (column names matching statMappings dbColumnName etc.)
  rows: Array<Record<string, any>>;
  primaryPlayerIdKey: string; // e.g. 'player_id'
  originalPlayerNameKey: string; // e.g. 'Player_Name'
  teamKey?: string;
  positionKey?: string;
  statMappings: SourceStatMapping[]; // reuse existing mapping type
  resolution?: CustomSourceResolutionMeta;
}

export interface CustomSourceResolutionMeta {
  totalRows: number;
  idMatched: number;
  nameMatched: number;
  fuzzyMatched?: number;
  manualOverrides?: number;
  unresolved: number;
  invalidIds?: number;
  coverage: number;
  lastUpdated: number;
  unresolvedNames: string[];
}

const stdName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

type CustomNameIndexEntry = {
  row: RawProjectionSourcePlayer;
  team: string | null;
  gamesPlayed: number | null;
};

export interface UseProcessedProjectionsDataProps {
  activePlayerType: "skater" | "goalie";
  sourceControls: Record<string, { isSelected: boolean; weight: number }>;
  yahooDraftMode: "ALL" | "PRESEASON";
  fantasyPointSettings: Record<string, number>;
  supabaseClient: SupabaseClient<any, "public">; // Expect non-null from page
  currentSeasonId?: string; // Added to accept the current season ID
  styles: Record<string, string>; // To pass CSS Modules styles object
  showPerGameFantasyPoints: boolean;
  togglePerGameFantasyPoints: () => void;
  // NEW: team count to drive round summaries
  teamCountForRoundSummaries?: number;
  // NEW: Optional in-memory custom source (session CSV import) to merge with pipeline
  customAdditionalSource?: CustomAdditionalProjectionSource;
  // NEW: external refresh key to bust caches and force reload
  refreshKey?: number | string;
  // NEW: support multiple in-memory custom sources
  customAdditionalSources?: CustomAdditionalProjectionSource[];
  allowCustomNameFallback?: boolean;
}

export interface UseProcessedProjectionsDataReturn {
  processedPlayers: TableDataRow[]; // Updated to be a union type
  tableColumns: ColumnDef<TableDataRow, any>[]; // Updated for union type
  isLoading: boolean;
  error: string | null;
  customFallbackUsage?: {
    total: number;
    bySource: Record<string, number>;
  };
  customSourceResolutions?: Record<string, CustomSourceResolutionMeta | undefined>;
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
  // columns: ColumnDef<TableDataRow, any>[]; // Columns are designed to handle TableDataRow from the start.
}

interface CachedFullPlayerData extends BaseCacheSnapshotInfo {
  data: TableDataRow[]; // Fully processed data including round summaries and final FPs.
  // columns: ColumnDef<TableDataRow, any>[]; // Same columns as base, designed for TableDataRow.
  fantasyPointSettingsSnapshot: string; // Specific to the fully calculated FP data
  showPerGameFantasyPointsSnapshot: boolean; // Added to ensure cache considers this display mode
  refreshKeySnapshot?: number | string;
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

export function calculateDiffPercentage(
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
// Adds: head count (if available) + push spread (avoid repeated concat) + timing logs in dev.
const SUPABASE_PAGE_SIZE = 1000;

async function fetchAllSupabaseData<T extends Record<string, any>>(
  queryBuilder: any,
  selectString: string,
  opts: { label?: string } = {}
): Promise<T[]> {
  const DEV =
    typeof process !== "undefined" && process.env.NODE_ENV !== "production";
  const label = opts.label || "supabase_fetch";
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  let allData: T[] = [];
  let offset = 0;
  let keepFetching = true;
  let page = 0;
  let expectedTotal: number | null = null;
  try {
    // Attempt count head request (cheap metadata call)
    const headRes: PostgrestResponse<T> = await queryBuilder.select(
      selectString,
      { head: true, count: "exact" }
    );
    if (
      (headRes as any)?.count != null &&
      Number.isFinite((headRes as any).count)
    ) {
      expectedTotal = (headRes as any).count as unknown as number;
      if (DEV)
        console.log(
          `[fetchAllSupabaseData] head count for ${label}:`,
          expectedTotal
        );
    }
  } catch (e) {
    if (DEV)
      console.warn(
        `[fetchAllSupabaseData] head count failed for ${label}`,
        (e as any)?.message
      );
  }

  while (keepFetching) {
    const pageStart =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const { data, error }: PostgrestResponse<T> = await queryBuilder
      .select(selectString)
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);
    if (error) {
      throw new Error(
        `Supabase query failed (page ${page + 1} ${label}): ${error.message}`
      );
    }
    if (data && data.length > 0) {
      allData.push(...data); // push spread avoids realloc concat chain
    }
    const pageElapsed =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      pageStart;
    if (DEV) {
      console.log(
        `[fetchAllSupabaseData] page ${page + 1} size=${data?.length || 0} elapsed=${pageElapsed.toFixed(1)}ms label=${label}`
      );
    }
    if (!data || data.length < SUPABASE_PAGE_SIZE) {
      keepFetching = false;
    } else {
      offset += SUPABASE_PAGE_SIZE;
      page++;
    }
  }
  if (DEV) {
    const totalElapsed =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      t0;
    console.log(
      `[fetchAllSupabaseData] complete label=${label} pages=${page + 1} rows=${allData.length}` +
        (expectedTotal != null ? ` expected=${expectedTotal}` : "") +
        ` total=${totalElapsed.toFixed(1)}ms`
    );
  }
  return allData;
}

// Helper function to add round summaries to a list of processed players
export function addRoundSummariesToPlayers(
  sortedPlayers: ProcessedPlayer[],
  calculateDiffFn: (
    actual: number | null | undefined,
    projected: number | null | undefined
  ) => number | null,
  teamCount: number = 12
): TableDataRow[] {
  const finalTableDataWithSummaries: TableDataRow[] = [];
  let currentRoundPlayersBuffer: ProcessedPlayer[] = [];
  let currentRoundNum = 0; // 0 means unranked or before first round

  const processRoundBuffer = () => {
    if (currentRoundPlayersBuffer.length > 0 && currentRoundNum > 0) {
      let roundTotalProjectedFP = 0;
      let roundTotalActualFP = 0;
      let roundTotalProjectedGP = 0;
      let roundTotalActualGP = 0;

      currentRoundPlayersBuffer.forEach((p) => {
        if (p.fantasyPoints.projected !== null) {
          roundTotalProjectedFP += p.fantasyPoints.projected;
        }
        if (p.fantasyPoints.actual !== null) {
          roundTotalActualFP += p.fantasyPoints.actual;
        }
        if (
          p.combinedStats.GAMES_PLAYED?.projected !== null &&
          p.combinedStats.GAMES_PLAYED?.projected !== undefined
        ) {
          roundTotalProjectedGP += p.combinedStats.GAMES_PLAYED.projected;
        }
        if (
          p.combinedStats.GAMES_PLAYED?.actual !== null &&
          p.combinedStats.GAMES_PLAYED?.actual !== undefined
        ) {
          roundTotalActualGP += p.combinedStats.GAMES_PLAYED.actual;
        }
      });

      const totalDiffPercentage = calculateDiffFn(
        roundTotalActualFP,
        roundTotalProjectedFP
      );
      const projectedPerGame =
        roundTotalProjectedGP > 0
          ? roundTotalProjectedFP / roundTotalProjectedGP
          : null;
      const actualPerGame =
        roundTotalActualGP > 0 ? roundTotalActualFP / roundTotalActualGP : null;
      const diffPercentagePerGame = calculateDiffFn(
        actualPerGame,
        projectedPerGame
      );

      finalTableDataWithSummaries.push(...currentRoundPlayersBuffer);
      finalTableDataWithSummaries.push({
        id: `summary-round-${currentRoundNum}`,
        type: "summary",
        roundNumber: currentRoundNum,
        fantasyPoints: {
          projected: null, // Totals not shown for summary rows for now
          actual: null, // Totals not shown for summary rows for now
          diffPercentage: totalDiffPercentage,
          projectedPerGame: projectedPerGame,
          actualPerGame: actualPerGame,
          diffPercentagePerGame: diffPercentagePerGame
        },
        totalProjectedGP:
          roundTotalProjectedGP > 0 ? roundTotalProjectedGP : null,
        totalActualGP: roundTotalActualGP > 0 ? roundTotalActualGP : null,
        playerId: `summary-round-${currentRoundNum}`,
        fullName: `Round ${currentRoundNum} Summary`,
        displayTeam: null,
        displayPosition: null,
        combinedStats: {},
        yahooAvgPick: currentRoundNum * teamCount + 0.00001
      });
      currentRoundPlayersBuffer = [];
    }
  };

  for (const player of sortedPlayers) {
    const avgPick = player.yahooAvgPick;
    let playerRound = 0;
    if (avgPick != null && avgPick > 0) {
      playerRound = Math.ceil(avgPick / Math.max(1, teamCount));
    }

    if (playerRound !== currentRoundNum) {
      processRoundBuffer(); // Process the previous round before switching
      currentRoundNum = playerRound; // Update to the current player's round
    }

    if (playerRound > 0) {
      currentRoundPlayersBuffer.push(player);
    } else {
      finalTableDataWithSummaries.push(player); // Add non-round players directly
    }
  }

  processRoundBuffer(); // Process any remaining players in the buffer

  return finalTableDataWithSummaries;
}

const DEFAULT_COLLAPSE_STATE: Record<string, boolean> = {
  // Fantasy Points group is not collapsible by default (its ID is fantasyPoints_group)
  // Other stat groups (e.g., GOALS_group, ASSISTS_group) will be initialized to true (collapsed)
  // inside the hook or when columns are first generated if not pre-populated here.
  // For now, keeping it simple to avoid top-level import issues with PLAYER_STATS_COLUMN_CONFIG_CONTEXT.
};

// --- New Modular Function: Fetch All Source Data ---
async function fetchAllSourceData(
  supabaseClient: SupabaseClient<any, "public">,
  activeSourceConfigs: ProjectionSourceConfig[],
  uniqueNhlPlayerIds: Set<number>,
  activePlayerType: "skater" | "goalie",
  currentSeasonId: string,
  // yahooDraftMode: "ALL" | "PRESEASON", // Not directly used in fetching, can be removed if only for context elsewhere
  initialRawProjectionDataById?: Record<
    string,
    { data: RawProjectionSourcePlayer[]; config: ProjectionSourceConfig }
  >
) {
  let rawProjectionDataBySourceId: Record<
    string,
    { data: RawProjectionSourcePlayer[]; config: ProjectionSourceConfig }
  >;

  if (initialRawProjectionDataById) {
    rawProjectionDataBySourceId = initialRawProjectionDataById;
  } else {
    // Fallback: Fetch Projection Data if not provided (should ideally be provided by caller in this hook's flow)
    const projectionDataPromises = activeSourceConfigs.map(
      async (sourceConfig) => {
        const selectKeys = new Set<string>([
          sourceConfig.primaryPlayerIdKey,
          sourceConfig.originalPlayerNameKey
        ]);
        if (sourceConfig.teamKey) selectKeys.add(sourceConfig.teamKey);
        if (sourceConfig.positionKey) selectKeys.add(sourceConfig.positionKey);
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
    const fetchedProjectionResults = await Promise.all(projectionDataPromises);
    rawProjectionDataBySourceId = {}; // Initialize
    fetchedProjectionResults.forEach((res) => {
      rawProjectionDataBySourceId[res.sourceId] = {
        data: res.data,
        config: res.config
      };
    });
  }

  // 2. Fetch Actual Stats
  let actualStatsMap = new Map<number, ActualPlayerStatsRow>();
  if (uniqueNhlPlayerIds.size > 0) {
    const actualStatsPlayerIdColumn =
      activePlayerType === "skater" ? "player_id" : "goalie_id";
    const actualStatsSeasonColumn =
      activePlayerType === "skater" ? "season" : "season_id";
    const actualStatsSeasonValue =
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
    const definedRelevantActualStatDbColumns =
      relevantActualStatDbColumns.filter(
        (colName): colName is string => typeof colName === "string"
      );
    const actualStatsSelectColumns = new Set([
      actualStatsPlayerIdColumn,
      ...definedRelevantActualStatDbColumns,
      "current_team_abbreviation"
    ]);
    const actualStatsSelectString = Array.from(actualStatsSelectColumns).join(
      ","
    );

    if (actualStatsSelectColumns.size > 1) {
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
        // Decide if this should throw or just return empty map
      }
    }
  }

  // 3. Fetch Yahoo NHL Player Map
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
  // --- Business Rule: Only use current-season Yahoo game prefix (e.g. 465.) ---
  const filteredYahooMapData = (yahooMapData || []).filter((m) => {
    const yahooId = m[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId];
    return (
      typeof yahooId === "string" &&
      yahooId.startsWith(CURRENT_YAHOO_GAME_PREFIX)
    );
  });

  // Fallback safety: if for some reason we have no rows for the current prefix, log a warning and revert to unfiltered to avoid empty ADP data.
  const effectiveYahooMapData =
    filteredYahooMapData.length > 0 ? filteredYahooMapData : yahooMapData;

  if (filteredYahooMapData.length === 0) {
    console.warn(
      `Yahoo map filter: no entries matched prefix ${CURRENT_YAHOO_GAME_PREFIX}. Using unfiltered data (count=${yahooMapData?.length || 0}).`
    );
  }

  // If both 453.* and 465.* rows exist for the same NHL player, prefer 465.*
  const tempDedupMap = new Map<number, YahooNhlPlayerMapEntry>();
  for (const m of effectiveYahooMapData) {
    const nhlIdNum = Number(m[YAHOO_PLAYER_MAP_KEYS.nhlPlayerId]);
    if (isNaN(nhlIdNum)) continue;
    const existing = tempDedupMap.get(nhlIdNum);
    if (!existing) {
      tempDedupMap.set(nhlIdNum, m);
      continue;
    }
    const existingYahooId = String(
      existing[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId] || ""
    );
    const incomingYahooId = String(
      m[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId] || ""
    );
    const existingIs465 = existingYahooId.startsWith(CURRENT_YAHOO_GAME_PREFIX);
    const incomingIs465 = incomingYahooId.startsWith(CURRENT_YAHOO_GAME_PREFIX);
    // Replace if incoming is 465 and existing is not 465.
    if (!existingIs465 && incomingIs465) {
      tempDedupMap.set(nhlIdNum, m);
    }
  }
  const nhlToYahooMap = tempDedupMap;

  // 4. Fetch Yahoo Player Details
  const uniqueYahooPlayerIdsFromMap = new Set<string>();
  if (effectiveYahooMapData) {
    effectiveYahooMapData.forEach((m) => {
      const yahooId = m[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId];
      if (yahooId) {
        uniqueYahooPlayerIdsFromMap.add(String(yahooId));
      }
    });
  }

  console.log("Debug - Yahoo mapping data:", {
    yahooMapDataCount: yahooMapData?.length || 0,
    filteredYahooMapDataCount: filteredYahooMapData.length,
    usingFiltered: filteredYahooMapData.length > 0,
    dedupedCount: nhlToYahooMap.size,
    uniqueYahooPlayerIdsFromMapCount: uniqueYahooPlayerIdsFromMap.size,
    sampleYahooMapData: effectiveYahooMapData?.slice(0, 3) || [],
    uniqueNhlPlayerIdsCount: uniqueNhlPlayerIds.size,
    sampleNhlPlayerIds: Array.from(uniqueNhlPlayerIds).slice(0, 5)
  });

  let yahooPlayersMap = new Map<string, YahooPlayerDetailData>();
  if (uniqueYahooPlayerIdsFromMap.size > 0) {
    const yahooPlayersSelectString = `${YAHOO_PLAYERS_TABLE_KEYS.primaryKey}, ${YAHOO_PLAYERS_TABLE_KEYS.yahooSpecificPlayerId}, ${YAHOO_PLAYERS_TABLE_KEYS.fullName}, ${YAHOO_PLAYERS_TABLE_KEYS.draftAnalysis}, ${YAHOO_PLAYERS_TABLE_KEYS.editorialTeamAbbreviation}, ${YAHOO_PLAYERS_TABLE_KEYS.displayPosition}, ${YAHOO_PLAYERS_TABLE_KEYS.eligiblePositions}, average_draft_pick, average_draft_round, percent_drafted, game_id, season`;

    // Split IDs into composite (player_key-like) and bare numeric IDs
    const compositeIds: string[] = [];
    const numericIds: string[] = [];
    for (const raw of uniqueYahooPlayerIdsFromMap) {
      if (raw.includes(".")) {
        compositeIds.push(raw);
        const tail = raw.split(".").pop();
        if (tail) numericIds.push(tail);
      } else {
        numericIds.push(raw);
      }
    }

    const results: YahooPlayerDetailData[] = [];
    // Query by player_key for composite IDs (if any)
    if (compositeIds.length) {
      const q1 = supabaseClient
        .from("yahoo_players")
        .select(yahooPlayersSelectString)
        .eq("game_id", 465)
        .in(YAHOO_PLAYERS_TABLE_KEYS.primaryKey, compositeIds);
      const data1 = await fetchAllSupabaseData<YahooPlayerDetailData>(
        q1,
        yahooPlayersSelectString
      );
      if (data1?.length) results.push(...data1);
    }
    // Query by player_id for numeric IDs (if any)
    if (numericIds.length) {
      const q2 = supabaseClient
        .from("yahoo_players")
        .select(yahooPlayersSelectString)
        .eq("game_id", 465)
        .in(YAHOO_PLAYERS_TABLE_KEYS.yahooSpecificPlayerId, numericIds);
      const data2 = await fetchAllSupabaseData<YahooPlayerDetailData>(
        q2,
        yahooPlayersSelectString
      );
      if (data2?.length) results.push(...data2);
    }

    // De-duplicate by primary key (player_key)
    const dedup = new Map<string, YahooPlayerDetailData>();
    for (const row of results) {
      const pk: any = (row as any)[YAHOO_PLAYERS_TABLE_KEYS.primaryKey];
      if (!pk) continue;
      // Prefer rows whose player_key starts with CURRENT_YAHOO_GAME_PREFIX
      const existing = dedup.get(pk);
      if (!existing) dedup.set(pk, row);
      else {
        const existingPref = (existing as any)[
          YAHOO_PLAYERS_TABLE_KEYS.primaryKey
        ]?.startsWith(CURRENT_YAHOO_GAME_PREFIX);
        const candidatePref = String(pk).startsWith(CURRENT_YAHOO_GAME_PREFIX);
        if (!existingPref && candidatePref) dedup.set(pk, row);
      }
    }

    // Build map keyed by both player_id and player_key for flexible lookup
    yahooPlayersMap = new Map<string, YahooPlayerDetailData>();
    for (const row of dedup.values()) {
      const pid = (row as any)[YAHOO_PLAYERS_TABLE_KEYS.yahooSpecificPlayerId];
      const pkey = (row as any)[YAHOO_PLAYERS_TABLE_KEYS.primaryKey];
      if (pid) yahooPlayersMap.set(String(pid), row);
      if (pkey) yahooPlayersMap.set(String(pkey), row);
    }

    if (process.env.NODE_ENV !== "production") {
      console.debug("[ADP Debug] Yahoo players fetched", {
        compositeIds: compositeIds.length,
        numericIds: numericIds.length,
        resultRows: results.length,
        dedupSize: dedup.size,
        mapSize: yahooPlayersMap.size,
        sample: Array.from(yahooPlayersMap.entries())
          .slice(0, 3)
          .map(([k, v]) => ({ k, adp: (v as any).average_draft_pick }))
      });
    }
  }

  return {
    rawProjectionDataBySourceId,
    actualStatsMap,
    nhlToYahooMap,
    yahooPlayersMap
  };
}

// --- New Modular Function: Process Raw Data into Players ---
function processRawDataIntoPlayers(
  uniqueNhlPlayerIds: Set<number>,
  rawProjectionDataBySourceId: Record<
    string,
    { data: RawProjectionSourcePlayer[]; config: ProjectionSourceConfig }
  >,
  actualStatsMap: Map<number, ActualPlayerStatsRow>,
  nhlToYahooMap: Map<number, YahooNhlPlayerMapEntry>,
  yahooPlayersMap: Map<string, YahooPlayerDetailData>,
  activeSourceConfigs: ProjectionSourceConfig[],
  relevantStatDefinitions: StatDefinition[],
  sourceControls: Record<string, { isSelected: boolean; weight: number }>,
  activePlayerType: "skater" | "goalie",
  fantasyPointSettings: Record<string, number>,
  yahooDraftMode: "ALL" | "PRESEASON",
  customNameIndexBySource: Map<string, Map<string, CustomNameIndexEntry[]>>,
  allowNameFallback: boolean,
  customSourceIds: Set<string>,
  fallbackUsageTracker: Map<string, Set<number>>
) {
  const tempProcessedPlayers: ProcessedPlayer[] = [];
  const playersRequiringNameDebug: Array<any> = []; // Use 'any' for now, refine if needed

  for (const nhlPlayerId of uniqueNhlPlayerIds) {
    const playerYahooMapEntry = nhlToYahooMap.get(nhlPlayerId);
    const nameFromYahooMapNhlNameRaw =
      playerYahooMapEntry?.[YAHOO_PLAYER_MAP_KEYS.nhlPlayerName];
    const nameFromYahooMapNhlName =
      typeof nameFromYahooMapNhlNameRaw === "string" &&
      nameFromYahooMapNhlNameRaw.trim() !== ""
        ? nameFromYahooMapNhlNameRaw.trim()
        : null;

    let resolvedName = nameFromYahooMapNhlName;
    let logThisPlayer = !nameFromYahooMapNhlName;

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
      }
    }

    const yahooPlayerDetail = playerYahooMapEntry?.[
      YAHOO_PLAYER_MAP_KEYS.yahooPlayerId
    ]
      ? yahooPlayersMap.get(
          String(playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId])
        )
      : null;

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
      }
    }

    if (!resolvedName) {
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
          typeof nameFromSrcRaw === "string" && nameFromSrcRaw.trim() !== ""
            ? nameFromSrcRaw.trim()
            : null;

        if (nameFromSrc) {
          resolvedName = nameFromSrc;
          break;
        }
      }
    }

    const finalName = resolvedName || "Unknown Player";

    if (finalName === "Unknown Player") {
      logThisPlayer = true;
    }

    const processedPlayer: ProcessedPlayer = {
      playerId: nhlPlayerId,
      fullName: finalName,
      displayTeam: null,
      displayPosition: null,
      combinedStats: {},
      fantasyPoints: {
        projected: null,
        actual: null,
        diffPercentage: null,
        projectedPerGame: null,
        actualPerGame: null
      },
      yahooPlayerId: playerYahooMapEntry?.[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId]
        ? String(playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId])
        : undefined
    };

    const playerActualStatsRow = actualStatsMap.get(nhlPlayerId);
    const targetTeamUpper =
      playerActualStatsRow?.current_team_abbreviation &&
      typeof playerActualStatsRow.current_team_abbreviation === "string"
        ? playerActualStatsRow.current_team_abbreviation.toUpperCase()
        : null;
    const fallbackNameKey = allowNameFallback ? stdName(finalName) : "";
    const sourceRowCache = new Map<string, RawProjectionSourcePlayer | null>();
    const getSourceRowForPlayer = (
      sourceConfig: ProjectionSourceConfig
    ): RawProjectionSourcePlayer | null => {
      if (sourceRowCache.has(sourceConfig.id)) {
        return sourceRowCache.get(sourceConfig.id) || null;
      }
      const collection =
        rawProjectionDataBySourceId[sourceConfig.id]?.data || [];
      const directMatch = collection.find(
        (p: RawProjectionSourcePlayer) =>
          Number(p[sourceConfig.primaryPlayerIdKey]) === nhlPlayerId
      );
      if (directMatch) {
        sourceRowCache.set(sourceConfig.id, directMatch);
        return directMatch;
      }
      if (
        !allowNameFallback ||
        !fallbackNameKey ||
        !customSourceIds.has(sourceConfig.id)
      ) {
        sourceRowCache.set(sourceConfig.id, null);
        return null;
      }
      const nameIndex = customNameIndexBySource.get(sourceConfig.id);
      if (!nameIndex) {
        sourceRowCache.set(sourceConfig.id, null);
        return null;
      }
      const candidates = nameIndex.get(fallbackNameKey) || [];
      if (!candidates.length) {
        sourceRowCache.set(sourceConfig.id, null);
        return null;
      }
      let selected: CustomNameIndexEntry | undefined;
      if (targetTeamUpper) {
        const teamMatches = candidates.filter(
          (entry) => entry.team === targetTeamUpper
        );
        if (teamMatches.length === 1) {
          selected = teamMatches[0];
        } else if (teamMatches.length > 1) {
          selected = teamMatches.reduce((best, entry) => {
            const gp = entry.gamesPlayed ?? -1;
            const bestGp = best?.gamesPlayed ?? -1;
            if (!best || gp > bestGp) return entry;
            return best;
          }, teamMatches[0]);
        }
      }
      if (!selected) {
        selected = candidates.reduce((best, entry) => {
          const gp = entry.gamesPlayed ?? -1;
          const bestGp = best?.gamesPlayed ?? -1;
          if (!best || gp > bestGp) return entry;
          return best;
        }, undefined as CustomNameIndexEntry | undefined);
      }
      const fallbackRow = selected?.row || null;
      sourceRowCache.set(sourceConfig.id, fallbackRow);
      if (fallbackRow) {
        if (!fallbackUsageTracker.has(sourceConfig.id)) {
          fallbackUsageTracker.set(sourceConfig.id, new Set());
        }
        fallbackUsageTracker.get(sourceConfig.id)!.add(nhlPlayerId);
      }
      return fallbackRow;
    };

    if (logThisPlayer) {
      let loggedNameFromProjectionSource: string | null = null;
      if (
        resolvedName &&
        !nameFromYahooMapNhlName &&
        !nameFromYahooMapYahooName &&
        !nameFromYahooPlayersTable
      ) {
        for (const sourceConfig of activeSourceConfigs) {
          const sourceDataForPlayer = getSourceRowForPlayer(sourceConfig);
          const nameFromSrcRaw =
            sourceDataForPlayer?.[sourceConfig.originalPlayerNameKey];
          const nameFromSrc =
            typeof nameFromSrcRaw === "string" && nameFromSrcRaw.trim() !== ""
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
        const sourceDataForPlayer = getSourceRowForPlayer(sourceConfig);
        if (sourceDataForPlayer) {
          sourcesInfo.push({
            sourceId: sourceConfig.id,
            sourceDisplayName: sourceConfig.displayName,
            originalPlayerNameInSource:
              sourceDataForPlayer[sourceConfig.originalPlayerNameKey] || null
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
        const sourceDataForPlayer = getSourceRowForPlayer(sourceConfig);

        if (statMapping && sourceDataForPlayer) {
          const rawValue = sourceDataForPlayer[statMapping.dbColumnName];
          let parsedValue: number | null = null;
          if (rawValue !== null && rawValue !== undefined) {
            if (statMapping.parser) parsedValue = statMapping.parser(rawValue);
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

      let weightedSum = 0;
      let totalWeight = 0;
      const contributingToAvg: AggregatedStatValue["contributingSources"] = [];

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

      projectedValue = totalWeight > 0 ? weightedSum / totalWeight : null;

      const projectedDetail: AggregatedStatValue = {
        value: projectedValue,
        contributingSources: contributingToAvg,
        missingFromSelectedSources: missingFromSelectedForStat,
        statDefinition: statDef
      };

      let actualValue: number | null = null;
      const actualStatDbColumn =
        ACTUAL_STATS_COLUMN_MAP[activePlayerType]?.[statDef.key];

      if (
        playerActualStatsRow &&
        actualStatDbColumn &&
        playerActualStatsRow[actualStatDbColumn] !== null &&
        playerActualStatsRow[actualStatDbColumn] !== undefined
      ) {
        let rawActual = playerActualStatsRow[actualStatDbColumn];

        if (statDef.key === "TIME_ON_ICE_PER_GAME") {
          if (typeof rawActual === "string") {
            const parts = rawActual.split(":");
            if (parts.length === 2) {
              const minutes = parseInt(parts[0], 10);
              const seconds = parseInt(parts[1], 10);
              if (!isNaN(minutes) && !isNaN(seconds)) {
                actualValue = minutes * 60 + seconds;
              } else {
                actualValue = null;
              }
            } else {
              const numericVal = Number(rawActual);
              actualValue = isNaN(numericVal) ? null : numericVal;
            }
          } else if (typeof rawActual === "number") {
            actualValue = rawActual / 60;
          } else if (rawActual === null || rawActual === undefined) {
            actualValue = null;
          } else {
            const numericVal = Number(rawActual);
            actualValue = isNaN(numericVal) ? null : numericVal / 60;
          }
        } else if (statDef.key === "SAVE_PERCENTAGE") {
          let numValue: number | null = null;
          if (typeof rawActual === "number") {
            numValue =
              rawActual > 1 && rawActual <= 100 ? rawActual / 100 : rawActual;
          } else if (typeof rawActual === "string") {
            if (rawActual.endsWith("%")) {
              numValue = parseFloat(rawActual.replace("%", "")) / 100;
            } else {
              numValue = parseFloat(rawActual);
            }
          }
          actualValue = numValue === null || isNaN(numValue) ? null : numValue;
        } else {
          const numericVal = Number(rawActual);
          actualValue = isNaN(numericVal) ? null : numericVal;
        }
      }

      processedPlayer.combinedStats[statDef.key] = {
        projected: projectedValue,
        actual: actualValue,
        diffPercentage: calculateDiffPercentage(actualValue, projectedValue),
        projectedDetail: projectedDetail
      };
    }

    let teamFromSources: string | null = null;
    let positionFromSources: string | null = null;

    for (const sourceConfig of activeSourceConfigs) {
      const sourceDataForPlayer = getSourceRowForPlayer(sourceConfig);
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
          positionFromSources = sourceDataForPlayer[sourceConfig.positionKey];
        }
      }
      if (teamFromSources && positionFromSources) break;
    }

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
      positionFromSources = playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.position];
    }

    if (
      !teamFromSources &&
      yahooPlayerDetail?.[YAHOO_PLAYERS_TABLE_KEYS.editorialTeamAbbreviation]
    ) {
      teamFromSources =
        yahooPlayerDetail[YAHOO_PLAYERS_TABLE_KEYS.editorialTeamAbbreviation];
    }
    if (
      !positionFromSources &&
      yahooPlayerDetail?.[YAHOO_PLAYERS_TABLE_KEYS.displayPosition]
    ) {
      positionFromSources =
        yahooPlayerDetail[YAHOO_PLAYERS_TABLE_KEYS.displayPosition];
    }

    const actualTeamAbbreviation =
      playerActualStatsRow?.current_team_abbreviation;

    if (
      actualTeamAbbreviation &&
      typeof actualTeamAbbreviation === "string" &&
      actualTeamAbbreviation.trim() !== ""
    ) {
      processedPlayer.displayTeam = actualTeamAbbreviation.trim();
    } else {
      processedPlayer.displayTeam = teamFromSources;
    }
    processedPlayer.displayPosition = positionFromSources;
    // Eligible positions from yahoo_players (array of strings like ["C","RW"])
    try {
      const rawElig = yahooPlayerDetail?.[
        YAHOO_PLAYERS_TABLE_KEYS.eligiblePositions
      ] as any;
      if (Array.isArray(rawElig)) {
        const norm = rawElig
          .map((s) =>
            String(s || "")
              .trim()
              .toUpperCase()
          )
          .filter(Boolean);
        if (norm.length) processedPlayer.eligiblePositions = norm;
      } else if (typeof rawElig === "string" && rawElig.trim() !== "") {
        // Fallback if stored as comma-delimited string
        const norm = rawElig
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        if (norm.length) processedPlayer.eligiblePositions = norm;
      }
    } catch {}

    // Add derived stat: DEFENSE_POINTS (Defensemen goals + assists)
    try {
      const posStr = String(
        processedPlayer.displayPosition || ""
      ).toUpperCase();
      const isDefenseman = posStr
        .split(",")
        .map((s) => s.trim())
        .includes("D");
      const gProj = processedPlayer.combinedStats.GOALS?.projected ?? null;
      const aProj = processedPlayer.combinedStats.ASSISTS?.projected ?? null;
      const gAct = processedPlayer.combinedStats.GOALS?.actual ?? null;
      const aAct = processedPlayer.combinedStats.ASSISTS?.actual ?? null;

      const sumNullable = (x: number | null, y: number | null) => {
        if (x == null && y == null) return null;
        return (x || 0) + (y || 0);
      };

      const dpProjected = isDefenseman ? sumNullable(gProj, aProj) : null;
      const dpActual = isDefenseman ? sumNullable(gAct, aAct) : null;

      // Only attach when defenseman to avoid marking FP as "valid" for others
      if (isDefenseman) {
        const dpStatDef = STATS_MASTER_LIST.find(
          (s) => s.key === "DEFENSE_POINTS"
        )!;
        processedPlayer.combinedStats["DEFENSE_POINTS"] = {
          projected: dpProjected,
          actual: dpActual,
          diffPercentage: calculateDiffPercentage(dpActual, dpProjected),
          projectedDetail: {
            value: dpProjected,
            contributingSources: [],
            missingFromSelectedSources: [],
            statDefinition: dpStatDef
          }
        };
      }
    } catch (e) {
      // Fail-safe: do not block processing if derived stat computation fails
      console.warn("Derived stat DEFENSE_POINTS computation failed", e);
    }

    // Add derived stat: SH_ASSISTS (Short-Handed Assists) = SH_POINTS - SH_GOALS when both available
    try {
      const shpProj =
        processedPlayer.combinedStats.SH_POINTS?.projected ?? null;
      const shpAct = processedPlayer.combinedStats.SH_POINTS?.actual ?? null;
      const shgProj =
        (processedPlayer.combinedStats as any).SH_GOALS?.projected ?? null;
      const shgAct =
        (processedPlayer.combinedStats as any).SH_GOALS?.actual ?? null;

      const shaProjected =
        shpProj != null && shgProj != null ? shpProj - shgProj : null;
      const shaActual =
        shpAct != null && shgAct != null ? shpAct - shgAct : null;

      if (shaProjected != null || shaActual != null) {
        const shaDef = STATS_MASTER_LIST.find((s) => s.key === "SH_ASSISTS");
        if (shaDef) {
          (processedPlayer.combinedStats as any)["SH_ASSISTS"] = {
            projected: shaProjected,
            actual: shaActual,
            diffPercentage: calculateDiffPercentage(shaActual, shaProjected),
            projectedDetail: {
              value: shaProjected,
              contributingSources: [],
              missingFromSelectedSources: [],
              statDefinition: shaDef
            }
          };
        }
      }
    } catch (e) {
      console.warn("Derived stat SH_ASSISTS computation failed", e);
    }

    // Read Yahoo draft data directly from table columns instead of JSON field
    if (yahooPlayerDetail) {
      const parseYahooStat = (val: string | number | null | undefined) => {
        if (val === "-" || val === null || val === undefined) return null;
        const num = parseFloat(String(val));
        return isNaN(num) ? null : num;
      };

      // Read directly from the direct columns using the updated keys
      const modeKeys = YAHOO_DRAFT_ANALYSIS_KEYS[yahooDraftMode];

      // Debug logging to see what's actually in the yahooPlayerDetail
      console.log("Debug - Yahoo Player Detail:", {
        playerId: nhlPlayerId,
        playerName: finalName,
        yahooPlayerDetail: yahooPlayerDetail,
        modeKeys: modeKeys,
        avgPickValue: yahooPlayerDetail[modeKeys.avgPick],
        avgRoundValue: yahooPlayerDetail[modeKeys.avgRound],
        pctDraftedValue: yahooPlayerDetail[modeKeys.pctDrafted]
      });

      const rawAvgPick = yahooPlayerDetail[modeKeys.avgPick];
      processedPlayer.yahooAvgPick = parseYahooStat(rawAvgPick);
      processedPlayer.yahooAvgRound = parseYahooStat(
        yahooPlayerDetail[modeKeys.avgRound]
      );
      const pctDraftedNum = parseYahooStat(
        yahooPlayerDetail[modeKeys.pctDrafted]
      );
      processedPlayer.yahooPctDrafted =
        pctDraftedNum !== null ? pctDraftedNum * 100 : null;
      if (
        process.env.NODE_ENV !== "production" &&
        processedPlayer.yahooAvgPick == null &&
        rawAvgPick != null
      ) {
        console.warn("[ADP Debug] Failed to parse average_draft_pick value", {
          nhlPlayerId,
          rawAvgPick,
          finalName
        });
      }
    }

    let calculatedProjectedFP = 0;
    let calculatedActualFP = 0;
    let hasValidStatForFP = false;

    for (const statKey in processedPlayer.combinedStats) {
      const combinedStat = processedPlayer.combinedStats[statKey];
      const pointValueForStat = fantasyPointSettings[statKey];

      if (pointValueForStat !== undefined && pointValueForStat !== 0) {
        if (combinedStat?.projected !== null) {
          calculatedProjectedFP += combinedStat.projected * pointValueForStat;
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
    processedPlayer.fantasyPoints.diffPercentage = calculateDiffPercentage(
      processedPlayer.fantasyPoints.actual,
      processedPlayer.fantasyPoints.projected
    );

    const projectedGP = processedPlayer.combinedStats.GAMES_PLAYED?.projected;
    const actualGP = processedPlayer.combinedStats.GAMES_PLAYED?.actual;

    processedPlayer.fantasyPoints.projectedPerGame =
      processedPlayer.fantasyPoints.projected !== null &&
      projectedGP !== null &&
      projectedGP > 0
        ? processedPlayer.fantasyPoints.projected / projectedGP
        : null;

    processedPlayer.fantasyPoints.actualPerGame =
      processedPlayer.fantasyPoints.actual !== null &&
      actualGP !== null &&
      actualGP > 0
        ? processedPlayer.fantasyPoints.actual / actualGP
        : null;

    tempProcessedPlayers.push(processedPlayer);
  } // End loop over uniqueNhlPlayerIds

  return { tempProcessedPlayers, playersRequiringNameDebug };
}

// Async yielding variant to allow mid-loop stale abort & UI responsiveness.
async function processRawDataIntoPlayersAsync(
  uniqueNhlPlayerIds: Set<number>,
  rawProjectionDataBySourceId: Record<
    string,
    { data: RawProjectionSourcePlayer[]; config: ProjectionSourceConfig }
  >,
  actualStatsMap: Map<number, ActualPlayerStatsRow>,
  nhlToYahooMap: Map<number, YahooNhlPlayerMapEntry>,
  yahooPlayersMap: Map<string, YahooPlayerDetailData>,
  activeSourceConfigs: ProjectionSourceConfig[],
  relevantStatDefinitions: StatDefinition[],
  sourceControls: Record<string, { isSelected: boolean; weight: number }>,
  activePlayerType: "skater" | "goalie",
  fantasyPointSettings: Record<string, number>,
  yahooDraftMode: "ALL" | "PRESEASON",
  customNameIndexBySource: Map<string, Map<string, CustomNameIndexEntry[]>>,
  allowNameFallback: boolean,
  customSourceIds: Set<string>,
  fallbackUsageTracker: Map<string, Set<number>>
) {
  return processRawDataIntoPlayers(
    uniqueNhlPlayerIds,
    rawProjectionDataBySourceId,
    actualStatsMap,
    nhlToYahooMap,
    yahooPlayersMap,
    activeSourceConfigs,
    relevantStatDefinitions,
    sourceControls,
    activePlayerType,
    fantasyPointSettings,
    yahooDraftMode,
    customNameIndexBySource,
    allowNameFallback,
    customSourceIds,
    fallbackUsageTracker
  );
}

// --- Main Hook ---
export const useProcessedProjectionsData = ({
  activePlayerType,
  sourceControls,
  yahooDraftMode,
  fantasyPointSettings,
  supabaseClient,
  currentSeasonId,
  styles,
  showPerGameFantasyPoints,
  togglePerGameFantasyPoints,
  teamCountForRoundSummaries,
  customAdditionalSource,
  customAdditionalSources,
  refreshKey,
  allowCustomNameFallback = true
}: UseProcessedProjectionsDataProps): UseProcessedProjectionsDataReturn => {
  const [processedPlayers, setProcessedPlayers] = useState<TableDataRow[]>([]);
  const [tableColumns, setTableColumns] = useState<
    ColumnDef<TableDataRow, any>[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customFallbackUsageState, setCustomFallbackUsageState] = useState<{
    total: number;
    bySource: Record<string, number>;
  }>({ total: 0, bySource: {} });
  const fetchRunIdRef = useRef(0);
  const basePlayersRef = useRef<ProcessedPlayer[] | null>(null);
  const lastBaseKeyRef = useRef<string>("");
  const lastFPKeyRef = useRef<string>("");
  const fallbackLoggedRef = useRef(false);

  const [statGroupCollapseState, setStatGroupCollapseState] = useState<
    Record<string, boolean>
  >({});

  const toggleStatGroupCollapse = useCallback((groupId: string) => {
    setStatGroupCollapseState((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  }, []);

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

  const customSourceResolutions = useMemo(() => {
    const map: Record<string, CustomSourceResolutionMeta | undefined> = {};
    (customAdditionalSources || []).forEach((src) => {
      map[src.id] = src.resolution;
    });
    if (customAdditionalSource) {
      map[customAdditionalSource.id] = customAdditionalSource.resolution;
    }
    return map;
  }, [customAdditionalSources, customAdditionalSource]);

  // Stabilize dependencies with useMemo to prevent infinite loops
  const stableSourceControls = useMemo(() => {
    // Create a stable reference only when the actual values change
    const keys = Object.keys(sourceControls).sort();
    const stableObj: Record<string, { isSelected: boolean; weight: number }> =
      {};
    keys.forEach((key) => {
      stableObj[key] = sourceControls[key];
    });
    return stableObj;
  }, [
    Object.keys(sourceControls).sort().join(","),
    ...Object.keys(sourceControls)
      .sort()
      .map(
        (key) =>
          `${sourceControls[key]?.isSelected}-${sourceControls[key]?.weight}`
      )
  ]);

  const stableFantasyPointSettings = useMemo(() => {
    // Create a stable reference only when the actual values change
    const keys = Object.keys(fantasyPointSettings).sort();
    const stableObj: Record<string, number> = {};
    keys.forEach((key) => {
      stableObj[key] = fantasyPointSettings[key];
    });
    return stableObj;
  }, [
    Object.keys(fantasyPointSettings).sort().join(","),
    ...Object.keys(fantasyPointSettings)
      .sort()
      .map((key) => fantasyPointSettings[key])
  ]);

  // Create stable string representations for cache comparison
  const stableSourceControlsString = useMemo(
    () => JSON.stringify(stableSourceControls),
    [stableSourceControls]
  );
  const stableFantasyPointSettingsString = useMemo(
    () => JSON.stringify(stableFantasyPointSettings),
    [stableFantasyPointSettings]
  );

  const stableCustomAdditionalSourcesString = useMemo(() => {
    if (customAdditionalSources && customAdditionalSources.length) {
      const payload = customAdditionalSources.map((s) => ({
        id: s.id,
        playerType: s.playerType,
        rowsLen: s.rows?.length || 0
      }));
      return JSON.stringify(payload);
    }
    if (customAdditionalSource) {
      return JSON.stringify({
        id: customAdditionalSource.id,
        playerType: customAdditionalSource.playerType,
        rowsLen: customAdditionalSource.rows?.length || 0
      });
    }
    return "none";
  }, [customAdditionalSources, customAdditionalSource]);

  // Composite keys (lightweight) for detecting FP-only updates (must come after stableCustomAdditionalSourcesString)
  const baseKey = useMemo(
    () =>
      `${activePlayerType}|${stableSourceControlsString}|${yahooDraftMode}|${currentSeasonId || ""}|${stableCustomAdditionalSourcesString}|${refreshKey ?? ""}`,
    [
      activePlayerType,
      stableSourceControlsString,
      yahooDraftMode,
      currentSeasonId,
      stableCustomAdditionalSourcesString,
      refreshKey
    ]
  );
  const fpKey = useMemo(
    () =>
      `${baseKey}|fp:${stableFantasyPointSettingsString}|pg:${showPerGameFantasyPoints}`,
    [baseKey, stableFantasyPointSettingsString, showPerGameFantasyPoints]
  );

  useEffect(() => {
    const relevantStatDefsForCollapse = STATS_MASTER_LIST.filter(
      (stat) =>
        (activePlayerType === "skater" && stat.isSkaterStat) ||
        (activePlayerType === "goalie" && stat.isGoalieStat)
    );
    const initialCollapseStateForType: Record<string, boolean> = {};
    relevantStatDefsForCollapse.forEach((statDef) => {
      const groupId = `${statDef.key}_group`;
      initialCollapseStateForType[groupId] = true;
    });
    initialCollapseStateForType["fantasyPoints_group"] = false;
    if (initialCollapseStateForType.hasOwnProperty("GAMES_PLAYED_group")) {
      initialCollapseStateForType["GAMES_PLAYED_group"] = false;
    }
    setStatGroupCollapseState(initialCollapseStateForType);
  }, [activePlayerType]);

  const fetchDataAndProcess = useCallback(async () => {
    const runId = ++fetchRunIdRef.current;
    if (!supabaseClient || !currentSeasonId) {
      setError("Supabase client or current season ID not available in hook.");
      setProcessedPlayers([]);
      setTableColumns([]);
      setIsLoading(false);
      return;
    }

    const cacheTypeKey = activePlayerType;

    const generateTableCols = () =>
      generateTableColumns(
        activePlayerType,
        STATS_MASTER_LIST,
        PROJECTION_SOURCES_CONFIG,
        stableSourceControls,
        currentSeasonId,
        styles,
        showPerGameFantasyPoints,
        togglePerGameFantasyPoints
      );

    if (!cache.current[cacheTypeKey]) {
      cache.current[cacheTypeKey] = {};
    }
    const currentTypeCache = cache.current[cacheTypeKey]!;

    // If customAdditionalSource changes, bust caches related to that playerType (simple approach for now)
    const anyCustomForType =
      (customAdditionalSources || []).some(
        (s) => s.playerType === activePlayerType
      ) ||
      (customAdditionalSource &&
        customAdditionalSource.playerType === activePlayerType);
    if (anyCustomForType) {
      // Invalidate caches so new data flows through
      currentTypeCache.base = undefined;
      currentTypeCache.full = undefined;
    }

    // Check full cache first using stable string representations (skip if custom source present since invalidated above)
    if (
      currentTypeCache.full &&
      currentTypeCache.full.sourceControlsSnapshot ===
        stableSourceControlsString &&
      currentTypeCache.full.yahooModeSnapshot === yahooDraftMode &&
      currentTypeCache.full.currentSeasonIdSnapshot === currentSeasonId &&
      currentTypeCache.full.fantasyPointSettingsSnapshot ===
        stableFantasyPointSettingsString &&
      currentTypeCache.full.showPerGameFantasyPointsSnapshot ===
        showPerGameFantasyPoints &&
      currentTypeCache.full.refreshKeySnapshot === refreshKey &&
      !(customAdditionalSources && customAdditionalSources.length) &&
      !customAdditionalSource // only reuse cache if no custom sources
    ) {
      setProcessedPlayers(currentTypeCache.full.data);
      const freshColumns = generateTableCols();
      const derivedCols = deriveVisibleColumns(
        freshColumns,
        statGroupCollapseState,
        toggleStatGroupCollapse,
        styles,
        showPerGameFantasyPoints,
        togglePerGameFantasyPoints
      );
      setTableColumns(derivedCols);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Fast path: only FP settings changed (structure stable)
    if (
      basePlayersRef.current &&
      lastBaseKeyRef.current === baseKey &&
      lastFPKeyRef.current !== fpKey
    ) {
      try {
        // Recalculate fantasy points only (placeholder: full implementation would re-run FP calc using stableFantasyPointSettings)
        // For now, we simply mark FP key updated to avoid full fetch if nothing structural changed.
        lastFPKeyRef.current = fpKey;
        return; // skip heavy work (temporary until FP-only calc extracted)
      } catch (e) {
        console.warn(
          "FP-only recompute failed; falling back to full rebuild",
          e
        );
      }
    }

    setIsLoading(true);
    setError(null);
    const DEV =
      typeof process !== "undefined" && process.env.NODE_ENV !== "production";
    const phaseMarks: Record<string, number> = {};
    const mark = (p: string) => {
      phaseMarks[p] =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (DEV) console.log(`[ProjectionsPhase] ${p}`);
    };
    mark("start");

    const relevantStatDefinitions = STATS_MASTER_LIST.filter(
      (stat) =>
        (activePlayerType === "skater" && stat.isSkaterStat) ||
        (activePlayerType === "goalie" && stat.isGoalieStat)
    );

    // Assemble active source configs including optional custom source
    const baseActiveSourceConfigs = PROJECTION_SOURCES_CONFIG.filter(
      (src) =>
        src.playerType === activePlayerType &&
        stableSourceControls[src.id]?.isSelected
    );

    const augmentedActiveSourceConfigs: ProjectionSourceConfig[] = [
      ...baseActiveSourceConfigs
    ];
    const customById = new Map<string, CustomAdditionalProjectionSource>();
    (customAdditionalSources || []).forEach((s) => customById.set(s.id, s));
    if (customAdditionalSource)
      customById.set(customAdditionalSource.id, customAdditionalSource);

    // Push selected custom sources for this player type
    for (const s of Array.from(customById.values())) {
      if (s.playerType !== activePlayerType) continue;
      const ctrl = stableSourceControls[s.id];
      if (!ctrl || !ctrl.isSelected) continue;
      augmentedActiveSourceConfigs.push({
        id: s.id,
        displayName: s.displayName,
        tableName: "__custom_session__",
        playerType: s.playerType,
        primaryPlayerIdKey: s.primaryPlayerIdKey,
        originalPlayerNameKey: s.originalPlayerNameKey,
        teamKey: s.teamKey,
        positionKey: s.positionKey,
        statMappings: s.statMappings
      });
    }

    if (augmentedActiveSourceConfigs.length === 0) {
      setProcessedPlayers([]);
      setTableColumns([]);
      setIsLoading(false);
      return;
    }

    // If we have base cache (no custom source) attempt reuse logic below; otherwise fetch/process
    try {
      // Build raw projection data map (skip Supabase fetch for custom source)
      mark("fetch:projectionSources:start");
      const projectionDataPromises = augmentedActiveSourceConfigs.map(
        async (sourceConfig) => {
          // If this ID belongs to a custom in-memory source, return its rows
          const mem = customById.get(sourceConfig.id);
          if (mem) {
            return {
              sourceId: sourceConfig.id,
              data: (mem.rows || []) as RawProjectionSourcePlayer[],
              config: sourceConfig
            };
          }
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
              selectString,
              { label: `projection:${sourceConfig.id}` }
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
      mark("fetch:projectionSources:done");
      const initialRawProjectionDataById: Record<
        string,
        { data: RawProjectionSourcePlayer[]; config: ProjectionSourceConfig }
      > = {};
      fetchedProjectionResults.forEach((res) => {
        initialRawProjectionDataById[res.sourceId] = {
          data: res.data,
          config: res.config
        };
      });

      // Name disambiguation and merge for any newly added source: map by standardized name to existing ids
      try {
        const { standardizePlayerName } = await import(
          "lib/standardization/nameStandardization"
        );
        const mkKey = (s: string) =>
          (s || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        // For each target source, build an index from all other sources, then attempt to align ids
        for (const targetCfg of augmentedActiveSourceConfigs) {
          const nameToIds = new Map<string, Set<number>>();
          const idToTeam = new Map<number, string>();

          for (const cfg of augmentedActiveSourceConfigs) {
            if (cfg.id === targetCfg.id) continue;
            const rows = initialRawProjectionDataById[cfg.id]?.data || [];
            const nameKey = cfg.originalPlayerNameKey;
            const teamKey = cfg.teamKey;
            const idKey = cfg.primaryPlayerIdKey;
            for (const row of rows) {
              const id = row[idKey];
              if (id == null) continue;
              const idNum = Number(id);
              if (!Number.isFinite(idNum)) continue;
              const rawName = (row as any)[nameKey];
              const canon = standardizePlayerName(String(rawName || ""));
              const key = mkKey(canon);
              if (!nameToIds.has(key)) nameToIds.set(key, new Set());
              nameToIds.get(key)!.add(idNum);
              if (teamKey && (row as any)[teamKey]) {
                const t = String((row as any)[teamKey]);
                if (!idToTeam.has(idNum)) idToTeam.set(idNum, t);
              }
            }
          }

          const rows = initialRawProjectionDataById[targetCfg.id]?.data || [];
          if (!rows.length) continue;
          const nameKey = targetCfg.originalPlayerNameKey;
          const teamKey = targetCfg.teamKey;
          const idKey = targetCfg.primaryPlayerIdKey;
          for (const row of rows) {
            const rawName = (row as any)[nameKey];
            if (!rawName) continue;
            const canon = standardizePlayerName(String(rawName));
            const key = mkKey(canon);
            const candidates = nameToIds.get(key);
            if (!candidates || candidates.size === 0) continue;
            let resolved: number | null = null;
            if (candidates.size === 1) {
              resolved = Array.from(candidates)[0];
            } else if (teamKey && (row as any)[teamKey]) {
              const team = String((row as any)[teamKey]);
              for (const id of candidates) {
                if (idToTeam.get(id) === team) {
                  resolved = id;
                  break;
                }
              }
            }
            if (resolved != null) {
              (row as any)[idKey] = resolved;
            }
          }
        }
      } catch (e) {
        console.warn("Name-based id alignment failed:", (e as any)?.message);
      }

      const customSourceIds = new Set<string>(customById.keys());
      const customNameIndexBySource = new Map<
        string,
        Map<string, CustomNameIndexEntry[]>
      >();
      if (allowCustomNameFallback && customSourceIds.size) {
        for (const sourceId of customSourceIds) {
          const snapshot = initialRawProjectionDataById[sourceId];
          if (!snapshot) continue;
          const { data, config } = snapshot;
          if (!data || !data.length) continue;
          const nameKey = config.originalPlayerNameKey;
          const teamKey = config.teamKey || "Team_Abbreviation";
          const gpColumn =
            config.statMappings.find((m) => m.key === "GAMES_PLAYED")
              ?.dbColumnName || "Games_Played";
          const nameMap = new Map<string, CustomNameIndexEntry[]>();
          data.forEach((row) => {
            const rawName = (row as any)[nameKey];
            if (!rawName) return;
            const normalized = stdName(String(rawName));
            if (!normalized) return;
            const teamRaw = (row as any)[teamKey];
            const team =
              typeof teamRaw === "string" && teamRaw.trim() !== ""
                ? teamRaw.trim().toUpperCase()
                : null;
            const gpRaw = (row as any)[gpColumn];
            const gpNum =
              gpRaw !== null && gpRaw !== undefined && gpRaw !== ""
                ? Number(gpRaw)
                : null;
            const gamesPlayed = Number.isFinite(gpNum as number)
              ? (gpNum as number)
              : null;
            if (!nameMap.has(normalized)) nameMap.set(normalized, []);
            nameMap.get(normalized)!.push({
              row,
              team,
              gamesPlayed
            });
          });
          customNameIndexBySource.set(sourceId, nameMap);
        }
      }

      // Collect unique player IDs
      const uniqueNhlPlayerIds = new Set<number>();
      augmentedActiveSourceConfigs.forEach((sourceConfig) => {
        const sourceData = initialRawProjectionDataById[sourceConfig.id]?.data;
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

      // Fetch other data (actuals + Yahoo) using helper
      mark("fetch:aux:start");
      const fetchedData = await fetchAllSourceData(
        supabaseClient,
        augmentedActiveSourceConfigs,
        uniqueNhlPlayerIds,
        activePlayerType,
        currentSeasonId,
        initialRawProjectionDataById
      );
      mark("fetch:aux:done");

      mark("process:players:start");
      const fallbackUsageTracker = new Map<string, Set<number>>();
      const { tempProcessedPlayers, playersRequiringNameDebug } =
        await processRawDataIntoPlayersAsync(
          uniqueNhlPlayerIds,
          fetchedData.rawProjectionDataBySourceId,
          fetchedData.actualStatsMap,
          fetchedData.nhlToYahooMap,
          fetchedData.yahooPlayersMap,
          augmentedActiveSourceConfigs,
          relevantStatDefinitions,
          stableSourceControls,
          activePlayerType,
          stableFantasyPointSettings,
          yahooDraftMode,
          customNameIndexBySource,
          allowCustomNameFallback,
          customSourceIds,
          fallbackUsageTracker
        );
      if (runId !== fetchRunIdRef.current) return; // stale after processing
      mark("process:players:done");

      const fallbackUsageBySource: Record<string, number> = {};
      let fallbackTotal = 0;
      fallbackUsageTracker.forEach((set, sourceId) => {
        const count = set.size;
        if (count > 0) {
          fallbackUsageBySource[sourceId] = count;
          fallbackTotal += count;
        }
      });
      setCustomFallbackUsageState({
        total: fallbackTotal,
        bySource: fallbackUsageBySource
      });
      if (fallbackTotal > 0 && !fallbackLoggedRef.current) {
        try {
          console.log(
            `[ProjectionFallback] Name fallback used for ${fallbackTotal} players`,
            fallbackUsageBySource
          );
        } catch {}
        fallbackLoggedRef.current = true;
      }

      if (playersRequiringNameDebug.length > 0) {
        console.warn(
          "[FHFHockey Debug] Player Name Resolution Issues Encountered (including custom CSV if present):",
          playersRequiringNameDebug.length
        );
      }

      // Cache base only if custom source absent (custom source data is session-volatile)
      if (
        !(customAdditionalSources && customAdditionalSources.length) &&
        !customAdditionalSource
      ) {
        currentTypeCache.base = {
          data: tempProcessedPlayers,
          sourceControlsSnapshot: stableSourceControlsString,
          yahooModeSnapshot: yahooDraftMode,
          currentSeasonIdSnapshot: currentSeasonId
        };
      }

      const sortedPlayersForSummary = [...tempProcessedPlayers].sort((a, b) => {
        const pickA = a.yahooAvgPick ?? Infinity;
        const pickB = b.yahooAvgPick ?? Infinity;
        return pickA - pickB;
      });
      if (runId !== fetchRunIdRef.current) {
        if (DEV)
          console.debug(
            "[Projections] Aborted stale run before round summaries"
          );
        return;
      }
      mark("process:roundSummaries:start");
      const tableDataWithSummaries = addRoundSummariesToPlayers(
        sortedPlayersForSummary,
        calculateDiffPercentage,
        Math.max(1, teamCountForRoundSummaries ?? 12)
      );
      mark("process:roundSummaries:done");
      if (runId !== fetchRunIdRef.current) {
        if (DEV)
          console.debug(
            "[Projections] Aborted stale run after round summaries"
          );
        return;
      }

      // Preserve baseline (non-summary) players for FP-only path
      basePlayersRef.current = tempProcessedPlayers;
      lastBaseKeyRef.current = baseKey;
      lastFPKeyRef.current = fpKey;

      mark("render:prepareColumns:start");
      startTransition(() => {
        setProcessedPlayers(tableDataWithSummaries);
        const freshColumns = generateTableCols();
        const derivedCols = deriveVisibleColumns(
          freshColumns,
          statGroupCollapseState,
          toggleStatGroupCollapse,
          styles,
          showPerGameFantasyPoints,
          togglePerGameFantasyPoints
        );
        setTableColumns(derivedCols);
      });
      mark("render:prepareColumns:done");
      if (DEV) {
        const phases = Object.keys(phaseMarks);
        if (phases.length) {
          const base = phaseMarks.start;
          const rows = phases
            .filter((p) => p !== "start")
            .map((p) => ({ phase: p, ms: (phaseMarks[p] - base).toFixed(1) }));
          try {
            console.table(rows);
          } catch {
            console.log("[ProjectionsPhaseTable]", rows);
          }
        }
      }

      if (
        !(customAdditionalSources && customAdditionalSources.length) &&
        !customAdditionalSource
      ) {
        currentTypeCache.full = {
          data: tableDataWithSummaries,
          sourceControlsSnapshot: stableSourceControlsString,
          yahooModeSnapshot: yahooDraftMode,
          currentSeasonIdSnapshot: currentSeasonId,
          fantasyPointSettingsSnapshot: stableFantasyPointSettingsString,
          showPerGameFantasyPointsSnapshot: showPerGameFantasyPoints,
          refreshKeySnapshot: refreshKey
        };
      }
      if (runId === fetchRunIdRef.current) setIsLoading(false);
    } catch (err: any) {
      console.error(
        `Error processing ${activePlayerType} projections (custom source aware):`,
        err
      );
      setError(err.message || "Unknown error occurred");
      if (runId === fetchRunIdRef.current) setIsLoading(false);
    }
  }, [
    activePlayerType,
    stableSourceControlsString,
    yahooDraftMode,
    stableFantasyPointSettingsString,
    supabaseClient,
    currentSeasonId,
    showPerGameFantasyPoints,
    teamCountForRoundSummaries,
    stableCustomAdditionalSourcesString, // trigger recompute when custom data changes
    refreshKey,
    baseKey,
    fpKey,
    allowCustomNameFallback
  ]);

  useEffect(() => {
    fetchDataAndProcess();
  }, [fetchDataAndProcess]);

  return {
    processedPlayers,
    tableColumns,
    isLoading,
    error,
    customFallbackUsage: customFallbackUsageState,
    customSourceResolutions
  };
};

const deriveVisibleColumns = (
  allColumns: ColumnDef<TableDataRow, any>[],
  collapseState: Record<string, boolean>,
  toggleGroupCollapse: (groupId: string) => void,
  styles: Record<string, string>,
  showPerGameFantasyPoints: boolean,
  togglePerGameFantasyPoints: () => void
): ColumnDef<TableDataRow, any>[] => {
  return allColumns.map((colDef) => {
    const group = colDef as GroupColumnDef<TableDataRow, any>;
    if (
      group.id &&
      group.id.endsWith("_group") &&
      group.id !== "fantasyPoints_group" &&
      Array.isArray(group.columns)
    ) {
      const isCollapsed = collapseState[group.id] ?? true;
      const originalHeader = group.header as () => JSX.Element;
      const statDefKey = group.id.replace("_group", "");
      const statDef = STATS_MASTER_LIST.find((s) => s.key === statDefKey);

      const subColumns = group.columns as ColumnDef<TableDataRow, any>[];

      return {
        ...group,
        id: group.id,
        header: () => (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%"
            }}
          >
            <div style={{ flexGrow: 1 }}>{originalHeader()}</div>
            {statDef && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGroupCollapse(group.id!);
                }}
                className={styles.collapseButton}
                title={isCollapsed ? "Expand columns" : "Collapse columns"}
                style={{ flexShrink: 0, marginLeft: "8px" }}
              >
                {isCollapsed ? ">" : "<"}
              </button>
            )}
          </div>
        ),
        columns: isCollapsed
          ? subColumns.filter((col) => col.id?.endsWith("_diff"))
          : subColumns
      } as GroupColumnDef<TableDataRow, any>;
    }
    return colDef;
  });
};

// Helper to generate table columns (can be further memoized if needed)
// This function is now defined outside the hook, or could be further modularized.
const generateTableColumns = (
  activePlayerType: "skater" | "goalie",
  statsMasterList: StatDefinition[],
  projectionSourcesConfig: ProjectionSourceConfig[],
  sourceControls: Record<string, { isSelected: boolean; weight: number }>,
  currentSeasonId: string | undefined,
  styles: Record<string, string>,
  showPerGameFantasyPoints: boolean,
  togglePerGameFantasyPoints: () => void
): ColumnDef<TableDataRow, any>[] => {
  const relevantStatDefinitions = statsMasterList.filter(
    (stat) =>
      (activePlayerType === "skater" && stat.isSkaterStat) ||
      (activePlayerType === "goalie" && stat.isGoalieStat)
  );
  const activeSourceConfigsForColumnGen = projectionSourcesConfig.filter(
    (src) =>
      src.playerType === activePlayerType && sourceControls[src.id]?.isSelected
  );

  const newTableColumns: ColumnDef<TableDataRow, any>[] = [];
  newTableColumns.push({
    id: "fullName",
    header: "Player",
    accessorKey: "fullName",
    cell: (info) => {
      const rowData = info.row.original;
      if ("type" in rowData && rowData.type === "summary") {
        return (
          <strong className={styles.roundSummaryText}>
            {rowData.fullName}
          </strong>
        );
      }
      return (rowData as ProcessedPlayer).fullName;
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
        ? "-"
        : (info.row.original as ProcessedPlayer).displayTeam,
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
        return "-";
      }
      return (rowData as ProcessedPlayer).displayPosition;
    },
    meta: { columnType: "text" },
    enableSorting: true
  });

  relevantStatDefinitions.forEach((statDef) => {
    if (
      statDef.defaultVisible !== undefined &&
      statDef.defaultVisible === false &&
      statDef.key !== "GAMES_PLAYED"
    )
      return;

    newTableColumns.push({
      id: `${statDef.key}_group`,
      header: () => {
        let tooltipText = `${statDef.displayName} (${statDef.key})\nProjected is a weighted average. Actual is from ${currentSeasonId} season totals.`;
        const definingSources =
          activeSourceConfigsForColumnGen
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
        {
          id: `${statDef.key}_proj`,
          header: "Proj",
          size: 80,
          minSize: 80,
          accessorFn: (player) =>
            "type" in player && player.type === "summary"
              ? undefined
              : ((player as ProcessedPlayer).combinedStats[statDef.key]
                  ?.projected ?? undefined),
          cell: (info) => {
            const rowData = info.row.original;
            if ("type" in rowData && rowData.type === "summary") return "-";

            const combinedStat = (rowData as ProcessedPlayer).combinedStats[
              statDef.key
            ];
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
          size: 80,
          minSize: 80,
          accessorFn: (player) =>
            "type" in player && player.type === "summary"
              ? undefined
              : ((player as ProcessedPlayer).combinedStats[statDef.key]
                  ?.actual ?? undefined),
          cell: (info) => {
            const rowData = info.row.original;
            if ("type" in rowData && rowData.type === "summary") return "-";
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
          size: 90,
          minSize: 90,
          accessorFn: (player) =>
            "type" in player && player.type === "summary"
              ? undefined
              : ((player as ProcessedPlayer).combinedStats[statDef.key]
                  ?.diffPercentage ?? undefined),
          cell: (info) => {
            const rowData = info.row.original;
            if ("type" in rowData && rowData.type === "summary") return "-";
            const val = info.getValue() as number | null;

            if (val === null || val === undefined) return "-";

            let diffStyleKey = "";
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
              else if (val <= 25) diffStyleKey = "positiveDiff";
              else diffStyleKey = "positiveDiffStrong";
            } else if (val < 0) {
              const absVal = Math.abs(val);
              if (absVal <= 10) diffStyleKey = "negativeDiffLight";
              else if (absVal <= 25) diffStyleKey = "negativeDiff";
              else diffStyleKey = "negativeDiffStrong";
            }

            const displayVal = `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
            return (
              <span className={styles[diffStyleKey] || ""}>{displayVal}</span>
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
    },
    {
      key: "yahooAvgRound",
      header: "Avg Rd",
      decimals: 1,
      higherIsBetter: false
    },
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
      accessorFn: (player) => {
        if ("type" in player && player.type === "summary") return undefined;
        return (
          (player as ProcessedPlayer)[yc.key as keyof ProcessedPlayer] ??
          undefined
        );
      },
      cell: (info) => {
        const rowData = info.row.original;
        if ("type" in rowData && rowData.type === "summary") return "-";
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
      sortUndefined: "last"
    });
  });

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
    meta: { columnType: "numeric", higherIsBetter: false },
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
    meta: { columnType: "numeric", higherIsBetter: false },
    enableSorting: true,
    sortUndefined: "last"
  });

  newTableColumns.push({
    id: "fantasyPoints_group",
    header: () => (
      <div
        className={styles.headerGroupContainer}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%"
        }}
      >
        <span>Fantasy Pts</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePerGameFantasyPoints();
          }}
          className={`${styles.collapseButton} ${styles.fpToggleButton}`}
          title={
            showPerGameFantasyPoints
              ? "Show Total Fantasy Points"
              : "Show Fantasy Points Per Game"
          }
          style={{ marginLeft: "8px" }}
        >
          {showPerGameFantasyPoints ? "Total" : "Per Gm"}
        </button>
      </div>
    ),
    columns: [
      {
        id: "fp_proj",
        header: "Proj",
        size: 80,
        minSize: 80,
        accessorFn: (player) => {
          if (showPerGameFantasyPoints) {
            return player.fantasyPoints.projectedPerGame ?? undefined;
          } else {
            return "type" in player && player.type === "summary"
              ? (player as RoundSummaryRow).fantasyPoints.projected
              : ((player as ProcessedPlayer).fantasyPoints.projected ??
                  undefined);
          }
        },
        cell: (info) => {
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
        header: "Actual",
        size: 80,
        minSize: 80,
        accessorFn: (player) => {
          if (showPerGameFantasyPoints) {
            return player.fantasyPoints.actualPerGame ?? undefined;
          } else {
            return "type" in player && player.type === "summary"
              ? (player as RoundSummaryRow).fantasyPoints.actual
              : ((player as ProcessedPlayer).fantasyPoints.actual ?? undefined);
          }
        },
        cell: (info) => {
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
        size: 90,
        minSize: 90,
        accessorFn: (player) => {
          if (showPerGameFantasyPoints) {
            if ("type" in player && player.type === "summary") {
              return (
                (player as RoundSummaryRow).fantasyPoints
                  .diffPercentagePerGame ?? undefined
              );
            }
            const projPg = (player as ProcessedPlayer).fantasyPoints
              .projectedPerGame;
            const actualPg = (player as ProcessedPlayer).fantasyPoints
              .actualPerGame;
            return calculateDiffPercentage(actualPg, projPg) ?? undefined;
          } else {
            return player.fantasyPoints.diffPercentage ?? undefined;
          }
        },
        cell: (info) => {
          const val = info.getValue() as number | null;
          if (val === null || val === undefined) return "-";

          let diffStyleKey = "";
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
            else if (val <= 25) diffStyleKey = "positiveDiff";
            else diffStyleKey = "positiveDiffStrong";
          } else if (val < 0) {
            const absVal = Math.abs(val);
            if (absVal <= 10) diffStyleKey = "negativeDiffLight";
            else if (absVal <= 25) diffStyleKey = "negativeDiff";
            else diffStyleKey = "negativeDiffStrong";
          }

          const displayVal = `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
          return (
            <span className={styles[diffStyleKey] || ""}>{displayVal}</span>
          );
        },
        meta: { columnType: "numeric", isDiffCell: true },
        enableSorting: true
      }
    ]
  });
  return newTableColumns;
};
