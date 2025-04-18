// /pages/wigoCharts.tsx
import React, { useState, useEffect, useCallback } from "react";
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
import StatsTable from "components/WiGO/StatsTable";
import PerGameStatsTable from "components/WiGO/PerGameStatsTable";
import RateStatPercentiles from "components/WiGO/RateStatPercentiles"; // Adjust path
import TimeOptions, { TimeOption } from "components/TimeOptions/TimeOptions";

import {
  computeDiffColumnForCounts,
  computeDiffColumnForRates,
  formatCell
} from "components/WiGO/tableUtils";

// --- Dynamically import components using Chart.js or browser APIs ---
// Helper for loading placeholder
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

// GameScoreSection might internally render charts, so dynamic import might apply there too.
// If GameScoreSection itself uses Chart.js directly:
// const GameScoreSection = dynamic(() => import('components/WiGO/GameScoreSection'), {
//   ssr: false,
//   loading: () => <ChartLoadingPlaceholder message="Loading Game Score..." />
// });
// If GameScoreSection just orchestrates other dynamic chart components, it might not need to be dynamic itself.

const WigoCharts: React.FC = () => {
  // --- State variables remain the same ---
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [teamColors, setTeamColors] = useState<TeamColors>(defaultColors);
  const [rawCountsData, setRawCountsData] = useState<TableAggregateData[]>([]);
  const [rawRatesData, setRawRatesData] = useState<TableAggregateData[]>([]);
  const [displayCountsData, setDisplayCountsData] = useState<
    TableAggregateData[]
  >([]);
  const [displayRatesData, setDisplayRatesData] = useState<
    TableAggregateData[]
  >([]);
  const [isLoadingAggData, setIsLoadingAggData] = useState<boolean>(false); // Specific loader for Counts/Rates
  const [aggDataError, setAggDataError] = useState<string | null>(null); // Specific error for Counts/Rates
  const [teamName, setTeamName] = useState<string>("");
  const [teamAbbreviation, setTeamAbbreviation] = useState<string | null>(null);
  const [leftTimeframe, setLeftTimeframe] =
    useState<keyof TableAggregateData>("STD");
  const [rightTimeframe, setRightTimeframe] =
    useState<keyof TableAggregateData>("CA");
  const placeholderImage = "/pictures/player-placeholder.jpg";

  // Handle player selection (remains the same)
  const handlePlayerSelect = useCallback((player: Player, headshot: string) => {
    setSelectedPlayer(player);
    setHeadshotUrl(headshot);

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
    // Reset timeframes on new player select
    setLeftTimeframe("STD");
    setRightTimeframe("CA");
    // Clear previous data immediately on selection
    setRawCountsData([]);
    setRawRatesData([]);
    setDisplayCountsData([]);
    setDisplayRatesData([]);
    setAggDataError(null);
  }, []);

  // Function to update display data based on selected timeframes
  const updateDisplayData = useCallback(() => {
    if (rawCountsData.length > 0) {
      const updatedCounts = computeDiffColumnForCounts(
        rawCountsData,
        leftTimeframe,
        rightTimeframe
      );
      setDisplayCountsData(updatedCounts);
    } else {
      setDisplayCountsData([]);
    }

    if (rawRatesData.length > 0) {
      const updatedRates = computeDiffColumnForRates(
        rawRatesData,
        leftTimeframe,
        rightTimeframe
      );
      setDisplayRatesData(updatedRates);
    } else {
      setDisplayRatesData([]);
    }
  }, [rawCountsData, rawRatesData, leftTimeframe, rightTimeframe]); // Dependencies

  // Fetch aggregated data effect (Counts/Rates)
  useEffect(() => {
    if (!selectedPlayer) {
      // Clear state if no player is selected
      setRawCountsData([]);
      setRawRatesData([]);
      setDisplayCountsData([]);
      setDisplayRatesData([]);
      setAggDataError(null);
      // Note: Player header info is cleared in handlePlayerSelect or should be reset here too if needed.
      return;
    }

    const fetchData = async () => {
      setIsLoadingAggData(true); // Start loading indicator for Counts/Rates
      setAggDataError(null);
      setRawCountsData([]); // Clear previous raw data
      setRawRatesData([]); // Clear previous raw data

      try {
        const aggregatedData: CombinedPlayerStats =
          await fetchPlayerAggregatedStats(selectedPlayer.id);

        // Check if *any* data was returned before setting state
        if (
          aggregatedData.counts.length > 0 ||
          aggregatedData.rates.length > 0
        ) {
          setRawCountsData(aggregatedData.counts);
          setRawRatesData(aggregatedData.rates);
          // Let updateDisplayData effect handle setting display data
        } else {
          // Handle case where API returns success but empty arrays
          console.log(
            "No aggregated stats returned for player:",
            selectedPlayer.id
          );
          // Set error or message? Or let tables show "no data"?
          // setAggDataError("No aggregated statistics available."); // Optional: Set specific message
          setDisplayCountsData([]); // Ensure display is clear
          setDisplayRatesData([]); // Ensure display is clear
        }
      } catch (error) {
        console.error("Error fetching aggregated stats:", error);
        setAggDataError("Failed to load Counts/Rates statistics."); // Specific error
        setRawCountsData([]);
        setRawRatesData([]);
        setDisplayCountsData([]); // Ensure display is clear on error
        setDisplayRatesData([]); // Ensure display is clear on error
      } finally {
        setIsLoadingAggData(false); // Stop loading indicator for Counts/Rates
      }
    };

    fetchData();
  }, [selectedPlayer]); // Only depends on selectedPlayer

  // Effect to recalculate DIFF columns whenever raw data or timeframes change
  useEffect(() => {
    updateDisplayData();
  }, [updateDisplayData]); // updateDisplayData is memoized with its own dependencies

  // Handler for timeframe changes
  const handleTimeframeCompare = useCallback((left: string, right: string) => {
    setLeftTimeframe(left as keyof TableAggregateData);
    setRightTimeframe(right as keyof TableAggregateData);
  }, []); // No dependencies needed if it only sets state

  console.log("WigoCharts - selectedPlayer:", selectedPlayer);
  return (
    <div className={styles.wigoDashHeader}>
      <div className={styles.wigoHeader}>
        <span className={styles.spanColorBlue}>WiGO</span>
        {/* Use Unicode non-breaking space */}
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
              // CSS variables for dynamic team colors
              "--primary-color": teamColors.primaryColor,
              "--secondary-color": teamColors.secondaryColor,
              "--accent-color": teamColors.accentColor,
              "--alt-color": teamColors.altColor,
              "--jersey-color": teamColors.jerseyColor
            } as React.CSSProperties
          }
        >
          {/* Grid Items: Assign SCSS class for grid-area and styling */}

          {/* --- Top Row --- */}
          <div className={styles.nameSearchBarContainer}>
            <NameSearchBar onSelect={handlePlayerSelect} />
          </div>
          <div className={styles.timeframeComparisonWrapper}>
            <TimeframeComparison
              initialLeft={leftTimeframe}
              initialRight={rightTimeframe}
              onCompare={handleTimeframeCompare}
              // Disable if aggregated data is loading?
            />
          </div>

          <div className={styles.consistencyRatingContainer}>
            {selectedPlayer ? ( // <--- Is selectedPlayer definitely not null/undefined?
              <ConsistencyChart playerId={selectedPlayer.id} />
            ) : (
              <ChartLoadingPlaceholder message="Select a player" />
            )}
          </div>

          {/* --- Left Column --- */}
          <div className={styles.playerHeaderContainer}>
            {/* PlayerHeader component renders its own internals */}
            <PlayerHeader
              selectedPlayer={selectedPlayer}
              headshotUrl={headshotUrl}
              teamName={teamName}
              teamAbbreviation={teamAbbreviation}
              teamColors={teamColors} // Pass colors if needed internally, else rely on CSS vars
              placeholderImage={placeholderImage}
            />
          </div>
          <div className={styles.percentileChartContainer}>
            <CategoryCoverageChart
              playerId={selectedPlayer?.id}
              timeOption="L30"
            />
          </div>

          {/* <div className={styles.paceTableContainer}>
          Pace Table Placeholder
        </div> */}

          <div className={styles.rateStatBarPercentilesContainer}>
            <RateStatPercentiles playerId={selectedPlayer?.id} />
          </div>

          {/* --- Center Columns (Tables) --- */}
          <div className={styles.countsTableContainer}>
            {/* Pass loading/error state specific to aggregated data */}
            <StatsTable
              title="COUNTS" // Prop for table title row
              data={displayCountsData}
              isLoading={isLoadingAggData && displayCountsData.length === 0} // Show loading only if data is empty
              error={aggDataError}
              formatCell={formatCell}
              // Make sure StatsTable renders a <table className={styles.statsTableActual}>
            />
          </div>
          <div className={styles.ratesTableContainer}>
            <StatsTable
              title="RATES"
              data={displayRatesData}
              isLoading={isLoadingAggData && displayRatesData.length === 0}
              error={aggDataError}
              formatCell={formatCell}
              // Make sure StatsTable renders a <table className={styles.statsTableActual}>
            />
          </div>
          <div className={styles.perGameStatsContainer}>
            {/* PerGameStatsTable handles its own fetching, loading, error states */}
            <PerGameStatsTable
              playerId={selectedPlayer?.id}
              // Make sure PerGameStatsTable renders a <table className={styles.transposedTable}>
            />
          </div>

          {/* --- Right Column --- */}
          <div className={styles.ratingsContainer}>
            {/* Individual rating boxes are styled internally by the container rule */}
            <div className={styles.offenseRatingsContainer}>Off. Rating</div>
            <div className={styles.overallRatingsContainer}>Ovr. Rating</div>
            <div className={styles.defenseRatingsContainer}>Def. Rating</div>
          </div>

          <div className={styles.opponentLogContainer}>
            Opponent Log Placeholder
          </div>

          {/* --- Bottom Row (Charts) --- */}

          {/* --- TOI --- */}
          <div className={styles.toiChartContainer}>
            <ToiLineChart playerId={selectedPlayer?.id} />
          </div>

          {/* --- PTs/GP --- */}
          <div className={styles.ppgChartContainer}>
            <PpgLineChart playerId={selectedPlayer?.id} />
          </div>

          {/* --- Game Score ---  */}
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
