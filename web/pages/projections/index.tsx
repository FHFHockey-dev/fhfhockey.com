// pages/projections/index.tsx

// TO DO:
// Bring in actual stats from wgo_skater_stats_totals and wgo_goalie_stats_totals
// Compare projections to actual stats by %
// implement table sorting
// implement fantasy points scoring, real and projected
// implement table filtering => Add/remove stat categories

import React, { useState, useEffect, useMemo, useCallback } from "react";
import supabase from "lib/supabase";
import { NextPage } from "next";
import Head from "next/head";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnDef
} from "@tanstack/react-table";
import {
  useProcessedProjectionsData,
  ProcessedPlayer, // Keep for individual player type if needed elsewhere
  TableDataRow, // Import the new union type
  RoundSummaryRow,
  addRoundSummariesToPlayers, // Import helper
  calculateDiffPercentage // Import helper
} from "hooks/useProcessedProjectionsData";
import {
  PROJECTION_SOURCES_CONFIG,
  ProjectionSourceConfig
} from "lib/projectionsConfig/projectionSourcesConfig";
import { getDefaultFantasyPointsConfig } from "lib/projectionsConfig/fantasyPointsConfig";
import {
  STATS_MASTER_LIST,
  StatDefinition
} from "lib/projectionsConfig/statsMasterList";
import useCurrentSeason from "hooks/useCurrentSeason"; // Import the hook
import styles from "styles/ProjectionsPage.module.scss";
import { assignGlobalRanks, injectRanks } from "utils/projectionsRanking";

// Import the new chart component
import RoundPerformanceChart from "components/Projections/RoundPerformanceBoxPlotChart";
import PlayerMatchupWeekPerformanceChart from "components/Projections/PlayerMatchupWeekPerformanceChart";
import usePlayerMatchupWeekStats from "hooks/usePlayerMatchupWeekStats";

// Import the new context and types
import {
  RoundSummaryContext,
  RoundSummaryValue
} from "contexts/RoundSummaryContext"; // Corrected path
// Import tier calculation utilities
import {
  PerformanceTier,
  calculateTierThresholds
} from "../../utils/tierUtils"; // Adjusted path relative to pages/projections

const supabaseClient = supabase;

// Helper for formatting TOI/G moved to lib/utils/formatting.ts and handled by cell renderer in useProcessedProjectionsData

// NEW: Define type for chart data
export type ChartDataType = "diff" | "actualFp";

// Define a color map for positions for the line chart
const POSITION_COLORS: Record<string, string> = {
  C: "#FF6384",
  LW: "#36A2EB",
  RW: "#FFCE56",
  D: "#4BC0C0",
  G: "#9966FF",
  Unknown: "#CCCCCC"
};

interface PlayerTypeTabsProps {
  activeTab: "skater" | "goalie" | "overall";
  onTabChange: (tab: "skater" | "goalie" | "overall") => void;
}
const PlayerTypeTabs: React.FC<PlayerTypeTabsProps> = React.memo(
  ({ activeTab, onTabChange }) => (
    <div className={styles.playerTypeTabsContainer}>
      <button
        className={`${styles.playerTypeTabButton} ${
          activeTab === "skater" ? styles.activeTab : ""
        }`}
        onClick={() => onTabChange("skater")}
      >
        Skaters
      </button>
      <button
        className={`${styles.playerTypeTabButton} ${
          activeTab === "goalie" ? styles.activeTab : ""
        }`}
        onClick={() => onTabChange("goalie")}
      >
        Goalies
      </button>
      <button
        className={`${styles.playerTypeTabButton} ${
          activeTab === "overall" ? styles.activeTab : ""
        }`}
        onClick={() => onTabChange("overall")}
      >
        Overall
      </button>
    </div>
  )
);

