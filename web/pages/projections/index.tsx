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

// Import the new chart component
import RoundPerformanceBoxPlotChart from "components/Projections/RoundPerformanceBoxPlotChart"; // Adjust path as needed

const supabaseClient = supabase;

// Helper for formatting TOI/G moved to lib/utils/formatting.ts and handled by cell renderer in useProcessedProjectionsData

interface PlayerTypeTabsProps {
  activeTab: "skater" | "goalie";
  onTabChange: (tab: "skater" | "goalie") => void;
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
  activePlayerType: "skater" | "goalie";
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
  const [activePlayerType, setActivePlayerType] = useState<"skater" | "goalie">(
    "skater"
  );
  const [sourceControls, setSourceControls] = useState<
    Record<string, { isSelected: boolean; weight: number }>
  >({});
  const [yahooDraftMode, setYahooDraftMode] = useState<"ALL" | "PRESEASON">(
    "ALL"
  );
  const [fantasyPointSettings, setFantasyPointSettings] = useState<
    Record<string, number>
  >({});
  const currentSeason = useCurrentSeason(); // Fetch current season data

  useEffect(() => {
    const initialControls: Record<
      string,
      { isSelected: boolean; weight: number }
    > = {};
    PROJECTION_SOURCES_CONFIG.filter(
      (src) => src.playerType === activePlayerType
    ).forEach((src) => {
      initialControls[src.id] = { isSelected: true, weight: 1 };
    });
    setSourceControls(initialControls);

    // Initialize fantasy point settings
    const defaultFPConfig = getDefaultFantasyPointsConfig(activePlayerType);
    const initialFPSettings: Record<string, number> = {};
    STATS_MASTER_LIST.forEach((stat) => {
      if (
        (activePlayerType === "skater" && stat.isSkaterStat) ||
        (activePlayerType === "goalie" && stat.isGoalieStat)
      ) {
        initialFPSettings[stat.key] = defaultFPConfig[stat.key] ?? 0;
      }
    });
    setFantasyPointSettings(initialFPSettings);
  }, [activePlayerType]);

  const availableSourcesForTab = useMemo(() => {
    return PROJECTION_SOURCES_CONFIG.filter(
      (src) => src.playerType === activePlayerType
    );
  }, [activePlayerType]);

  // Guard against calling the hook before currentSeason is loaded
  const currentSeasonId = currentSeason?.seasonId;

  const { processedPlayers, tableColumns, isLoading, error } =
    useProcessedProjectionsData({
      activePlayerType,
      sourceControls,
      yahooDraftMode,
      fantasyPointSettings,
      supabaseClient,
      styles,
      currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined // Pass the dynamic season ID
    });

  const chartPresentationData = useMemo(() => {
    if (!processedPlayers || processedPlayers.length === 0) {
      return { labels: [], dataForChart: [] };
    }

    const players = processedPlayers.filter(
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
  }, [processedPlayers]);

  // Handle case where supabaseClient might not be initialized on first render, though it should be.
  // Or, ensure ProjectionsPage only renders when supabaseClient is available.
  // For now, the hook expects it. If it can be null, the hook needs to handle it.
  // The hook was modified to expect non-null, so this check is more for robustness if supabaseClient could be null.
  if (!supabaseClient) {
    return (
      <div className={styles.loadingState}>
        <p>Initializing...</p>
      </div>
    );
    // Or some other loading/error state if supabase client itself is the issue.
    // This scenario should be rare if supabase is initialized correctly at app startup.
  }

  // Show loading state while currentSeason is being fetched
  if (!currentSeasonId) {
    return (
      <div className={styles.loadingState}>
        <p>Loading current season data...</p>
      </div>
    );
  }

  const handlePlayerTypeChange = (tab: "skater" | "goalie") => {
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
            activePlayerType={activePlayerType}
            fantasyPointSettings={fantasyPointSettings}
            onFantasyPointSettingChange={handleFantasyPointSettingChange}
          />
        </section>

        <section className={styles.dataDisplaySection}>
          {/* Chart Section - Rendered above the table */}
          {!isLoading &&
            !error &&
            processedPlayers.length > 0 &&
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

          {isLoading && (
            <div className={styles.loadingState}>
              <p>Loading projections...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className={styles.errorState}>
              <p className={styles.errorTitle}>Error loading data:</p>
              <p className={styles.errorMessage}>{error}</p>
            </div>
          )}
          {!isLoading && !error && (
            <ProjectionsDataTable
              columns={tableColumns}
              data={processedPlayers}
            />
          )}
        </section>
      </main>
    </>
  );
};

export default ProjectionsPage;
