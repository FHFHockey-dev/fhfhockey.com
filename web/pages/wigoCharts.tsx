// /pages/wigoCharts.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react"; // Added useMemo
import dynamic from "next/dynamic";

import styles from "styles/wigoCharts.module.scss"; // Main styles
import {
  Player,
  TeamColors,
  defaultColors,
  TableAggregateData,
  CombinedPlayerStats
} from "components/WiGO/types";
import NameSearchBar from "components/WiGO/NameSearchBar";
import { getTeamInfoById, teamNameToAbbreviationMap } from "lib/teamsInfo";
import { fetchPlayerAggregatedStats } from "utils/fetchWigoPlayerStats";
import TimeframeComparison from "components/WiGO/TimeframeComparison";
import CategoryCoverageChart from "components/CategoryCoverageChart";
import GameScoreSection from "components/WiGO/GameScoreSection";
import PlayerHeader from "components/WiGO/PlayerHeader";
import StatsTable from "components/WiGO/StatsTable"; // The modified component
import PerGameStatsTable from "components/WiGO/PerGameStatsTable";
import RateStatPercentiles from "components/WiGO/RateStatPercentiles";
import useCurrentSeason from "hooks/useCurrentSeason";
import OpponentGamelog from "components/WiGO/OpponentGamelog";
import PlayerRatingsDisplay from "components/WiGO/PlayerRatingsDisplay";
// Removed TimeOptions import if not used elsewhere

import {
  computeDiffColumnForCounts,
  computeDiffColumnForRates,
  formatCell as formatCellUtil // Rename imported function to avoid naming conflict
} from "components/WiGO/tableUtils";

// --- Dynamically import components (remains the same) ---
const ChartLoadingPlaceholder = ({ message }: { message: string }) => (
  <div className={styles.chartLoadingPlaceholder}>{message}</div>
);

const ToiLineChart = dynamic(() => import("components/WiGO/ToiLineChart"), {
  ssr: false,
  loading: () => <ChartLoadingPlaceholder message="Loading TOI Chart..." />
});

const PpgLineChart = dynamic(() => import("components/WiGO/PpgLineChart"), {
  ssr: false,
  loading: () => <ChartLoadingPlaceholder message="Loading PPG Chart..." />
});

const ConsistencyChart = dynamic(
  () => import("components/WiGO/ConsistencyChart"),
  {
    ssr: false,
    loading: () => <ChartLoadingPlaceholder message="Loading Consistency..." />
  }
);
// --- End Dynamic Imports ---

