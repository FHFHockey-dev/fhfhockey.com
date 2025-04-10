// /pages/wigoCharts.tsx

import React, { useState, useEffect, useCallback } from "react";
import styles from "styles/wigoCharts.module.scss";
import {
  Player,
  TeamColors,
  defaultColors,
  TableAggregateData,
  CombinedPlayerStats
} from "components/WiGO/types";
import NameSearchBar from "components/WiGO/NameSearchBar"; // Corrected path
import { getTeamInfoById, teamNameToAbbreviationMap } from "lib/teamsInfo";
import { fetchPlayerAggregatedStats } from "utils/fetchWigoPlayerStats"; // Corrected path
import TimeframeComparison from "components/WiGO/TimeframeComparison"; // Corrected path
import CategoryCoverageChart from "components/CategoryCoverageChart"; // Keep if path is correct
import GameScoreSection from "components/WiGO/GameScoreSection"; // Import the new section component
import PlayerHeader from "components/WiGO/PlayerHeader"; // Import the new header component
import StatsTable from "components/WiGO/StatsTable"; // Import the new table component
import {
  computeDiffColumnForCounts,
  computeDiffColumnForRates,
  formatCell // Import utils
} from "components/WiGO/tableUtils"; // Corrected path

const WigoCharts: React.FC = () => {
  // State remains largely the same
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [teamColors, setTeamColors] = useState<TeamColors>(defaultColors);

  const [rawCountsData, setRawCountsData] = useState<TableAggregateData[]>([]); // Store raw data
  const [rawRatesData, setRawRatesData] = useState<TableAggregateData[]>([]); // Store raw data

  const [displayCountsData, setDisplayCountsData] = useState<
    TableAggregateData[]
  >([]); // Data with DIFF calculated
  const [displayRatesData, setDisplayRatesData] = useState<
    TableAggregateData[]
  >([]); // Data with DIFF calculated

  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [teamName, setTeamName] = useState<string>("");
  const [teamAbbreviation, setTeamAbbreviation] = useState<string | null>(null);

  // User's chosen timeframes for comparison
  const [leftTimeframe, setLeftTimeframe] =
    useState<keyof TableAggregateData>("STD");
  const [rightTimeframe, setRightTimeframe] =
    useState<keyof TableAggregateData>("CA");

  const placeholderImage = "/pictures/player-placeholder.jpg";

  // Handle player selection (remains the same)
  const handlePlayerSelect = (player: Player, headshot: string) => {
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
  };

  // Function to update display data based on selected timeframes
  // Use useCallback to memoize this function
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

  // Fetch data effect
  useEffect(() => {
    if (!selectedPlayer) {
      setRawCountsData([]);
      setRawRatesData([]);
      setDisplayCountsData([]); // Clear display data
      setDisplayRatesData([]); // Clear display data
      setDataError(null);
      setTeamName("");
      setTeamAbbreviation(null);
      setTeamColors(defaultColors);
      setHeadshotUrl(null);
      return;
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      setDataError(null);
      setRawCountsData([]); // Clear previous raw data
      setRawRatesData([]); // Clear previous raw data

      try {
        const aggregatedData: CombinedPlayerStats =
          await fetchPlayerAggregatedStats(selectedPlayer.id);

        if (
          aggregatedData.counts.length === 0 &&
          aggregatedData.rates.length === 0
        ) {
          setDataError("No statistics available for the selected player.");
          setRawCountsData([]);
          setRawRatesData([]);
        } else {
          // Set the raw data first
          setRawCountsData(aggregatedData.counts);
          setRawRatesData(aggregatedData.rates);
        }
      } catch (error) {
        console.error("Error fetching aggregated stats:", error);
        setDataError("Failed to load player statistics.");
        setRawCountsData([]);
        setRawRatesData([]);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [selectedPlayer]); // Only depends on selectedPlayer

  // Effect to recalculate DIFF columns when raw data or timeframes change
  useEffect(() => {
    updateDisplayData();
  }, [updateDisplayData]); // Dependency is the memoized function

  // Handler for timeframe changes
  const handleTimeframeCompare = (left: string, right: string) => {
    // Update the state for selected timeframes
    setLeftTimeframe(left as keyof TableAggregateData);
    setRightTimeframe(right as keyof TableAggregateData);
    // The updateDisplayData effect will automatically recalculate
  };

  // Render
  return (
    <div className={styles.wigoChartBorder}>
      <div
        className={styles.wigoChart}
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
        {/* Name Search Bar */}
        <div className={styles.nameSearchBar}>
          <NameSearchBar onSelect={handlePlayerSelect} />
          {selectedPlayer ? (
            <span className={styles.selectedPlayerName}>
              {selectedPlayer.fullName}
            </span>
          ) : (
            <span>Search Player...</span> // Modified placeholder text
          )}
        </div>

        {/* Player Headshot / Team Logo Section - Use Component */}
        <PlayerHeader
          selectedPlayer={selectedPlayer}
          headshotUrl={headshotUrl}
          teamName={teamName}
          teamAbbreviation={teamAbbreviation}
          teamColors={teamColors}
          placeholderImage={placeholderImage}
        />

        {/* Offense / Defense / Per-Game / Opponent / Consistency ... */}
        <div className={styles.offenseRatings}>Offense Rating</div>
        <div className={styles.overallRatings}>Overall Rating</div>
        <div className={styles.defenseRatings}>Defense Rating</div>
        <div className={styles.perGameStats}>Per Game Stats</div>
        <div className={styles.opponentLog}>Opponent Game Log</div>
        <div className={styles.consistencyRating}>Consistency Rating</div>

        {/* Timeframe Comparison */}
        <div className={styles.timeframeComparison}>
          {/* Pass default/current values and the handler */}
          <TimeframeComparison
            initialLeft={leftTimeframe}
            initialRight={rightTimeframe}
            onCompare={handleTimeframeCompare}
          />
        </div>

        {/* Counts Table - Use Component */}
        <StatsTable
          title="COUNTS"
          data={displayCountsData}
          isLoading={isLoadingData && displayCountsData.length === 0} // Show loading only if data isn't there yet
          error={dataError}
          formatCell={formatCell} // Pass the imported utility function
        />

        {/* Rates Table - Use Component */}
        <StatsTable
          title="RATES"
          data={displayRatesData}
          isLoading={isLoadingData && displayRatesData.length === 0}
          error={dataError}
          formatCell={formatCell} // Pass the imported utility function
        />

        {/* The rest of your layout sections */}
        <div className={styles.paceTable}>Pace Table</div>
        <div className={styles.toiLineChart}>Time On Ice Line Chart</div>
        <div className={styles.ppgLineChart}>Point Per Game Line Chart</div>

        {/* Game Score - Use Section Component */}
        <GameScoreSection playerId={selectedPlayer?.id} />

        <div className={styles.rateStatBarPercentiles}>
          Rate Stat Bar Percentiles
        </div>

        {/* Ensure CategoryCoverageChart path is correct if it's not in components/WiGO */}
        <div className={styles.percentileChart}>
          <CategoryCoverageChart
            playerId={selectedPlayer?.id}
            timeOption="L30" // Example, adjust as needed
          />
        </div>
      </div>
    </div>
  );
};

export default WigoCharts;
