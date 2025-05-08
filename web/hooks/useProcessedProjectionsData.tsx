// lib/hooks/useProcessedProjectionsData.tsx

import { useState, useEffect, useRef } from "react";
import { SupabaseClient, PostgrestResponse } from "@supabase/supabase-js";
import { ColumnDef } from "@tanstack/react-table";

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
  stats: Record<StatDefinition["key"], AggregatedStatValue>;
  yahooPlayerId?: string;
  yahooAvgPick?: number | null;
  yahooAvgRound?: number | null;
  yahooPctDrafted?: number | null;
}

export interface UseProcessedProjectionsDataProps {
  activePlayerType: "skater" | "goalie";
  sourceControls: Record<string, { isSelected: boolean; weight: number }>;
  yahooDraftMode: "ALL" | "PRESEASON";
  supabaseClient: SupabaseClient<any, "public"> | null;
}

export interface UseProcessedProjectionsDataReturn {
  processedPlayers: ProcessedPlayer[];
  tableColumns: ColumnDef<ProcessedPlayer, any>[];
  isLoading: boolean;
  error: string | null;
}

interface RawProjectionSourcePlayer extends Record<string, any> {}
interface YahooNhlPlayerMapEntry extends Record<string, any> {}
interface YahooPlayerDetailData extends Record<string, any> {}

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

