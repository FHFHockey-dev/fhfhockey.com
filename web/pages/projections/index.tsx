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

// Import the new context and types
import {
  RoundSummaryContext,
  RoundSummaryValue
} from "contexts/RoundSummaryContext"; // Corrected path

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
  columns: ColumnDef<TableDataRow, any>[]; // Use TableDataRow
  data: TableDataRow[]; // Use TableDataRow
}

const ProjectionsDataTable: React.FC<ProjectionsDataTableProps> = React.memo(
  ({ columns, data }) => {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const tableData = useMemo(() => data, [data]); // Use all data

    const table = useReactTable<TableDataRow>({
      // Use TableDataRow
      data: tableData, // Now uses all data
      columns,
      state: {
        sorting
      },
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      manualSorting: false // We are using client-side sorting
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
                      // @ts-ignore // Accessing custom meta
                      const meta = header.column.columnDef.meta as {
                        columnType: string;
                        higherIsBetter?: boolean;
                      };
                      const currentSortDirection = header.column.getIsSorted(); // false, 'asc', or 'desc'

                      if (currentSortDirection === false) {
                        // First click
                        if (meta?.columnType === "text") {
                          header.column.toggleSorting(false); // Sort A-Z (asc)
                        } else if (meta?.columnType === "numeric") {
                          const sortDescending = meta.higherIsBetter === true;
                          header.column.toggleSorting(sortDescending);
                        } else {
                          header.column.toggleSorting(false); // Fallback to ascending
                        }
                      } else if (currentSortDirection === "asc") {
                        // Currently ascending, switch to descending
                        header.column.toggleSorting(true);
                      } else {
                        // Currently descending (currentSortDirection === 'desc'), switch to ascending
                        // This also handles any other unexpected sort state by forcing ascending.
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
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={
                  "type" in row.original && row.original.type === "summary"
                    ? styles.summaryRowVisual
                    : ""
                }
              >
                {row.getVisibleCells().map((cell) => {
                  // @ts-ignore Accessing custom meta more safely
                  const meta = cell.column.columnDef.meta as
                    | { isDiffCell?: boolean }
                    | undefined;

                  let tdClassName = "";
                  if (meta?.isDiffCell) {
                    tdClassName = styles.diffCellContainer;
                  }
                  // If you add .summaryRowVisual to styles.ProjectionsPage.module.scss for full row styling:
                  // if (row.original.type === 'summary') {
                  //   tdClassName += ` ${styles.summaryCellInRow}`; // For specific cell styling within a summary row
                  // }

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
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

// --- Main Page Component ---
const ProjectionsPage: NextPage = () => {
  // All hooks must be called unconditionally at the top
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

  // State for fantasy point values for each player type
  const [skaterPointValues, setSkaterPointValues] = useState<
    Record<string, number>
  >(() => getDefaultFantasyPointsConfig("skater"));
  const [goaliePointValues, setGoaliePointValues] = useState<
    Record<string, number>
  >(() => getDefaultFantasyPointsConfig("goalie"));

  // Centralized state for the fantasy points toggle
  const [showPerGameFantasyPoints, setShowPerGameFantasyPoints] =
    useState<boolean>(false);

  // NEW: State for chart data type
  const [chartDataType, setChartDataType] = useState<ChartDataType>("diff");

  // NEW: State for pick bin size for the Actual FP chart
  const [pickBinSize, setPickBinSize] = useState<number>(12);

  // NEW: State to hold extracted round summary data for the context
  const [roundSummaryDataForContext, setRoundSummaryDataForContext] = useState<
    RoundSummaryValue[]
  >([]);

  const togglePerGameFantasyPoints = useCallback(() => {
    setShowPerGameFantasyPoints((prev) => !prev);
  }, []);

  // Always call all hooks at the top level (now safe)
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
    fantasyPointSettings: skaterPointValues, // Use skaterPointValues
    supabaseClient,
    styles,
    currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined,
    showPerGameFantasyPoints, // Pass down state
    togglePerGameFantasyPoints // Pass down callback
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
    fantasyPointSettings: goaliePointValues, // Use goaliePointValues
    supabaseClient,
    styles,
    currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined,
    showPerGameFantasyPoints, // Pass down state
    togglePerGameFantasyPoints // Pass down callback
  });

  // Compute overall data with useMemo (must be called unconditionally)
  const overallData = useMemo(() => {
    // Only use ProcessedPlayer rows (not summary rows)
    const skaters = skaterTabData.processedPlayers.filter(
      (p): p is ProcessedPlayer => !("type" in p)
    );
    const goalies = goalieTabData.processedPlayers.filter(
      (p): p is ProcessedPlayer => !("type" in p)
    );

    if (skaters.length === 0 && goalies.length === 0) {
      return {
        processedPlayers: [],
        tableColumns: [],
        isLoading: skaterTabData.isLoading || goalieTabData.isLoading,
        error: skaterTabData.error || goalieTabData.error
      };
    }
    const rankedUnsorted = assignGlobalRanks(skaters, goalies); // This returns ProcessedPlayer[]

    // Create a map for quick rank lookup
    const rankMap = new Map<number, ProcessedPlayer>();
    rankedUnsorted.forEach((p) => rankMap.set(p.playerId, p));

    // Combine skaters and goalies (still as ProcessedPlayer for now) and inject ranks
    const combinedPlayersWithRanks: ProcessedPlayer[] = [
      ...skaters,
      ...goalies
    ].map((p) => {
      const rankedPlayer = rankMap.get(p.playerId);
      // Ensure per-game fantasy points are calculated or preserved for the Overall tab
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
        // If it was undefined on p, ensure it's null
        projectedPerGame = null;
      }

      if (
        p.fantasyPoints.actual !== null &&
        actualGP !== null &&
        actualGP > 0
      ) {
        actualPerGame = p.fantasyPoints.actual / actualGP;
      } else if (actualPerGame === undefined) {
        // If it was undefined on p, ensure it's null
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

    // Sort by ADP for round summary generation
    const sortedForRoundProcessing = [...combinedPlayersWithRanks].sort(
      (a, b) => {
        const pickA = a.yahooAvgPick ?? Infinity;
        const pickB = b.yahooAvgPick ?? Infinity;
        return pickA - pickB;
      }
    );

    // Now generate rows with summaries, this will return TableDataRow[]
    const overallRowsWithSummaries = addRoundSummariesToPlayers(
      sortedForRoundProcessing,
      calculateDiffPercentage
    );

    // Define columns for the "Overall" tab, including the FP toggle
    const overallColumns: ColumnDef<TableDataRow, any>[] = [
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
                togglePerGameFantasyPoints(); // Use page-level toggle
              }}
              className={styles.collapseButton}
              title={
                showPerGameFantasyPoints // Use page-level state
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
                // Use page-level state
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
                // Use page-level state
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
                // Use page-level state
                // For summary rows, diffPercentagePerGame is pre-calculated
                if ("type" in row && row.type === "summary") {
                  return (
                    (fp as RoundSummaryRow["fantasyPoints"])
                      .diffPercentagePerGame ?? undefined
                  );
                }
                // For player rows, calculate on the fly if needed, or ensure it's on ProcessedPlayer
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
        meta: { columnType: "numeric", higherIsBetter: false }, // Lower ADP is better
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
        meta: { columnType: "numeric", higherIsBetter: false }, // Lower Avg Rd is better
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
          return `${val.toFixed(1)}%`; // Display as percentage
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
    ];

    return {
      processedPlayers: overallRowsWithSummaries, // Use the rows with summaries
      tableColumns: overallColumns,
      isLoading: skaterTabData.isLoading || goalieTabData.isLoading,
      error: skaterTabData.error || goalieTabData.error
    };
  }, [
    skaterTabData,
    goalieTabData,
    showPerGameFantasyPoints,
    togglePerGameFantasyPoints
  ]); // Added dependencies

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
        // Simple stringify for comparison. For more complex objects, a deep-equal library might be better.
        if (JSON.stringify(prevSummaries) !== JSON.stringify(newSummaries)) {
          return newSummaries;
        }
        return prevSummaries;
      });
    } else if (overallData && overallData.processedPlayers.length === 0) {
      // If overallData is present but has no players, clear the summaries if they aren't already empty.
      setRoundSummaryDataForContext((prevSummaries) => {
        if (prevSummaries.length > 0) return [];
        return prevSummaries;
      });
    }
    // Consider if overallData itself being null/undefined (initial loading states) needs specific handling for clearing summaries.
    // For now, this primarily addresses loops once overallData is being populated.
  }, [overallData]); // Dependency on overallData

  // --- Tab switching logic ---
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
    let labels: string[] = []; // For boxplot; for line chart, x-axis is numeric and labels are auto-generated
    let datasets: any[] = [];

    if (chartDataType === "actualFp") {
      // New logic for individual player plotting
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
            x: p.yahooAvgPick as number, // Ensure x is number
            y: p.fantasyPoints.actual as number, // Ensure y is number
            playerFullName: p.fullName,
            displayPosition: p.displayPosition
          }))
          .sort((a, b) => a.x - b.x); // Sort by ADP for correct line drawing

        return {
          label: position,
          data: playerDataPoints,
          borderColor: POSITION_COLORS[position] || POSITION_COLORS["Unknown"],
          backgroundColor:
            POSITION_COLORS[position] || POSITION_COLORS["Unknown"],
          fill: false,
          tension: 0.1, // Slight smoothing for the line
          pointRadius: 3, // Show points for players
          pointHoverRadius: 5
        };
      });
      // Labels for x-axis are not predefined strings here; Chart.js will use a linear scale based on x values.
      // We can pass an empty array or let Chart.js handle it if x values are in datasets.
      labels = []; // Or determine min/max ADP to provide some guidance to Chart.js if needed, but often not required for linear x-axis.
    } else {
      // diff percentage - Box Plot logic (existing)
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
  }, [displayedData.processedPlayers, chartDataType]); // pickBinSize removed from dependencies as it's not used for this 'actualFp' view type

  // Unconditionally call all hooks before any return
  const availableSourcesForTab = useMemo(() => {
    const currentType =
      activePlayerType === "overall" ? "skater" : activePlayerType;
    return PROJECTION_SOURCES_CONFIG.filter(
      (src) => src.playerType === currentType
    );
  }, [activePlayerType]);

  // Initialize sourceControls with all sources selected by default
  useEffect(() => {
    const initialControls: Record<
      string,
      { isSelected: boolean; weight: number }
    > = {};
    PROJECTION_SOURCES_CONFIG.forEach((source) => {
      // Set isSelected to true and weight to 1 for all sources initially
      initialControls[source.id] = { isSelected: true, weight: 1 };
    });
    setSourceControls(initialControls);
  }, []); // Run only once on mount

  const handlePlayerTypeChange = useCallback(
    (tab: "skater" | "goalie" | "overall") => {
      setActivePlayerType(tab);
    },
    [setActivePlayerType] // Dependency: setActivePlayerType (stable)
  );

  const handleSourceSelectionChange = useCallback(
    (sourceId: string, isSelected: boolean) => {
      setSourceControls((prev) => ({
        ...prev,
        [sourceId]: { ...(prev[sourceId] || { weight: 1 }), isSelected }
      }));
    },
    [setSourceControls] // Dependency: setSourceControls (stable)
  );

  const handleSourceWeightChange = useCallback(
    (sourceId: string, weight: number) => {
      const newWeight = Math.max(0.1, weight); // Ensure weight is not too low
      setSourceControls((prev) => ({
        ...prev,
        [sourceId]: {
          ...(prev[sourceId] || { isSelected: true }),
          weight: newWeight
        }
      }));
    },
    [setSourceControls] // Dependency: setSourceControls (stable)
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

  return (
    <>
      <Head>
        <title>Hockey Projections | FHFHockey</title>
        <meta
          name="description"
          content="View and analyze aggregated hockey player projections."
        />
      </Head>
      {/* Provide the round summary data via context */}
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
            {/* New two-column layout for control panels */}
            <div className={styles.controlPanelsGrid}>
              {/* Column 1: Source Selector and Yahoo Mode */}
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

              {/* Column 2: Fantasy Points */}
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
            {/* Chart Section - Rendered above the table */}
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
                      marginBottom: "0.5rem", // Reduced margin to bring controls closer
                      borderBottom: "none",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      flexWrap: "wrap" // Allow wrapping for smaller screens
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
                  {/* Container for Pick Bin Size input, only shown for Actual FP chart IF we bring it back for an alternative view */}
                  {/* For now, hiding it as the current ActualFP view is per-player, not binned */}
                  {/* {chartDataType === 'actualFp' && (
                    <div style={{
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: '10px', 
                      marginBottom: '1rem' 
                    }}>
                      <label htmlFor="pickBinSizeInput" style={{ color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
                        Picks per Bin:
                      </label>
                      <input 
                        type="number" 
                        id="pickBinSizeInput"
                        value={pickBinSize}
                        onChange={(e) => setPickBinSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        min="1"
                        max="60" // Reasonable max
                        step="1"
                        className={styles.fantasySettingInput} // Re-use style for consistency
                        style={{ width: '80px' }}
                        title="Set the number of picks grouped into each bin for the x-axis (1-60)"
                      />
                    </div>
                  )} */}
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
              <ProjectionsDataTable
                columns={displayedData.tableColumns}
                data={displayedData.processedPlayers}
              />
            )}
          </section>
        </main>
      </RoundSummaryContext.Provider>
    </>
  );
};

export default ProjectionsPage;
