// /pages/wigoCharts.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react"; // Added useMemo
import dynamic from "next/dynamic";

import styles from "styles/wigoCharts.module.scss"; // Main styles
import {
  Player,
  TeamColors,
  defaultColors,
  TableAggregateData
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
  computeDiffColumn,
  formatCell as formatCellUtil
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
  const [rawCombinedData, setRawCombinedData] = useState<TableAggregateData[]>(
    []
  );
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
    setRawCombinedData([]); // Clear combined raw data

    setAggDataError(null); // Clear error
  }, []);

  // Fetch aggregated data effect (Counts/Rates)
  useEffect(() => {
    if (!selectedPlayer) {
      setRawCombinedData([]);
      setAggDataError(null);
      return;
    }

    const fetchData = async () => {
      setIsLoadingAggData(true);
      setAggDataError(null);
      setRawCombinedData([]);

      try {
        // --- <<< CHANGE: Expect single array from fetch >>> ---
        const fetchedData: TableAggregateData[] =
          await fetchPlayerAggregatedStats(selectedPlayer.id);

        // Set raw data, let useMemo handle processing and combining
        setRawCombinedData(fetchedData);
        if (!fetchedData || fetchedData.length === 0) {
          console.log(
            "No aggregated stats returned for player:",
            selectedPlayer.id
          );
          // Optional: setAggDataError("No aggregated statistics available.");
        }
      } catch (error) {
        console.error("Error fetching aggregated stats:", error);
        setAggDataError("Failed to load Counts/Rates statistics.");
        setRawCombinedData([]);
      } finally {
        setIsLoadingAggData(false);
      }
    };

    fetchData();
  }, [selectedPlayer]);

  // --- <<< CHANGE: Calculate Display Data with DIFF using single raw state >>> ---
  const displayDataWithDiff = useMemo(() => {
    if (rawCombinedData.length === 0) {
      return []; // Return empty array if no raw data
    }
    return computeDiffColumn(rawCombinedData, leftTimeframe, rightTimeframe);
  }, [rawCombinedData, leftTimeframe, rightTimeframe]); // Dependencies

  // Handler for timeframe changes (remains the same)
  const handleTimeframeCompare = useCallback((left: string, right: string) => {
    setLeftTimeframe(left as keyof TableAggregateData);
    setRightTimeframe(right as keyof TableAggregateData);
  }, []);

  return (
    <div className={styles.wigoDashHeader}>
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
          {/* === Grid Items START === */}

          {/* --- Top Row Items (Direct Grid Children) --- */}
          {/* --- NEW: Header Row Wrapper (Direct Grid Child) --- */}
          <div className={styles.headerRowWrapper}>
            {/* Components within the header wrapper, arranged by flexbox */}
            <div className={styles.nameSearchBarContainer}>
              <NameSearchBar onSelect={handlePlayerSelect} />
            </div>
            <div className={styles.wigoHeader}>
              <div className={styles.headerText}>
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
            </div>
          </div>

          {/* --- NEW: Left Column Wrapper (Direct Grid Child) --- */}
          <div className={styles.leftColumnWrapper}>
            {/* Components within the left column */}
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
            <div className={styles.playerNameContainer}>
              {selectedPlayer ? (
                <h2 className={styles.playerName}>
                  <span className={styles.spanColorBlueName}>
                    {selectedPlayer.firstName}
                  </span>{" "}
                  {selectedPlayer.lastName}
                </h2>
              ) : (
                <div className={styles.chartLoadingPlaceholder}>
                  Select a player
                </div>
              )}
            </div>
            <div className={styles.perGameStatsContainer}>
              <PerGameStatsTable playerId={selectedPlayer?.id} />
            </div>
            <div className={styles.opponentLogContainer}>
              <OpponentGamelog
                teamId={teamIdForLog}
                highlightColor={teamColors.primaryColor || "#07aae2"}
              />
            </div>
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
          </div>

          {/* --- NEW: Middle Column Wrapper (Direct Grid Child) --- */}
          <div className={styles.middleColumnWrapper}>
            {/* Components within the middle column */}
            <div className={styles.consistencyAndCategoryWrapper}>
              <div className={styles.consistencyRatingContainer}>
                {selectedPlayer ? (
                  <ConsistencyChart playerId={selectedPlayer.id} />
                ) : (
                  <ChartLoadingPlaceholder message="Select a player" />
                )}
              </div>
              <div className={styles.percentileChartContainer}>
                <div className={styles.chartTitle}>
                  <h3 style={{ margin: 0 }}>Percentiles</h3>
                </div>
                <CategoryCoverageChart
                  playerId={selectedPlayer?.id}
                  timeOption="SEASON" // Or make dynamic if needed
                />
              </div>
            </div>
            <div className={styles.toiChartContainer}>
              <ToiLineChart playerId={selectedPlayer?.id} />
            </div>
            <div className={styles.ppgChartContainer}>
              <PpgLineChart playerId={selectedPlayer?.id} />
            </div>
            <div className={styles.gameScoreContainer}>
              <GameScoreSection playerId={selectedPlayer?.id} />
            </div>
            <div className={styles.rateStatBarPercentilesContainer}>
              <RateStatPercentiles
                playerId={selectedPlayer?.id}
                minGp={minGp}
                onMinGpChange={setMinGp}
              />
            </div>
          </div>

          {/* --- NEW: Right Column Wrapper (Direct Grid Child) --- */}
          <div className={styles.rightColumnWrapper}>
            {/* Components within the right column */}
            <div className={styles.timeframeComparisonWrapper}>
              <TimeframeComparison
                initialLeft={leftTimeframe}
                initialRight={rightTimeframe}
                onCompare={handleTimeframeCompare}
                // disabled={isLoadingAggData}
              />
              <div className={styles.combinedStatsTableContainer}>
                <StatsTable
                  data={displayDataWithDiff}
                  isLoading={
                    isLoadingAggData && displayDataWithDiff.length === 0
                  }
                  error={aggDataError}
                  formatCell={formatCellUtil} // Ensure this handles mixed types
                  playerId={selectedPlayer?.id ?? 0}
                  currentSeasonId={currentSeasonId ?? 0}
                  leftTimeframe={leftTimeframe}
                  rightTimeframe={rightTimeframe}
                />
              </div>
            </div>
          </div>

          {/* === Grid Items END === */}
        </div>{" "}
        {/* End .wigoDashboardContent */}
      </div>{" "}
      {/* End .wigoDashboardContainer */}
    </div> // End .wigoDashHeader
  );
};
export default WigoCharts;
