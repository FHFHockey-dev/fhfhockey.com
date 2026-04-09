// /pages/wigoCharts.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";

import styles from "styles/wigoCharts.module.scss"; // Main styles
import { TableAggregateData } from "components/WiGO/types";
import NameSearchBar from "components/WiGO/NameSearchBar";
import TimeframeComparison from "components/WiGO/TimeframeComparison";
import CategoryCoverageChart from "components/CategoryCoverageChart";
import GameScoreSection from "components/WiGO/GameScoreSection";
import PlayerHeader from "components/WiGO/PlayerHeader";
import StatsTable from "components/WiGO/StatsTable"; // The modified component
import PerGameStatsTable from "components/WiGO/PerGameStatsTable";
import RateStatPercentiles from "components/WiGO/RateStatPercentiles";
import OpponentGamelog from "components/WiGO/OpponentGamelog";
import PlayerRatingsDisplay from "components/WiGO/PlayerRatingsDisplay";
import useWigoPlayerDashboard from "hooks/useWigoPlayerDashboard";
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
  const [leftTimeframe, setLeftTimeframe] =
    useState<keyof TableAggregateData>("STD");
  const [rightTimeframe, setRightTimeframe] =
    useState<keyof TableAggregateData>("CA");
  const placeholderImage = "/pictures/player-placeholder.jpg";
  const [minGp, setMinGp] = useState<number>(10);

  const {
    selectedPlayer,
    headshotUrl,
    currentSeasonId,
    teamColors,
    teamName,
    teamAbbreviation,
    teamIdForLog,
    rawCombinedData,
    isLoadingAggData,
    aggDataError,
    handlePlayerSelect,
    updateUrlWith
  } = useWigoPlayerDashboard();
  type TabKey = "overview" | "trends" | "percentiles" | "comparison";
  const validTabs: TabKey[] = [
    "overview",
    "trends",
    "percentiles",
    "comparison"
  ];
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Sync tab from URL on mount/change
  useEffect(() => {
    const t = window.location.search
      ? new URLSearchParams(window.location.search).get("tab")
      : null;
    if (!t) return;
    if (validTabs.includes(t as TabKey)) setActiveTab(t as TabKey);
  }, []);

  useEffect(() => {
    setLeftTimeframe("STD");
    setRightTimeframe("CA");
  }, [selectedPlayer?.id]);

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

  // Visible columns for mobile table view
  const mobileVisibleColumns = useMemo(() => {
    return [leftTimeframe, rightTimeframe] as Array<keyof TableAggregateData>;
  }, [leftTimeframe, rightTimeframe]);

  // Tab button renderer
  const renderTabs = () => (
    <div className={styles.mobileTabsBar}>
      {validTabs.map((t) => (
        <button
          key={t}
          className={t === activeTab ? styles.activeTab : styles.tabBtn}
          onClick={() => {
            setActiveTab(t);
            updateUrlWith({ tab: t });
          }}
        >
          {t === "overview" && "Overview"}
          {t === "trends" && "Trends"}
          {t === "percentiles" && "Percentiles"}
          {t === "comparison" && "Comparison"}
        </button>
      ))}
    </div>
  );

  return (
    <div className={styles.wigoDashHeader}>
      <div className={styles.wigoDashboardContainer}>
        {/* Desktop/Grid view (hidden on mobile via CSS) */}
        <div
          className={styles.wigoDashboardContent}
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
              <PerGameStatsTable
                playerId={selectedPlayer?.id}
                seasonId={currentSeasonId}
              />
            </div>
            <div className={styles.opponentLogContainer}>
              <OpponentGamelog
                teamId={teamIdForLog}
                seasonId={currentSeasonId}
                highlightColor={teamColors.primaryColor || "#07aae2"}
              />
            </div>
            <div className={styles.ratingsContainer}>
              {selectedPlayer ? (
                <PlayerRatingsDisplay
                  playerId={selectedPlayer.id}
                  seasonId={currentSeasonId}
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
                  <ConsistencyChart
                    playerId={selectedPlayer.id}
                    seasonId={currentSeasonId}
                  />
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
              <ToiLineChart
                playerId={selectedPlayer?.id}
                seasonId={currentSeasonId}
              />
            </div>
            <div className={styles.ppgChartContainer}>
              <PpgLineChart
                playerId={selectedPlayer?.id}
                seasonId={currentSeasonId}
              />
            </div>
            <div className={styles.gameScoreContainer}>
              <GameScoreSection
                playerId={selectedPlayer?.id}
                seasonId={currentSeasonId}
              />
            </div>
            <div className={styles.rateStatBarPercentilesContainer}>
              <RateStatPercentiles
                playerId={selectedPlayer?.id}
                seasonId={currentSeasonId}
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
        </div>

        {/* Mobile/Tabbed view (hidden on desktop via CSS) */}
        <div
          className={styles.mobileContainer}
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
          <div className={styles.mobileHeaderRow}>
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

          {renderTabs()}

          <div className={styles.mobilePanel}>
            {activeTab === "overview" && (
              <>
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
                  <PerGameStatsTable
                    playerId={selectedPlayer?.id}
                    seasonId={currentSeasonId}
                  />
                </div>
                <div className={styles.opponentLogContainer}>
                  <OpponentGamelog
                    teamId={teamIdForLog}
                    seasonId={currentSeasonId}
                    highlightColor={teamColors.primaryColor || "#07aae2"}
                  />
                </div>
                <div className={styles.ratingsContainer}>
                  {selectedPlayer ? (
                    <PlayerRatingsDisplay
                      playerId={selectedPlayer.id}
                      seasonId={currentSeasonId}
                      minGp={minGp}
                    />
                  ) : (
                    <div className={styles.chartLoadingPlaceholder}>
                      Select player for ratings
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "trends" && (
              <>
                <div className={styles.consistencyAndCategoryWrapper}>
                  <div className={styles.consistencyRatingContainer}>
                    {selectedPlayer ? (
                      <ConsistencyChart
                        playerId={selectedPlayer.id}
                        seasonId={currentSeasonId}
                      />
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
                      timeOption="SEASON"
                    />
                  </div>
                </div>
                <div className={styles.toiChartContainer}>
                  <ToiLineChart
                    playerId={selectedPlayer?.id}
                    seasonId={currentSeasonId}
                  />
                </div>
                <div className={styles.ppgChartContainer}>
                  <PpgLineChart
                    playerId={selectedPlayer?.id}
                    seasonId={currentSeasonId}
                  />
                </div>
                <div className={styles.gameScoreContainer}>
                  <GameScoreSection
                    playerId={selectedPlayer?.id}
                    seasonId={currentSeasonId}
                  />
                </div>
              </>
            )}

            {activeTab === "percentiles" && (
              <div className={styles.rateStatBarPercentilesContainer}>
                <RateStatPercentiles
                  playerId={selectedPlayer?.id}
                  seasonId={currentSeasonId}
                  minGp={minGp}
                  onMinGpChange={setMinGp}
                />
              </div>
            )}

            {activeTab === "comparison" && (
              <div className={styles.timeframeComparisonWrapper}>
                <TimeframeComparison
                  initialLeft={leftTimeframe}
                  initialRight={rightTimeframe}
                  onCompare={handleTimeframeCompare}
                />
                <div className={styles.combinedStatsTableContainer}>
                  <StatsTable
                    data={displayDataWithDiff}
                    isLoading={
                      isLoadingAggData && displayDataWithDiff.length === 0
                    }
                    error={aggDataError}
                    formatCell={formatCellUtil}
                    playerId={selectedPlayer?.id ?? 0}
                    currentSeasonId={currentSeasonId ?? 0}
                    leftTimeframe={leftTimeframe}
                    rightTimeframe={rightTimeframe}
                    visibleColumns={mobileVisibleColumns as any}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default WigoCharts;