const WigoCharts: React.FC = () => {
  // --- State variables ---
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [teamIdForLog, setTeamIdForLog] = useState<number | null>(null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [teamColors, setTeamColors] = useState<TeamColors>(defaultColors);
  // Raw data state remains separate for DIFF calculation
  const [rawCountsData, setRawCountsData] = useState<TableAggregateData[]>([]);
  const [rawRatesData, setRawRatesData] = useState<TableAggregateData[]>([]);
  // ** REMOVED displayCountsData and displayRatesData state **
  const [isLoadingAggData, setIsLoadingAggData] = useState<boolean>(false);
  const [aggDataError, setAggDataError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [teamAbbreviation, setTeamAbbreviation] = useState<string | null>(null);
  const [leftTimeframe, setLeftTimeframe] =
    useState<keyof TableAggregateData>("STD");
  const [rightTimeframe, setRightTimeframe] =
    useState<keyof TableAggregateData>("CA");
  const placeholderImage = "/pictures/player-placeholder.jpg";
  const [minGp, setMinGp] = useState<number>(10);

  const currentSeasonData = useCurrentSeason();
  const currentSeasonId = currentSeasonData?.seasonId ?? null;

  // Handle player selection (remains the same)
  const handlePlayerSelect = useCallback((player: Player, headshot: string) => {
    setSelectedPlayer(player);
    setHeadshotUrl(headshot);
    setTeamIdForLog(player.team_id ?? null);

    if (player.team_id) {
      const teamInfo = getTeamInfoById(player.team_id);
      if (teamInfo) {
        const abbr = teamNameToAbbreviationMap[teamInfo.name] ?? null;
        setTeamName(teamInfo.name);
        setTeamAbbreviation(abbr);
        setTeamColors({
          primaryColor: teamInfo.primaryColor,
          secondaryColor: teamInfo.secondaryColor,
          accentColor: teamInfo.accent,
          altColor: teamInfo.alt,
          jerseyColor: teamInfo.jersey
        });
      } else {
        setTeamName("");
        setTeamAbbreviation(null);
        setTeamColors(defaultColors);
      }
    } else {
      setTeamName("");
      setTeamAbbreviation(null);
      setTeamColors(defaultColors);
    }
    setLeftTimeframe("STD");
    setRightTimeframe("CA");
    setRawCountsData([]); // Clear raw data
    setRawRatesData([]); // Clear raw data
    setAggDataError(null); // Clear error
  }, []);

  // Fetch aggregated data effect (Counts/Rates)
  useEffect(() => {
    if (!selectedPlayer) {
      setRawCountsData([]);
      setRawRatesData([]);
      setAggDataError(null);
      return;
    }

    const fetchData = async () => {
      setIsLoadingAggData(true);
      setAggDataError(null);
      setRawCountsData([]);
      setRawRatesData([]);

      try {
        const aggregatedData: CombinedPlayerStats =
          await fetchPlayerAggregatedStats(selectedPlayer.id);

        // Set raw data, let useMemo handle processing and combining
        setRawCountsData(aggregatedData.counts || []); // Ensure array even if null/undefined
        setRawRatesData(aggregatedData.rates || []); // Ensure array even if null/undefined

        if (
          aggregatedData.counts.length === 0 &&
          aggregatedData.rates.length === 0
        ) {
          console.log(
            "No aggregated stats returned for player:",
            selectedPlayer.id
          );
          // Optional: setAggDataError("No aggregated statistics available.");
        }
      } catch (error) {
        console.error("Error fetching aggregated stats:", error);
        setAggDataError("Failed to load Counts/Rates statistics.");
        setRawCountsData([]);
        setRawRatesData([]);
      } finally {
        setIsLoadingAggData(false);
      }
    };

    fetchData();
  }, [selectedPlayer]);

  // --- Calculate Combined Data with DIFF using useMemo ---
  const combinedDisplayData = useMemo(() => {
    // Compute DIFF columns first
    const processedCounts =
      rawCountsData.length > 0
        ? computeDiffColumnForCounts(
            rawCountsData,
            leftTimeframe,
            rightTimeframe
          )
        : [];
    const processedRates =
      rawRatesData.length > 0
        ? computeDiffColumnForRates(rawRatesData, leftTimeframe, rightTimeframe)
        : [];

    // Find the GP row *from the processed counts data*
    // It's important to find it *after* computeDiff... because that func returns a clone
    const gpRow = processedCounts.find((r) => r.label === "GP") || null;

    // Combine the processed arrays
    const combinedData = [...processedCounts, ...processedRates];

    // Return both combined data and the GP row for use in formatCell
    return { combinedData, gpRow };
  }, [rawCountsData, rawRatesData, leftTimeframe, rightTimeframe]); // Dependencies

  // Handler for timeframe changes (remains the same)
  const handleTimeframeCompare = useCallback((left: string, right: string) => {
    setLeftTimeframe(left as keyof TableAggregateData);
    setRightTimeframe(right as keyof TableAggregateData);
  }, []);

  // --- Wrapper for formatCell to pass the correct GP value ---
  // This function will be passed to the StatsTable component
  const formatCellForTable = useCallback(
    (
      row: TableAggregateData,
      columnKey: keyof Omit<TableAggregateData, "label" | "GP" | "DIFF">
    ): string => {
      // Get the specific GP value for the current column (timeframe) from the gpRow
      // The gpRow is available via the combinedDisplayData memoized value
      const gpValueForColumn =
        combinedDisplayData.gpRow && combinedDisplayData.gpRow[columnKey]
          ? combinedDisplayData.gpRow[columnKey]
          : null;

      // Call the original utility function with the necessary GP value
      // You might need to adjust formatCellUtil if it doesn't accept gpValueForColumn
      // OR adjust the logic here based on formatCellUtil's needs.
      // Assuming formatCellUtil *can* use this (based on previous PPTOI logic needing GP):
      // return formatCellUtil(row, columnKey, gpValueForColumn); // Pass GP if needed

      // If formatCellUtil CANNOT be modified, replicate logic here or slightly adjust call:
      const value = row[columnKey];
      const label = row.label;

      if (value == null || (typeof value === "number" && isNaN(value)))
        return "-";

      // Handle specific cases needing GP (like PPTOI from your util)
      if (label === "PPTOI") {
        if (gpValueForColumn != null && gpValueForColumn > 0) {
          const avgMinutesPPTOI = value / gpValueForColumn;
          const avgSecondsPPTOI = avgMinutesPPTOI * 60;
          // You'll need formatSecondsToMMSS accessible here too
          // Assuming formatSecondsToMMSS is also exported from tableUtils
          // return formatSecondsToMMSS(avgSecondsPPTOI); // If available
          // Placeholder if formatSecondsToMMSS isn't imported:
          const totalSeconds = Math.round(avgSecondsPPTOI);
          const mins = Math.floor(totalSeconds / 60);
          const secs = totalSeconds % 60;
          return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
        } else {
          return "0:00"; // Or "-" if preferred when GP is 0 or null
        }
      }
      if (label === "ATOI") {
        // Check if the value is from wigo_recent (seconds) or wigo_career (minutes)
        // If the value is greater than 60, it's likely in seconds (from wigo_recent)
        const isRecentData = value > 60;
        const totalSeconds = isRecentData ? value : value * 60;
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.round(totalSeconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
      }

      // Fallback to the general logic from formatCellUtil for other cases
      return formatCellUtil(row, columnKey); // Call original for other types
    },
    [combinedDisplayData.gpRow, formatCellUtil] // Dependency: gpRow from memo
  );

  return (
    <div className={styles.wigoDashHeader}>
      <div className={styles.wigoHeader}>
        <span className={styles.spanColorBlue}>WiGO</span>
        {"\u00A0\u00A0//\u00A0\u00A0"}
        <span className={styles.spanColorBlue}>W</span>
        HAT
        {"\u00A0\u00A0"}
        <span className={styles.spanColorBlue}>I</span>S{"\u00A0\u00A0"}
        <span className={styles.spanColorBlue}>G</span>
        OING
        {"\u00A0\u00A0"}
        <span className={styles.spanColorBlue}>O</span>N
      </div>
      <div className={styles.wigoDashboardContainer}>
        <div
          className={styles.wigoDashboardContent} // The Grid Container
          style={
            {
              "--primary-color": teamColors.primaryColor,
              "--secondary-color": teamColors.secondaryColor,
              "--accent-color": teamColors.accentColor,
              "--alt-color": teamColors.altColor,
              "--jersey-color": teamColors.jerseyColor
            } as React.CSSProperties
          }
        >
          {/* --- Top Row --- */}
          <div className={styles.nameSearchBarContainer}>
            <NameSearchBar onSelect={handlePlayerSelect} />
          </div>
          {/* Moved TimeframeComparison near the combined table it affects */}

          <div className={styles.consistencyRatingContainer}>
            {selectedPlayer ? (
              <ConsistencyChart playerId={selectedPlayer.id} />
            ) : (
              <ChartLoadingPlaceholder message="Select a player" />
            )}
          </div>

          {/* --- Left Column --- */}
          <div className={styles.playerHeaderContainer}>
            <PlayerHeader
              selectedPlayer={selectedPlayer}
              headshotUrl={headshotUrl}
              teamName={teamName}
              teamAbbreviation={teamAbbreviation}
              teamColors={teamColors}
              placeholderImage={placeholderImage}
            />
          </div>
          <div className={styles.percentileChartContainer}>
            <CategoryCoverageChart
              playerId={selectedPlayer?.id}
              timeOption="SEASON" // Or make dynamic if needed
            />
          </div>
          {/* Timeframe selection often placed near the tables */}
          <div className={styles.timeframeComparisonWrapper}>
            <TimeframeComparison
              initialLeft={leftTimeframe}
              initialRight={rightTimeframe}
              onCompare={handleTimeframeCompare}
              // Disable interaction while loading if desired
              // disabled={isLoadingAggData}
            />
          </div>

          <div className={styles.rateStatBarPercentilesContainer}>
            <RateStatPercentiles
              playerId={selectedPlayer?.id}
              minGp={minGp}
              onMinGpChange={setMinGp}
            />
          </div>

          {/* --- Center Columns (Combined Table & PerGame) --- */}

          {/* ** Combined Stats Table Container ** */}
          <div className={styles.combinedStatsTableContainer}>
            <StatsTable
              // tableTitle="Aggregated Stats" // Optional title
              // Use the data from useMemo
              data={combinedDisplayData.combinedData}
              // Show loading only if fetching AND we have no data yet
              isLoading={
                isLoadingAggData &&
                combinedDisplayData.combinedData.length === 0
              }
              error={aggDataError}
              // Pass the formatting function that uses the correct GP row
              formatCell={formatCellForTable}
              playerId={selectedPlayer?.id ?? 0}
              currentSeasonId={currentSeasonId ?? 0}
              leftTimeframe={leftTimeframe}
              rightTimeframe={rightTimeframe}
            />
          </div>

          {/* ** REMOVED the separate countsTableContainer and ratesTableContainer divs ** */}

          <div className={styles.perGameStatsContainer}>
            <PerGameStatsTable playerId={selectedPlayer?.id} />
          </div>

          {/* --- Right Column --- */}
          <div className={styles.ratingsContainer}>
            {selectedPlayer ? (
              <PlayerRatingsDisplay
                playerId={selectedPlayer.id}
                minGp={minGp}
              />
            ) : (
              <div className={styles.chartLoadingPlaceholder}>
                Select player for ratings
              </div>
            )}
          </div>

          <div className={styles.opponentLogContainer}>
            <OpponentGamelog
              teamId={teamIdForLog}
              highlightColor={teamColors.primaryColor || "#07aae2"} // Use team color
            />
          </div>

          {/* --- Bottom Row (Charts) --- */}
          <div className={styles.toiChartContainer}>
            <ToiLineChart playerId={selectedPlayer?.id} />
          </div>
          <div className={styles.ppgChartContainer}>
            <PpgLineChart playerId={selectedPlayer?.id} />
          </div>
          <div className={styles.gameScoreContainer}>
            <GameScoreSection playerId={selectedPlayer?.id} />
          </div>
        </div>{" "}
        {/* End .wigoDashboardContent */}
      </div>
    </div>
  );
};

export default WigoCharts;
