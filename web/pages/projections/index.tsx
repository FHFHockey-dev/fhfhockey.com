// pages/projections/index.tsx

// TO DO:
// Bring in actual stats from wgo_skater_stats_totals and wgo_goalie_stats_totals
// Compare projections to actual stats by %
// implement table sorting
// implement fantasy points scoring, real and projected
// implement table filtering => Add/remove stat categories

import React, { useState, useEffect, useMemo } from "react";
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
  RoundSummaryRow
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
import RoundPerformanceBoxPlotChart from "components/Projections/RoundPerformanceBoxPlotChart"; // Adjust path as needed

const supabaseClient = supabase;

// Helper for formatting TOI/G moved to lib/utils/formatting.ts and handled by cell renderer in useProcessedProjectionsData

interface PlayerTypeTabsProps {
  activeTab: "skater" | "goalie" | "overall";
  onTabChange: (tab: "skater" | "goalie" | "overall") => void;
}
const PlayerTypeTabs: React.FC<PlayerTypeTabsProps> = ({
  activeTab,
  onTabChange
}) => (
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
);

interface SourceSelectorPanelProps {
  availableSources: ProjectionSourceConfig[];
  sourceControls: Record<string, { isSelected: boolean; weight: number }>;
  onSourceSelectionChange: (sourceId: string, isSelected: boolean) => void;
  onSourceWeightChange: (sourceId: string, weight: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}
const SourceSelectorPanel: React.FC<SourceSelectorPanelProps> = ({
  availableSources,
  sourceControls,
  onSourceSelectionChange,
  onSourceWeightChange,
  onSelectAll,
  onDeselectAll
}) => (
  <div className={styles.controlPanel}>
    <h3 className={styles.panelTitle}>
      Projection <span className={styles.spanColorBlue}>Sources</span>
    </h3>
    <div className={styles.sourceSelectorHeader}>
      <button onClick={onSelectAll} className={styles.sourceSelectorButton}>
        Select All
      </button>
      <button onClick={onDeselectAll} className={styles.sourceSelectorButton}>
        Deselect All
      </button>
    </div>
    <div className={styles.sourceGrid}>
      {availableSources.map((source) => (
        <div key={source.id} className={styles.sourceItem}>
          <label htmlFor={`source-${source.id}`} className={styles.sourceLabel}>
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
);

interface YahooModeToggleProps {
  currentMode: "ALL" | "PRESEASON";
  onModeChange: (mode: "ALL" | "PRESEASON") => void;
}
const YahooModeToggle: React.FC<YahooModeToggleProps> = ({
  currentMode,
  onModeChange
}) => (
  <div className={styles.controlPanel}>
    <h3 className={styles.panelTitle}>
      Yahoo <span className={styles.spanColorBlue}>Draft Analysis</span>
    </h3>
    <div className={styles.yahooModeContainer}>
      {(["ALL", "PRESEASON"] as const).map((mode) => (
        <label key={mode} className={styles.yahooModeLabel}>
          <input
            type="radio"
            name="yahooMode"
            value={mode}
            checked={currentMode === mode}
            onChange={() => onModeChange(mode)}
          />
          <span>{mode.charAt(0) + mode.slice(1).toLowerCase()}</span>
        </label>
      ))}
    </div>
  </div>
);

interface FantasyPointsSettingsPanelProps {
  activePlayerType: "skater" | "goalie" | "overall";
  fantasyPointSettings: Record<string, number>;
  onFantasyPointSettingChange: (statKey: string, value: number) => void;
}
const FantasyPointsSettingsPanel: React.FC<FantasyPointsSettingsPanelProps> = ({
  activePlayerType,
  fantasyPointSettings,
  onFantasyPointSettingChange
}) => {
  const relevantStats = useMemo(() => {
    return STATS_MASTER_LIST.filter(
      (stat) =>
        (activePlayerType === "skater" && stat.isSkaterStat) ||
        (activePlayerType === "goalie" && stat.isGoalieStat)
    ).sort((a, b) => a.displayName.localeCompare(b.displayName)); // Sort for consistent order
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
              {stat.displayName} ({stat.key})
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
};

interface ProjectionsDataTableProps {
  columns: ColumnDef<TableDataRow, any>[]; // Use TableDataRow
  data: TableDataRow[]; // Use TableDataRow
}

const ProjectionsDataTable: React.FC<ProjectionsDataTableProps> = ({
  columns,
  data
}) => {
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

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

  // Helper to get default FP config for a type
  const getFPConfig = (type: "skater" | "goalie") => {
    const defaultFPConfig = getDefaultFantasyPointsConfig(type);
    const initialFPSettings: Record<string, number> = {};
    STATS_MASTER_LIST.forEach((stat) => {
      if (
        (type === "skater" && stat.isSkaterStat) ||
        (type === "goalie" && stat.isGoalieStat)
      ) {
        initialFPSettings[stat.key] = defaultFPConfig[stat.key] ?? 0;
      }
    });
    return initialFPSettings;
  };

  // Calculate default skater and goalie FP settings once
  const skaterFPSettings = useMemo(() => getFPConfig("skater"), []);
  const goalieFPSettings = useMemo(() => getFPConfig("goalie"), []);

  // Initialize fantasyPointSettings based on the initial activePlayerType ("skater")
  const [fantasyPointSettings, setFantasyPointSettings] = useState<
    Record<string, number>
  >(() => skaterFPSettings);

  // Effect to update UI-bound fantasyPointSettings when activePlayerType changes
  useEffect(() => {
    if (activePlayerType === "skater") {
      setFantasyPointSettings(skaterFPSettings);
    } else if (activePlayerType === "goalie") {
      setFantasyPointSettings(goalieFPSettings);
    } else if (activePlayerType === "overall") {
      // For "overall" tab, FantasyPointsSettingsPanel shows skater settings by default
      setFantasyPointSettings(skaterFPSettings);
    }
  }, [activePlayerType, skaterFPSettings, goalieFPSettings]);

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
    fantasyPointSettings: skaterFPSettings,
    supabaseClient,
    styles,
    currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined
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
    fantasyPointSettings: goalieFPSettings,
    supabaseClient,
    styles,
    currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined
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
    const ranked = assignGlobalRanks(skaters, goalies);
    // Inject ranks back
    const skatersWithRanks = injectRanks(skaters, ranked);
    const goaliesWithRanks = injectRanks(goalies, ranked);
    // For overall, combine and sort by actual FP desc
    const overallRows = [...skatersWithRanks, ...goaliesWithRanks].sort(
      (a, b) =>
        (b.fantasyPoints.actual ?? -Infinity) -
        (a.fantasyPoints.actual ?? -Infinity)
    );
    // Only show core columns for overall
    const overallColumns: ColumnDef<TableDataRow, any>[] = [
      {
        id: "fullName",
        header: "Player",
        accessorKey: "fullName",
        cell: (info) => (info.row.original as ProcessedPlayer).fullName,
        meta: { columnType: "text" },
        enableSorting: true
      },
      {
        id: "displayTeam",
        header: "Team",
        accessorKey: "displayTeam",
        cell: (info) => (info.row.original as ProcessedPlayer).displayTeam,
        meta: { columnType: "text" },
        enableSorting: true
      },
      {
        id: "displayPosition",
        header: "Pos",
        accessorKey: "displayPosition",
        cell: (info) => (info.row.original as ProcessedPlayer).displayPosition,
        meta: { columnType: "text" },
        enableSorting: true
      },
      {
        id: "fp_proj",
        header: "Proj FP",
        accessorFn: (player) =>
          (player as ProcessedPlayer).fantasyPoints.projected ?? undefined,
        cell: (info) => {
          const val = (info.row.original as ProcessedPlayer).fantasyPoints
            .projected;
          return val !== null && val !== undefined ? val.toFixed(1) : "-";
        },
        meta: { columnType: "numeric", higherIsBetter: true },
        enableSorting: true,
        sortUndefined: "last"
      },
      {
        id: "fp_actual",
        header: "Actual FP",
        accessorFn: (player) =>
          (player as ProcessedPlayer).fantasyPoints.actual ?? undefined,
        cell: (info) => {
          const val = (info.row.original as ProcessedPlayer).fantasyPoints
            .actual;
          return val !== null && val !== undefined ? val.toFixed(1) : "-";
        },
        meta: { columnType: "numeric", higherIsBetter: true },
        enableSorting: true,
        sortUndefined: "last"
      },
      {
        id: "projectedRank",
        header: "P-Rank",
        accessorFn: (player) =>
          (player as ProcessedPlayer).projectedRank ?? undefined,
        cell: (info) => {
          const val = (info.row.original as ProcessedPlayer).projectedRank;
          return val !== null && val !== undefined ? val : "-";
        },
        meta: { columnType: "numeric", higherIsBetter: false },
        enableSorting: true,
        sortUndefined: "last"
      },
      {
        id: "actualRank",
        header: "A-Rank",
        accessorFn: (player) =>
          (player as ProcessedPlayer).actualRank ?? undefined,
        cell: (info) => {
          const val = (info.row.original as ProcessedPlayer).actualRank;
          return val !== null && val !== undefined ? val : "-";
        },
        meta: { columnType: "numeric", higherIsBetter: false },
        enableSorting: true,
        sortUndefined: "last"
      }
    ];
    return {
      processedPlayers: overallRows,
      tableColumns: overallColumns,
      isLoading: skaterTabData.isLoading || goalieTabData.isLoading,
      error: skaterTabData.error || goalieTabData.error
    };
  }, [skaterTabData, goalieTabData]);

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
      return { labels: [], dataForChart: [] };
    }

    const players = displayedData.processedPlayers.filter(
      (p): p is ProcessedPlayer => !("type" in p) || p.type !== "summary"
    );

    const playersByRound: Record<number, ProcessedPlayer[]> = {};
    players.forEach((player) => {
      if (player.yahooAvgPick != null && player.yahooAvgPick > 0) {
        const round = Math.ceil(player.yahooAvgPick / 12); // Assuming 12 picks per round
        if (!playersByRound[round]) {
          playersByRound[round] = [];
        }
        playersByRound[round].push(player);
      }
    });

    const rounds = Object.keys(playersByRound)
      .map(Number)
      .sort((a, b) => a - b)
      .slice(0, 15); // Cap at 15 rounds for readability

    const dataForChart = rounds.map((roundNum) => {
      return playersByRound[roundNum]
        .map((p) => p.fantasyPoints.diffPercentage)
        .filter(
          (diff) =>
            diff !== null && // Check for null
            diff !== 99999 && // Check for special positive value
            diff !== -99999 && // Check for special negative value
            typeof diff === "number" && // Ensure it's a number
            !isNaN(diff) // Ensure it's not NaN
        ) as number[]; // Filter out nulls and special large values for better plot scale
    });
    const labels = rounds.map((r) => `R${r}`); // Shorter labels: "R1", "R2", etc.

    // --- Add "All Drafted" category ---
    const allDraftedPlayersDiffs = players
      .filter(
        (player) => player.yahooAvgPick != null && player.yahooAvgPick > 0
      ) // All players with an ADP
      .map((p) => p.fantasyPoints.diffPercentage)
      .filter(
        (diff) =>
          diff !== null &&
          diff !== 99999 &&
          diff !== -99999 &&
          typeof diff === "number" &&
          !isNaN(diff)
      ) as number[];

    if (allDraftedPlayersDiffs.length > 0) {
      labels.push("All Drafted");
      dataForChart.push(allDraftedPlayersDiffs);
    }
    // --- End "All Drafted" category ---

    return { labels, dataForChart };
  }, [displayedData.processedPlayers]);

  // Unconditionally call all hooks before any return
  // Unconditionally call all hooks before any return
  const availableSourcesForTab = useMemo(() => {
    return PROJECTION_SOURCES_CONFIG.filter(
      (src) => src.playerType === activePlayerType
    );
  }, [activePlayerType]);

  // // Now, render loading state if needed
  // if (!supabaseClient || !currentSeasonId) {
  //   return (
  //     <div className={styles.loadingState}>
  //       <p>Loading current season data...</p>
  //     </div>
  //   );
  // }

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

  const handlePlayerTypeChange = (tab: "skater" | "goalie" | "overall") => {
    setActivePlayerType(tab);
  };

  const handleSourceSelectionChange = (
    sourceId: string,
    isSelected: boolean
  ) => {
    setSourceControls((prev) => ({
      ...prev,
      [sourceId]: { ...(prev[sourceId] || { weight: 1 }), isSelected }
    }));
  };

  const handleSourceWeightChange = (sourceId: string, weight: number) => {
    const newWeight = Math.max(0.1, weight); // Ensure weight is not too low
    setSourceControls((prev) => ({
      ...prev,
      [sourceId]: {
        ...(prev[sourceId] || { isSelected: true }),
        weight: newWeight
      }
    }));
  };

  const handleSelectAllSources = () => {
    const updatedControls = { ...sourceControls };
    availableSourcesForTab.forEach((src) => {
      updatedControls[src.id] = {
        ...(updatedControls[src.id] || { weight: 1 }),
        isSelected: true
      };
    });
    setSourceControls(updatedControls);
  };

  const handleDeselectAllSources = () => {
    const updatedControls = { ...sourceControls };
    availableSourcesForTab.forEach((src) => {
      updatedControls[src.id] = {
        ...(updatedControls[src.id] || { weight: 1 }),
        isSelected: false
      };
    });
    setSourceControls(updatedControls);
  };

  const handleFantasyPointSettingChange = (statKey: string, value: number) => {
    setFantasyPointSettings((prev) => ({
      ...prev,
      [statKey]: isNaN(value) ? 0 : value // Ensure value is a number, default to 0 if NaN
    }));
  };

  return (
    <>
      <Head>
        <title>Hockey Projections | FHFHockey</title>
        <meta
          name="description"
          content="View and analyze aggregated hockey player projections."
        />
      </Head>

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
          <FantasyPointsSettingsPanel
            activePlayerType={
              activePlayerType === "overall" ? "skater" : activePlayerType
            }
            fantasyPointSettings={fantasyPointSettings}
            onFantasyPointSettingChange={handleFantasyPointSettingChange}
          />
        </section>

        <section className={styles.dataDisplaySection}>
          {/* Chart Section - Rendered above the table */}
          {!displayedData.isLoading &&
            !displayedData.error &&
            displayedData.processedPlayers.length > 0 &&
            chartPresentationData.labels.length > 0 && (
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
                    marginBottom: "1rem",
                    borderBottom: "none"
                  }}
                >
                  Player Fantasy Point Difference %{" "}
                  <span className={styles.spanColorBlue}>by Draft Round</span>
                </h3>
                <RoundPerformanceBoxPlotChart
                  labels={chartPresentationData.labels}
                  data={chartPresentationData.dataForChart}
                  styles={styles}
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
    </>
  );
};

export default ProjectionsPage;