interface SourceSelectorPanelProps {
  availableSources: ProjectionSourceConfig[];
  sourceControls: Record<string, { isSelected: boolean; weight: number }>;
  onSourceSelectionChange: (sourceId: string, isSelected: boolean) => void;
  onSourceWeightChange: (sourceId: string, weight: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}
const SourceSelectorPanel: React.FC<SourceSelectorPanelProps> = React.memo(
  ({
    availableSources,
    sourceControls,
    onSourceSelectionChange,
    onSourceWeightChange,
    onSelectAll,
    onDeselectAll
  }) => (
    <div className={styles.controlPanel}>
      <h3 className={`${styles.panelTitle} ${styles.panelTitleWithControls}`}>
        <span>
          Projection <span className={styles.spanColorBlue}>Sources</span>
        </span>
        <div className={styles.sourceSelectorHeader}>
          <button onClick={onSelectAll} className={styles.panelControlButton}>
            Select All
          </button>
          <button onClick={onDeselectAll} className={styles.panelControlButton}>
            Deselect All
          </button>
        </div>
      </h3>
      <div className={styles.sourceGrid}>
        {availableSources.map((source) => (
          <div key={source.id} className={styles.sourceItem}>
            <label
              htmlFor={`source-${source.id}`}
              className={styles.sourceLabel}
            >
              <input
                type="checkbox"
                id={`source-${source.id}`}
                checked={sourceControls[source.id]?.isSelected || false}
                onChange={(e) =>
                  onSourceSelectionChange(source.id, e.target.checked)
                }
              />
              <span>{source.displayName}</span>
            </label>
            <div className={styles.weightControlContainer}>
              <span className={styles.weightLabel}>WEIGHT</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={sourceControls[source.id]?.weight || 1}
                onChange={(e) =>
                  onSourceWeightChange(source.id, parseFloat(e.target.value))
                }
                className={styles.sourceWeightInput}
                disabled={!sourceControls[source.id]?.isSelected}
                title="Weight for this source in averages"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
);

interface YahooModeToggleProps {
  currentMode: "ALL" | "PRESEASON";
  onModeChange: (mode: "ALL" | "PRESEASON") => void;
}
const YahooModeToggle: React.FC<YahooModeToggleProps> = React.memo(
  ({ currentMode, onModeChange }) => (
    <div className={styles.controlPanel}>
      <h3 className={`${styles.panelTitle} ${styles.panelTitleWithControls}`}>
        <span>
          Yahoo <span className={styles.spanColorBlue}>Draft Analysis</span>
        </span>
        <div className={styles.yahooModeContainer}>
          {(["ALL", "PRESEASON"] as const).map((mode) => (
            <button
              key={mode}
              className={`${styles.panelControlButton} ${currentMode === mode ? styles.activePanelControlButton : ""}`}
              onClick={() => onModeChange(mode)}
              type="button" // Good practice for non-submit buttons
            >
              {mode.charAt(0) + mode.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </h3>
    </div>
  )
);

interface FantasyPointsSettingsPanelProps {
  activePlayerType: "skater" | "goalie"; // "overall" will use skater settings
  fantasyPointSettings: Record<string, number>;
  onFantasyPointSettingChange: (statKey: string, value: number) => void;
}
const FantasyPointsSettingsPanel: React.FC<FantasyPointsSettingsPanelProps> =
  React.memo(
    ({
      activePlayerType,
      fantasyPointSettings,
      onFantasyPointSettingChange
    }) => {
      const relevantStats = useMemo(() => {
        const skaterStatOrder: StatDefinition["key"][] = [
          "GOALS",
          "ASSISTS",
          "PP_POINTS",
          "SHOTS_ON_GOAL",
          "HITS",
          "BLOCKED_SHOTS",
          "PENALTY_MINUTES",
          "PLUS_MINUS",
          "FACEOFFS_WON",
          "FACEOFFS_LOST",
          "PP_GOALS",
          "PP_ASSISTS",
          "SH_POINTS",
          "TIME_ON_ICE_PER_GAME",
          "GAMES_PLAYED",
          "POINTS"
        ];

        const filteredStats = STATS_MASTER_LIST.filter(
          (stat) =>
            (activePlayerType === "skater" && stat.isSkaterStat) ||
            (activePlayerType === "goalie" && stat.isGoalieStat)
        );

        if (activePlayerType === "skater") {
          return filteredStats.sort((a, b) => {
            const indexA = skaterStatOrder.indexOf(a.key);
            const indexB = skaterStatOrder.indexOf(b.key);

            // If both keys are in the order array, sort by their order
            if (indexA !== -1 && indexB !== -1) {
              return indexA - indexB;
            }
            // If only A is in the order array, A comes first
            if (indexA !== -1) {
              return -1;
            }
            // If only B is in the order array, B comes first
            if (indexB !== -1) {
              return 1;
            }
            // If neither is in the order array, sort alphabetically by displayName
            return a.displayName.localeCompare(b.displayName);
          });
        } else {
          // For goalies, sort alphabetically by displayName
          return filteredStats.sort((a, b) =>
            a.displayName.localeCompare(b.displayName)
          );
        }
      }, [activePlayerType]);

      return (
        <div className={styles.controlPanel}>
          <h3 className={styles.panelTitle}>
            Fantasy <span className={styles.spanColorBlue}>Point Values</span>
          </h3>
          <div className={styles.fantasySettingsGrid}>
            {relevantStats.map((stat) => (
              <div key={stat.key} className={styles.fantasySettingItem}>
                <label
                  htmlFor={`fp-${stat.key}`}
                  className={styles.fantasySettingLabel}
                >
                  {stat.displayName}
                </label>
                <input
                  type="number"
                  id={`fp-${stat.key}`}
                  step="0.01" // Allow for fine-tuning like 0.2, 0.25
                  value={fantasyPointSettings[stat.key] ?? 0}
                  onChange={(e) =>
                    onFantasyPointSettingChange(
                      stat.key,
                      parseFloat(e.target.value)
                    )
                  }
                  className={styles.fantasySettingInput}
                  title={`Fantasy points for ${stat.displayName}`}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }
  );

interface ProjectionsDataTableProps {
  columns: ColumnDef<TableDataRow, any>[];
  data: TableDataRow[];
  expandedRows?: Record<string, boolean>;
  toggleRowExpansion?: (rowId: string) => void;
}

const ProjectionsDataTable: React.FC<ProjectionsDataTableProps> = React.memo(
  ({ columns, data, expandedRows, toggleRowExpansion }) => {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const tableData = useMemo(() => data, [data]);

    const table = useReactTable<TableDataRow>({
      data: tableData,
      columns,
      state: {
        sorting
      },
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      manualSorting: false
    });

    if (columns.length === 0) {
      return (
        <p className={styles.emptyState}>
          Select sources and player type to view projections.
        </p>
      );
    }
    if (table.getRowModel().rows.length === 0) {
      return (
        <p className={styles.emptyState}>
          No player data found for the current selections.
        </p>
      );
    }

    return (
      <div className={styles.dataTableContainer}>
        <table className={styles.dataTable}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className={
                      header.column.getCanSort() ? styles.sortableHeader : ""
                    }
                    onClick={() => {
                      if (!header.column.getCanSort()) return;
                      const meta = header.column.columnDef.meta as {
                        columnType: string;
                        higherIsBetter?: boolean;
                      };
                      const currentSortDirection = header.column.getIsSorted();

                      if (currentSortDirection === false) {
                        if (meta?.columnType === "text") {
                          header.column.toggleSorting(false);
                        } else if (meta?.columnType === "numeric") {
                          const sortDescending = meta.higherIsBetter === true;
                          header.column.toggleSorting(sortDescending);
                        } else {
                          header.column.toggleSorting(false);
                        }
                      } else if (currentSortDirection === "asc") {
                        header.column.toggleSorting(true);
                      } else {
                        header.column.toggleSorting(false);
                      }
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {{ asc: " 🔼", desc: " 🔽" }[
                      header.column.getIsSorted() as string
                    ] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isPlayerRow = !(
                "type" in row.original && row.original.type === "summary"
              );
              const player = row.original as ProcessedPlayer; // Cast, assuming player if not summary
              const rowId = isPlayerRow ? player.playerId.toString() : row.id;
              const isExpanded =
                isPlayerRow && expandedRows && expandedRows[rowId];

              // --- CHART INTEGRATION START ---
              let expandedContent = null;
              if (isPlayerRow && isExpanded) {
                // Only show chart for 'overall' tab (expandedRows only set for overall)
                expandedContent = (
                  <ExpandedPlayerRowChart playerId={player.playerId} />
                );
              }
              // --- CHART INTEGRATION END ---

              return (
                <React.Fragment key={row.id}>
                  <tr className={!isPlayerRow ? styles.summaryRowVisual : ""}>
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as
                        | { isDiffCell?: boolean }
                        | undefined;

                      let tdClassName = "";
                      if (meta?.isDiffCell) {
                        tdClassName = styles.diffCellContainer;
                      }

                      return (
                        <td key={cell.id} className={tdClassName}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {isPlayerRow && isExpanded && (
                    <tr className={styles.expandedContentRow}>
                      <td
                        colSpan={row.getVisibleCells().length}
                        className={styles.expandedContentCell}
                      >
                        {expandedContent}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
);

// --- Expanded Player Row Chart Wrapper ---
const ExpandedPlayerRowChart: React.FC<{
  playerId: number;
  season?: string | null;
}> = ({ playerId, season }) => {
  // Get context for performance tiers and season
  const { performanceTiers, currentSeasonId, skaterPointValues } =
    React.useContext(ExpandedPlayerRowChartContext);

  // Log currentSeasonId within ExpandedPlayerRowChart
  console.log(
    "[ExpandedPlayerRowChart] currentSeasonId from context:",
    currentSeasonId
  );

  // Use currentSeasonId if season not provided
  const seasonToUse: string | null = season ?? currentSeasonId ?? null;

  // Log seasonToUse before passing to the hook
  console.log(
    "[ExpandedPlayerRowChart] seasonToUse for usePlayerMatchupWeekStats:",
    seasonToUse,
    "Player ID:",
    playerId
  );

  const { matchupWeekStats, gameStatPoints, isLoading, error } =
    usePlayerMatchupWeekStats({
      playerId,
      season: seasonToUse,
      fantasyPointSettings: skaterPointValues,
      isEnabled: !!playerId && !!seasonToUse
    });

  return (
    <PlayerMatchupWeekPerformanceChart
      matchupWeekStats={matchupWeekStats}
      gameStatPoints={gameStatPoints}
      performanceTiers={performanceTiers}
      isLoading={isLoading}
      error={error}
    />
  );
};

// --- Context for expanded row chart ---
const ExpandedPlayerRowChartContext = React.createContext<{
  performanceTiers: PerformanceTier[];
  currentSeasonId: string | null;
  skaterPointValues: Record<string, number>;
}>({ performanceTiers: [], currentSeasonId: null, skaterPointValues: {} });

// --- Main Page Component ---
const ProjectionsPage: NextPage = () => {
  const currentSeason = useCurrentSeason();
  const currentSeasonId = currentSeason?.seasonId;
  const [activePlayerType, setActivePlayerType] = useState<
    "skater" | "goalie" | "overall"
  >("skater");
  const [sourceControls, setSourceControls] = useState<
    Record<string, { isSelected: boolean; weight: number }>
  >({});
  const [yahooDraftMode, setYahooDraftMode] = useState<"ALL" | "PRESEASON">(
    "ALL"
  );

  const [skaterPointValues, setSkaterPointValues] = useState<
    Record<string, number>
  >(() => getDefaultFantasyPointsConfig("skater"));
  const [goaliePointValues, setGoaliePointValues] = useState<
    Record<string, number>
  >(() => getDefaultFantasyPointsConfig("goalie"));

  const [showPerGameFantasyPoints, setShowPerGameFantasyPoints] =
    useState<boolean>(false);

  const [chartDataType, setChartDataType] = useState<ChartDataType>("diff");

  const [pickBinSize, setPickBinSize] = useState<number>(12);

  const [performanceTiers, setPerformanceTiers] = useState<PerformanceTier[]>(
    []
  );

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const [roundSummaryDataForContext, setRoundSummaryDataForContext] = useState<
    RoundSummaryValue[]
  >([]);

  const togglePerGameFantasyPoints = useCallback(() => {
    setShowPerGameFantasyPoints((prev) => !prev);
  }, []);

  const toggleRowExpansion = useCallback((rowId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  }, []);

  const skaterTabData = useProcessedProjectionsData({
    activePlayerType: "skater",
    sourceControls: Object.fromEntries(
      PROJECTION_SOURCES_CONFIG.filter(
        (src) => src.playerType === "skater"
      ).map((src) => [
        src.id,
        sourceControls[src.id] || { isSelected: true, weight: 1 }
      ])
    ),
    yahooDraftMode,
    fantasyPointSettings: skaterPointValues,
    supabaseClient,
    styles,
    currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined,
    showPerGameFantasyPoints,
    togglePerGameFantasyPoints
  });

  const goalieTabData = useProcessedProjectionsData({
    activePlayerType: "goalie",
    sourceControls: Object.fromEntries(
      PROJECTION_SOURCES_CONFIG.filter(
        (src) => src.playerType === "goalie"
      ).map((src) => [
        src.id,
        sourceControls[src.id] || { isSelected: true, weight: 1 }
      ])
    ),
    yahooDraftMode,
    fantasyPointSettings: goaliePointValues,
    supabaseClient,
    styles,
    currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined,
    showPerGameFantasyPoints,
    togglePerGameFantasyPoints
  });

  // Define overallColumns at the top level using useMemo
  const overallColumns = useMemo(
    (): ColumnDef<TableDataRow, any>[] => [
      {
        id: "expander",
        header: () => null, // No header text for expander column
        size: 40, // Small fixed size for the expander button
        minSize: 40,
        maxSize: 40,
        cell: ({ row }) => {
          if ("type" in row.original && row.original.type === "summary") {
            return null;
          }
          const player = row.original as ProcessedPlayer;
          return (
            <button
              onClick={() => toggleRowExpansion(player.playerId.toString())}
              className={styles.expanderButton}
              title={
                expandedRows[player.playerId.toString()] ? "Collapse" : "Expand"
              }
            >
              {expandedRows[player.playerId.toString()] ? "−" : "+"}
            </button>
          );
        }
      },
      {
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
      },
      {
        id: "displayTeam",
        header: "Team",
        accessorKey: "displayTeam",
        cell: (info) =>
          "type" in info.row.original && info.row.original.type === "summary"
            ? "-"
            : (info.row.original as ProcessedPlayer).displayTeam,
        meta: { columnType: "text" },
        enableSorting: true
      },
      {
        id: "displayPosition",
        header: "Pos",
        accessorKey: "displayPosition",
        cell: (info) =>
          "type" in info.row.original && info.row.original.type === "summary"
            ? "-"
            : (info.row.original as ProcessedPlayer).displayPosition,
        meta: { columnType: "text" },
        enableSorting: true
      },
      {
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
              className={styles.collapseButton}
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
            accessorFn: (row) => {
              const fp = row.fantasyPoints;
              if (showPerGameFantasyPoints) {
                return fp.projectedPerGame ?? undefined;
              }
              return fp.projected ?? undefined;
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
            accessorFn: (row) => {
              const fp = row.fantasyPoints;
              if (showPerGameFantasyPoints) {
                return fp.actualPerGame ?? undefined;
              }
              return fp.actual ?? undefined;
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
            accessorFn: (row) => {
              const fp = row.fantasyPoints;
              if (showPerGameFantasyPoints) {
                if ("type" in row && row.type === "summary") {
                  return (
                    (fp as RoundSummaryRow["fantasyPoints"])
                      .diffPercentagePerGame ?? undefined
                  );
                }
                const projPg = (row as ProcessedPlayer).fantasyPoints
                  .projectedPerGame;
                const actualPg = (row as ProcessedPlayer).fantasyPoints
                  .actualPerGame;
                return calculateDiffPercentage(actualPg, projPg) ?? undefined;
              }
              return fp.diffPercentage ?? undefined;
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
      },
      {
        id: "yahooAvgPick",
        header: "ADP",
        accessorFn: (row) => {
          if ("type" in row && row.type === "summary") return undefined;
          return (row as ProcessedPlayer).yahooAvgPick ?? undefined;
        },
        cell: (info) => {
          const val = info.getValue() as number | null;
          if (val === null || val === undefined) return "-";
          return val.toFixed(1);
        },
        meta: { columnType: "numeric", higherIsBetter: false },
        enableSorting: true,
        sortUndefined: "last"
      },
      {
        id: "yahooAvgRound",
        header: "Avg Rd",
        accessorFn: (row) => {
          if ("type" in row && row.type === "summary") return undefined;
          return (row as ProcessedPlayer).yahooAvgRound ?? undefined;
        },
        cell: (info) => {
          const val = info.getValue() as number | null;
          if (val === null || val === undefined) return "-";
          return val.toFixed(1);
        },
        meta: { columnType: "numeric", higherIsBetter: false },
        enableSorting: true,
        sortUndefined: "last"
      },
      {
        id: "yahooPctDrafted",
        header: "Draft %",
        accessorFn: (row) => {
          if ("type" in row && row.type === "summary") return undefined;
          return (row as ProcessedPlayer).yahooPctDrafted ?? undefined;
        },
        cell: (info) => {
          const val = info.getValue() as number | null;
          if (val === null || val === undefined) return "-";
          return `${val.toFixed(1)}%`;
        },
        meta: { columnType: "numeric", higherIsBetter: true },
        enableSorting: true,
        sortUndefined: "last"
      },
      {
        id: "projectedRank",
        header: "P-Rank",
        accessorFn: (player) => {
          if ("type" in player && player.type === "summary") return undefined;
          return (player as ProcessedPlayer).projectedRank ?? undefined;
        },
        cell: (info) => {
          const val = info.getValue() as number | null;
          return val !== null && val !== undefined ? val : "-";
        },
        meta: { columnType: "numeric", higherIsBetter: false },
        enableSorting: true,
        sortUndefined: "last"
      },
      {
        id: "actualRank",
        header: "A-Rank",
        accessorFn: (player) => {
          if ("type" in player && player.type === "summary") return undefined;
          return (player as ProcessedPlayer).actualRank ?? undefined;
        },
        cell: (info) => {
          const val = info.getValue() as number | null;
          return val !== null && val !== undefined ? val : "-";
        },
        meta: { columnType: "numeric", higherIsBetter: false },
        enableSorting: true,
        sortUndefined: "last"
      }
    ],
    [
      showPerGameFantasyPoints,
      togglePerGameFantasyPoints,
      expandedRows,
      toggleRowExpansion
    ]
  );

  // Compute overall data with useMemo (must be called unconditionally)
  const overallData = useMemo(() => {
    const skaters = skaterTabData.processedPlayers.filter(
      (p): p is ProcessedPlayer => !("type" in p)
    );
    const goalies = goalieTabData.processedPlayers.filter(
      (p): p is ProcessedPlayer => !("type" in p)
    );

    if (skaters.length === 0 && goalies.length === 0) {
      return {
        processedPlayers: [],
        tableColumns: [], // Return empty columns if no data
        isLoading: skaterTabData.isLoading || goalieTabData.isLoading,
        error: skaterTabData.error || goalieTabData.error
      };
    }
    const rankedUnsorted = assignGlobalRanks(skaters, goalies);

    const rankMap = new Map<number, ProcessedPlayer>();
    rankedUnsorted.forEach((p) => rankMap.set(p.playerId, p));

    const combinedPlayersWithRanks: ProcessedPlayer[] = [
      ...skaters,
      ...goalies
    ].map((p) => {
      const rankedPlayer = rankMap.get(p.playerId);
      let projectedPerGame = p.fantasyPoints.projectedPerGame;
      let actualPerGame = p.fantasyPoints.actualPerGame;

      const projectedGP = p.combinedStats.GAMES_PLAYED?.projected;
      const actualGP = p.combinedStats.GAMES_PLAYED?.actual;

      if (
        p.fantasyPoints.projected !== null &&
        projectedGP !== null &&
        projectedGP > 0
      ) {
        projectedPerGame = p.fantasyPoints.projected / projectedGP;
      } else if (projectedPerGame === undefined) {
        projectedPerGame = null;
      }

      if (
        p.fantasyPoints.actual !== null &&
        actualGP !== null &&
        actualGP > 0
      ) {
        actualPerGame = p.fantasyPoints.actual / actualGP;
      } else if (actualPerGame === undefined) {
        actualPerGame = null;
      }

      return {
        ...p,
        fantasyPoints: {
          ...p.fantasyPoints,
          projectedPerGame: projectedPerGame,
          actualPerGame: actualPerGame
        },
        projectedRank: rankedPlayer?.projectedRank,
        actualRank: rankedPlayer?.actualRank
      };
    });

    const sortedForRoundProcessing = [...combinedPlayersWithRanks].sort(
      (a, b) => {
        const pickA = a.yahooAvgPick ?? Infinity;
        const pickB = b.yahooAvgPick ?? Infinity;
        return pickA - pickB;
      }
    );

    const overallRowsWithSummaries = addRoundSummariesToPlayers(
      sortedForRoundProcessing,
      calculateDiffPercentage
    );

    // Use the overallColumns defined at the top level of ProjectionsPage
    return {
      processedPlayers: overallRowsWithSummaries,
      tableColumns: overallColumns,
      isLoading: skaterTabData.isLoading || goalieTabData.isLoading,
      error: skaterTabData.error || goalieTabData.error
    };
  }, [
    skaterTabData,
    goalieTabData,
    showPerGameFantasyPoints,
    togglePerGameFantasyPoints,
    expandedRows,
    toggleRowExpansion,
    overallColumns // Add overallColumns as a dependency here
  ]);

  // EFFECT to update round summary data for context when overallData changes
  useEffect(() => {
    if (overallData && overallData.processedPlayers.length > 0) {
      const newSummaries: RoundSummaryValue[] = overallData.processedPlayers
        .filter(
          (p): p is RoundSummaryRow => "type" in p && p.type === "summary"
        )
        .map((summaryRow) => ({
          roundNumber: summaryRow.roundNumber,
          projectedPerGame: summaryRow.fantasyPoints.projectedPerGame,
          actualPerGame: summaryRow.fantasyPoints.actualPerGame,
          diffPercentagePerGame: summaryRow.fantasyPoints.diffPercentagePerGame
        }));

      setRoundSummaryDataForContext((prevSummaries) => {
        if (JSON.stringify(prevSummaries) !== JSON.stringify(newSummaries)) {
          return newSummaries;
        }
        return prevSummaries;
      });
    } else if (overallData && overallData.processedPlayers.length === 0) {
      setRoundSummaryDataForContext((prevSummaries) => {
        if (prevSummaries.length > 0) return [];
        return prevSummaries;
      });
    }
  }, [overallData]);

  useEffect(() => {
    if (roundSummaryDataForContext && roundSummaryDataForContext.length > 0) {
      const calculatedTiers = calculateTierThresholds(
        roundSummaryDataForContext
      );
      setPerformanceTiers(calculatedTiers);
    } else {
      setPerformanceTiers([]);
    }
  }, [roundSummaryDataForContext]);

  let displayedData: ReturnType<typeof useProcessedProjectionsData> =
    skaterTabData;
  if (activePlayerType === "goalie") displayedData = goalieTabData;
  if (activePlayerType === "overall") displayedData = overallData;

  const chartPresentationData = useMemo(() => {
    if (
      !displayedData.processedPlayers ||
      displayedData.processedPlayers.length === 0
    ) {
      return {
        labels: [],
        datasets: [],
        yAxisLabel: "",
        chartType:
          chartDataType === "actualFp"
            ? "line"
            : ("boxplot" as "line" | "boxplot")
      };
    }

    const players = displayedData.processedPlayers.filter(
      (p): p is ProcessedPlayer => !("type" in p) || p.type !== "summary"
    );

    const yAxisLabel =
      chartDataType === "actualFp"
        ? "Actual Fantasy Points"
        : "Individual Player Difference %";
    const finalChartType: "line" | "boxplot" =
      chartDataType === "actualFp" ? "line" : "boxplot";
    let labels: string[] = [];
    let datasets: any[] = [];

    if (chartDataType === "actualFp") {
      const positions = Array.from(
        new Set(
          players.map(
            (p) => p.displayPosition?.split(",")[0].trim() || "Unknown"
          )
        )
      ).sort();

      datasets = positions.map((position) => {
        const playerDataPoints = players
          .filter(
            (p) =>
              (p.displayPosition?.split(",")[0].trim() || "Unknown") ===
                position &&
              p.yahooAvgPick != null &&
              p.fantasyPoints.actual !== null
          )
          .map((p) => ({
            x: p.yahooAvgPick as number,
            y: p.fantasyPoints.actual as number,
            playerFullName: p.fullName,
            displayPosition: p.displayPosition
          }))
          .sort((a, b) => a.x - b.x);

        return {
          label: position,
          data: playerDataPoints,
          borderColor: POSITION_COLORS[position] || POSITION_COLORS["Unknown"],
          backgroundColor:
            POSITION_COLORS[position] || POSITION_COLORS["Unknown"],
          fill: false,
          tension: 0.1,
          pointRadius: 3,
          pointHoverRadius: 5
        };
      });
      labels = [];
    } else {
      const roundsData: Record<number, ProcessedPlayer[]> = {};
      players.forEach((player) => {
        if (player.yahooAvgPick != null && player.yahooAvgPick > 0) {
          const round = Math.ceil(player.yahooAvgPick / 12);
          if (round <= 15) {
            if (!roundsData[round]) {
              roundsData[round] = [];
            }
            roundsData[round].push(player);
          }
        }
      });
      const roundKeysForBoxPlot = Object.keys(roundsData)
        .map(Number)
        .sort((a, b) => a - b);
      labels = roundKeysForBoxPlot.map((r) => `R${r}`);

      const dataForBoxPlot = roundKeysForBoxPlot.map((roundNum) => {
        return (roundsData[roundNum] || [])
          .map((p) => p.fantasyPoints.diffPercentage)
          .filter((value) => {
            if (value === null || typeof value !== "number" || isNaN(value))
              return false;
            return value !== 99999 && value !== -99999;
          }) as number[];
      });

      const allDraftedPlayerDiffs = players
        .filter(
          (player) => player.yahooAvgPick != null && player.yahooAvgPick > 0
        )
        .map((p) => p.fantasyPoints.diffPercentage)
        .filter((value) => {
          if (value === null || typeof value !== "number" || isNaN(value))
            return false;
          return value !== 99999 && value !== -99999;
        }) as number[];

      if (allDraftedPlayerDiffs.length > 0) {
        if (labels.indexOf("All Drafted") === -1) labels.push("All Drafted");
        dataForBoxPlot.push(allDraftedPlayerDiffs);
      }

      datasets.push({
        label: "Player Fantasy Points Diff % by Round",
        data: dataForBoxPlot,
        backgroundColor: "#07aae2",
        borderColor: "#07aae2",
        borderWidth: 1,
        itemRadius: 3,
        itemStyle: "circle" as const,
        outlierColor: "#FF0000",
        medianColor: "#FFFFFF"
      });
    }

    return { labels, datasets, yAxisLabel, chartType: finalChartType };
  }, [displayedData.processedPlayers, chartDataType]);

  const availableSourcesForTab = useMemo(() => {
    const currentType =
      activePlayerType === "overall" ? "skater" : activePlayerType;
    return PROJECTION_SOURCES_CONFIG.filter(
      (src) => src.playerType === currentType
    );
  }, [activePlayerType]);

  useEffect(() => {
    const initialControls: Record<
      string,
      { isSelected: boolean; weight: number }
    > = {};
    PROJECTION_SOURCES_CONFIG.forEach((source) => {
      initialControls[source.id] = { isSelected: true, weight: 1 };
    });
    setSourceControls(initialControls);
  }, []);

  const handlePlayerTypeChange = useCallback(
    (tab: "skater" | "goalie" | "overall") => {
      setActivePlayerType(tab);
    },
    [setActivePlayerType]
  );

  const handleSourceSelectionChange = useCallback(
    (sourceId: string, isSelected: boolean) => {
      setSourceControls((prev) => ({
        ...prev,
        [sourceId]: { ...(prev[sourceId] || { weight: 1 }), isSelected }
      }));
    },
    [setSourceControls]
  );

  const handleSourceWeightChange = useCallback(
    (sourceId: string, weight: number) => {
      const newWeight = Math.max(0.1, weight);
      setSourceControls((prev) => ({
        ...prev,
        [sourceId]: {
          ...(prev[sourceId] || { isSelected: true }),
          weight: newWeight
        }
      }));
    },
    [setSourceControls]
  );

  const handleSelectAllSources = useCallback(() => {
    const updatedControls = { ...sourceControls };
    availableSourcesForTab.forEach((src) => {
      updatedControls[src.id] = {
        ...(updatedControls[src.id] || { weight: 1 }),
        isSelected: true
      };
    });
    setSourceControls(updatedControls);
  }, [sourceControls, availableSourcesForTab, setSourceControls]);

  const handleDeselectAllSources = useCallback(() => {
    const updatedControls = { ...sourceControls };
    availableSourcesForTab.forEach((src) => {
      updatedControls[src.id] = {
        ...(updatedControls[src.id] || { weight: 1 }),
        isSelected: false
      };
    });
    setSourceControls(updatedControls);
  }, [sourceControls, availableSourcesForTab, setSourceControls]);

  const handleFantasyPointSettingChange = useCallback(
    (statKey: string, value: number) => {
      const typeToUpdate = activePlayerType === "goalie" ? "goalie" : "skater";
      const numericValue = isNaN(value) ? 0 : value;

      if (typeToUpdate === "skater") {
        setSkaterPointValues((prev) => ({
          ...prev,
          [statKey]: numericValue
        }));
      } else {
        setGoaliePointValues((prev) => ({
          ...prev,
          [statKey]: numericValue
        }));
      }
    },
    [activePlayerType, setSkaterPointValues, setGoaliePointValues]
  );

  // Transform currentSeasonId for the provider
  let seasonIdAsString: string | null = null;
  if (currentSeasonId !== undefined && currentSeasonId !== null) {
    seasonIdAsString = String(currentSeasonId); // Ensure it's a string
  }

  let currentSeasonIdForProvider: string | null = null;
  if (seasonIdAsString) {
    // Check if seasonIdAsString is not null
    if (seasonIdAsString.length === 8) {
      // e.g., "20242025"
      currentSeasonIdForProvider = seasonIdAsString.substring(0, 4); // "2024"
    } else {
      currentSeasonIdForProvider = seasonIdAsString; // Use as is if not in YYYYYYYY format
    }
  }

  console.log(
    "[ProjectionsPage] currentSeasonId for Context.Provider (transformed):",
    currentSeasonIdForProvider
  );

  return (
    <>
      <Head>
        <title>Hockey Projections | FHFHockey</title>
        <meta
          name="description"
          content="View and analyze aggregated hockey player projections."
        />
      </Head>
      <RoundSummaryContext.Provider value={roundSummaryDataForContext}>
        <main className={styles.pageContainer}>
          <section className={styles.headerSection}>
            <h1 className={styles.pageTitle}>
              Player <span className={styles.spanColorBlue}>Projections</span>
            </h1>
          </section>

          <section className={styles.controlsSectionWrapper}>
            <PlayerTypeTabs
              activeTab={activePlayerType}
              onTabChange={handlePlayerTypeChange}
            />
            <div className={styles.controlPanelsGrid}>
              <div className={styles.controlPanelsColumnLeft}>
                <SourceSelectorPanel
                  availableSources={availableSourcesForTab}
                  sourceControls={sourceControls}
                  onSourceSelectionChange={handleSourceSelectionChange}
                  onSourceWeightChange={handleSourceWeightChange}
                  onSelectAll={handleSelectAllSources}
                  onDeselectAll={handleDeselectAllSources}
                />
                <YahooModeToggle
                  currentMode={yahooDraftMode}
                  onModeChange={setYahooDraftMode}
                />
              </div>

              <div className={styles.controlPanelsColumnRight}>
                <FantasyPointsSettingsPanel
                  activePlayerType={
                    activePlayerType === "goalie" ? "goalie" : "skater"
                  }
                  fantasyPointSettings={
                    activePlayerType === "goalie"
                      ? goaliePointValues
                      : skaterPointValues
                  }
                  onFantasyPointSettingChange={handleFantasyPointSettingChange}
                />
              </div>
            </div>
          </section>

          <section className={styles.dataDisplaySection}>
            {!displayedData.isLoading &&
              !displayedData.error &&
              displayedData.processedPlayers.length > 0 &&
              ((chartPresentationData.chartType === "boxplot" &&
                chartPresentationData.labels.length > 0) ||
                (chartPresentationData.chartType === "line" &&
                  chartPresentationData.datasets.some(
                    (ds) => ds.data && ds.data.length > 0
                  ))) && (
                <div
                  className={styles.chartSectionWrapper}
                  style={{
                    marginBottom: "2rem",
                    borderBottom: `2px solid ${styles.primaryColor || "#00bfff"}`,
                    paddingBottom: "1rem"
                  }}
                >
                  <h3
                    className={styles.panelTitle}
                    style={{
                      textAlign: "center",
                      marginBottom: "0.5rem",
                      borderBottom: "none",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}
                  >
                    <span>
                      Player Performance Metric{" "}
                      <span className={styles.spanColorBlue}>
                        by Draft Round/Pick Bin
                      </span>
                    </span>
                    <div
                      style={{
                        marginLeft: "20px",
                        display: "flex",
                        gap: "10px",
                        alignItems: "center"
                      }}
                    >
                      <button
                        onClick={() => setChartDataType("diff")}
                        className={`${styles.panelControlButton} ${chartDataType === "diff" ? styles.activePanelControlButton : ""}`}
                        title="Show Difference Percentage"
                      >
                        Diff %
                      </button>
                      <button
                        onClick={() => setChartDataType("actualFp")}
                        className={`${styles.panelControlButton} ${chartDataType === "actualFp" ? styles.activePanelControlButton : ""}`}
                        title="Show Actual Fantasy Points"
                      >
                        Actual FP
                      </button>
                    </div>
                  </h3>
                  <RoundPerformanceChart
                    labels={chartPresentationData.labels}
                    datasets={chartPresentationData.datasets}
                    styles={styles}
                    chartType={chartPresentationData.chartType}
                    yAxisLabel={chartPresentationData.yAxisLabel}
                  />
                </div>
              )}

            {displayedData.isLoading && (
              <div className={styles.loadingState}>
                <p>Loading projections...</p>
              </div>
            )}
            {displayedData.error && !displayedData.isLoading && (
              <div className={styles.errorState}>
                <p className={styles.errorTitle}>Error loading data:</p>
                <p className={styles.errorMessage}>{displayedData.error}</p>
              </div>
            )}
            {!displayedData.isLoading && !displayedData.error && (
              <ExpandedPlayerRowChartContext.Provider
                value={{
                  performanceTiers,
                  currentSeasonId: currentSeasonIdForProvider,
                  skaterPointValues
                }}
              >
                <ProjectionsDataTable
                  columns={displayedData.tableColumns}
                  data={displayedData.processedPlayers}
                  expandedRows={
                    activePlayerType === "overall" ? expandedRows : undefined
                  }
                  toggleRowExpansion={
                    activePlayerType === "overall"
                      ? toggleRowExpansion
                      : undefined
                  }
                />
              </ExpandedPlayerRowChartContext.Provider>
            )}
          </section>
        </main>
      </RoundSummaryContext.Provider>
    </>
  );
};

export default ProjectionsPage;