export const useProcessedProjectionsData = ({
  activePlayerType,
  sourceControls,
  yahooDraftMode,
  supabaseClient
}: UseProcessedProjectionsDataProps): UseProcessedProjectionsDataReturn => {
  const [processedPlayers, setProcessedPlayers] = useState<ProcessedPlayer[]>(
    []
  );
  const [tableColumns, setTableColumns] = useState<
    ColumnDef<ProcessedPlayer, any>[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cache = useRef<{
    skater?: {
      data: ProcessedPlayer[];
      columns: ColumnDef<ProcessedPlayer, any>[];
      sourceControlsSnapshot: string;
      yahooModeSnapshot: "ALL" | "PRESEASON";
    };
    goalie?: {
      data: ProcessedPlayer[];
      columns: ColumnDef<ProcessedPlayer, any>[];
      sourceControlsSnapshot: string;
      yahooModeSnapshot: "ALL" | "PRESEASON";
    };
  }>({});
  if (!supabaseClient) {
    return {
      processedPlayers: [],
      tableColumns: [],
      isLoading: false,
      error: "Supabase client not available."
    };
  }

  useEffect(() => {
    const fetchDataAndProcess = async () => {
      if (!supabaseClient) {
        setError("Supabase client not available.");
        setProcessedPlayers([]);
        setTableColumns([]);
        return;
      }

      // --- Cache Check ---
      const stringifiedSourceControls = JSON.stringify(sourceControls);
      const cacheKey = activePlayerType; // 'skater' or 'goalie'
      const currentCacheEntry = cache.current[cacheKey];

      if (
        currentCacheEntry &&
        currentCacheEntry.sourceControlsSnapshot ===
          stringifiedSourceControls &&
        currentCacheEntry.yahooModeSnapshot === yahooDraftMode
      ) {
        // Cache hit
        setProcessedPlayers(currentCacheEntry.data);
        setTableColumns(currentCacheEntry.columns);
        setIsLoading(false);
        setError(null);
        return; // Skip fetching and processing
      }
      // --- End Cache Check ---
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

        const yahooMapSelectString = `${YAHOO_PLAYER_MAP_KEYS.nhlPlayerId}, ${YAHOO_PLAYER_MAP_KEYS.yahooPlayerId}, ${YAHOO_PLAYER_MAP_KEYS.teamAbbreviation}, ${YAHOO_PLAYER_MAP_KEYS.position}, ${YAHOO_PLAYER_MAP_KEYS.nhlPlayerName}`;

        const yahooMapQueryBuilder = supabaseClient
          .from("yahoo_nhl_player_map_mat")
          .select(
            `${YAHOO_PLAYER_MAP_KEYS.nhlPlayerId}, ${YAHOO_PLAYER_MAP_KEYS.yahooPlayerId}, ${YAHOO_PLAYER_MAP_KEYS.teamAbbreviation}, ${YAHOO_PLAYER_MAP_KEYS.position}, ${YAHOO_PLAYER_MAP_KEYS.nhlPlayerName}`
          )
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

        for (const nhlPlayerId of uniqueNhlPlayerIds) {
          const playerYahooMapEntry = nhlToYahooMap.get(nhlPlayerId);
          const yahooPlayerDetail = playerYahooMapEntry?.[
            YAHOO_PLAYER_MAP_KEYS.yahooPlayerId
          ]
            ? yahooPlayersMap.get(
                String(playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId])
              )
            : null;

          const displayName =
            playerYahooMapEntry?.[YAHOO_PLAYER_MAP_KEYS.nhlPlayerName] ||
            "Unknown Player";

          const processedPlayer: ProcessedPlayer = {
            playerId: nhlPlayerId,
            fullName: displayName,
            displayTeam: null,
            displayPosition: null,
            stats: {},
            yahooPlayerId: playerYahooMapEntry?.[
              YAHOO_PLAYER_MAP_KEYS.yahooPlayerId
            ]
              ? String(playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.yahooPlayerId])
              : undefined
          };

          for (const statDef of relevantStatDefinitions) {
            const currentStatValues: RawPlayerStatFromSource[] = [];
            const missingFromSelectedForStat: string[] = [];

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
            const aggregatedValue =
              totalWeight > 0 ? weightedSum / totalWeight : null;
            processedPlayer.stats[statDef.key] = {
              value: aggregatedValue,
              contributingSources: contributingToAvg,
              missingFromSelectedSources: missingFromSelectedForStat,
              statDefinition: statDef
            };
          }

          let finalTeam: string | null = null;
          let finalPosition: string | null = null;

          for (const sourceConfig of activeSourceConfigs) {
            const sourceDataForPlayer = rawProjectionDataBySourceId[
              sourceConfig.id
            ]?.data.find(
              (p: RawProjectionSourcePlayer) =>
                Number(p[sourceConfig.primaryPlayerIdKey]) === nhlPlayerId
            );
            if (sourceDataForPlayer) {
              if (
                !finalTeam &&
                sourceConfig.teamKey &&
                sourceDataForPlayer[sourceConfig.teamKey]
              ) {
                finalTeam = sourceDataForPlayer[sourceConfig.teamKey];
              }
              if (
                !finalPosition &&
                sourceConfig.positionKey &&
                sourceDataForPlayer[sourceConfig.positionKey]
              ) {
                finalPosition = sourceDataForPlayer[sourceConfig.positionKey];
              }
            }
            if (finalTeam && finalPosition) break;
          }
          if (
            !finalTeam &&
            playerYahooMapEntry?.[YAHOO_PLAYER_MAP_KEYS.teamAbbreviation]
          ) {
            finalTeam =
              playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.teamAbbreviation];
          }
          if (
            !finalPosition &&
            playerYahooMapEntry?.[YAHOO_PLAYER_MAP_KEYS.position]
          ) {
            finalPosition = playerYahooMapEntry[YAHOO_PLAYER_MAP_KEYS.position];
          }
          if (
            !finalTeam &&
            yahooPlayerDetail?.[
              YAHOO_PLAYERS_TABLE_KEYS.editorialTeamAbbreviation
            ]
          ) {
            finalTeam =
              yahooPlayerDetail[
                YAHOO_PLAYERS_TABLE_KEYS.editorialTeamAbbreviation
              ];
          }
          if (
            !finalPosition &&
            yahooPlayerDetail?.[YAHOO_PLAYERS_TABLE_KEYS.displayPosition]
          ) {
            finalPosition =
              yahooPlayerDetail[YAHOO_PLAYERS_TABLE_KEYS.displayPosition];
          }
          processedPlayer.displayTeam = finalTeam;
          processedPlayer.displayPosition = finalPosition;

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

          // Ensure all stats are initialized for players who might not have any data for some stats
          relevantStatDefinitions.forEach((statDef) => {
            if (!processedPlayer.stats[statDef.key]) {
              processedPlayer.stats[statDef.key] = {
                value: null,
                contributingSources: [],
                missingFromSelectedSources: [],
                statDefinition: statDef
              };
            }
          });

          tempProcessedPlayers.push(processedPlayer);
        }
        setProcessedPlayers(tempProcessedPlayers);

        const newTableColumns: ColumnDef<ProcessedPlayer, any>[] = [];
        newTableColumns.push({
          id: "fullName",
          header: "Player",
          accessorKey: "fullName"
        });
        newTableColumns.push({
          id: "displayTeam",
          header: "Team",
          accessorKey: "displayTeam"
        });
        newTableColumns.push({
          id: "displayPosition",
          header: "Pos",
          accessorKey: "displayPosition"
        });

        relevantStatDefinitions.forEach((statDef) => {
          if (
            statDef.defaultVisible === false &&
            statDef.key !== "GAMES_PLAYED"
          )
            return;
          newTableColumns.push({
            id: statDef.key,
            accessorKey: statDef.key,
            header: ({ column }) => {
              let tooltipText = `${statDef.displayName} (${statDef.key})\nWeighted average. Sources defining this: `;
              const definingSources =
                activeSourceConfigs
                  .filter(
                    (sc) =>
                      sourceControls[sc.id]?.isSelected &&
                      sc.statMappings.some((m) => m.key === statDef.key)
                  )
                  .map((sc) => sc.displayName)
                  .join(", ") || "None selected";
              tooltipText += definingSources;
              return <div title={tooltipText}>{statDef.displayName}</div>;
            },
            accessorFn: (player) => player.stats[statDef.key]?.value,

            cell: (info) => {
              const aggStat = info.row.original.stats[statDef.key];
              const val = aggStat?.value;

              if (val === null || val === undefined) return "-"; // Handles null/undefined upfront

              let cellTooltip = `Value: ${val.toFixed(statDef.decimalPlaces ?? (statDef.dataType === "percentage" && statDef.key !== "SAVE_PERCENTAGE" ? 1 : statDef.key === "TIME_ON_ICE_PER_GAME" ? 2 : 0))}\nContributing:\n`;
              aggStat?.contributingSources.forEach((cs) => {
                cellTooltip += `  - ${cs.name} (Val: ${cs.value?.toFixed(2)}, W: ${cs.weight})\n`;
              });
              if (aggStat?.missingFromSelectedSources.length) {
                cellTooltip += "Missing from:\n";
                aggStat.missingFromSelectedSources.forEach((ms) => {
                  cellTooltip += `  - ${ms}\n`;
                });
              }

              let displayValue: string;
              if (statDef.formatter) {
                // formatter takes precedence
                displayValue = statDef.formatter(val);
              } else if (statDef.dataType === "percentage") {
                displayValue =
                  statDef.key === "SAVE_PERCENTAGE"
                    ? val.toFixed(statDef.decimalPlaces ?? 3)
                    : `${(val * 100).toFixed(statDef.decimalPlaces ?? 1)}%`;
              } else {
                // Default for numeric
                displayValue = val.toFixed(statDef.decimalPlaces ?? 0);
              }
              return <div title={cellTooltip.trim()}>{displayValue}</div>;
            },
            enableSorting: true
          });
        });

        const yahooStatConfigs = [
          { key: "yahooAvgPick", header: "Avg Pick", decimals: 1 },
          { key: "yahooAvgRound", header: "Avg Rd", decimals: 1 },
          {
            key: "yahooPctDrafted",
            header: "% Drafted",
            decimals: 1,
            isPercentage: true
          }
        ];
        yahooStatConfigs.forEach((yc) => {
          newTableColumns.push({
            id: yc.key,
            header: yc.header,
            accessorKey: yc.key as keyof ProcessedPlayer,
            cell: (info) => {
              const val = info.getValue() as number | null;
              if (val === null || val === undefined) return "-";
              return yc.isPercentage
                ? `${val.toFixed(yc.decimals)}%`
                : val.toFixed(yc.decimals);
            },
            enableSorting: true
          });
        });

        // --- Update Cache ---
        cache.current[cacheKey] = {
          data: tempProcessedPlayers,
          columns: newTableColumns,
          sourceControlsSnapshot: stringifiedSourceControls,
          yahooModeSnapshot: yahooDraftMode
        };
        // --- End Update Cache ---
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

    if (supabaseClient) {
      fetchDataAndProcess();
    } else {
      setError("Supabase client became unavailable.");
      setProcessedPlayers([]);
      setTableColumns([]);
      setIsLoading(false);
    }
  }, [activePlayerType, sourceControls, yahooDraftMode, supabaseClient]);

  return { processedPlayers, tableColumns, isLoading, error };
};
