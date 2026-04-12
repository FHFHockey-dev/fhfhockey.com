import React from "react";
import dynamic from "next/dynamic";

import CategoryCoverageChart from "components/CategoryCoverageChart";
import OpponentGamelog from "components/WiGO/OpponentGamelog";
import PerGameStatsTable from "components/WiGO/PerGameStatsTable";
import PlayerHeader from "components/WiGO/PlayerHeader";
import PlayerRatingsDisplay from "components/WiGO/PlayerRatingsDisplay";
import GameScoreSection from "components/WiGO/GameScoreSection";
import NameSearchBar from "components/WiGO/NameSearchBar";
import RateStatPercentiles from "components/WiGO/RateStatPercentiles";
import StatsTable from "components/WiGO/StatsTable";
import TimeframeComparison from "components/WiGO/TimeframeComparison";
import { formatCell as formatCellUtil } from "components/WiGO/tableUtils";
import { Player, TableAggregateData, TeamColors } from "components/WiGO/types";
import styles from "styles/wigoCharts.module.scss";

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

interface WigoDashboardHeaderProps {
  onPlayerSelect: (player: Player, headshotUrl: string) => void;
}

interface WigoOverviewSectionProps {
  selectedPlayer: Player | null;
  headshotUrl: string | null;
  teamName: string;
  teamAbbreviation: string | null;
  teamColors: TeamColors;
  teamIdForLog: number | null;
  currentSeasonId: number | null;
  minGp: number;
}

interface WigoTrendsSectionProps {
  selectedPlayer: Player | null;
  currentSeasonId: number | null;
}

interface WigoPercentilesSectionProps {
  playerId: number | undefined;
  seasonId: number | null;
  minGp: number;
  onMinGpChange: (minGp: number) => void;
}

interface WigoComparisonSectionProps {
  data: TableAggregateData[];
  isLoadingAggData: boolean;
  aggDataError: string | null;
  playerId: number | undefined;
  currentSeasonId: number | null;
  leftTimeframe: keyof TableAggregateData;
  rightTimeframe: keyof TableAggregateData;
  onCompare: (left: string, right: string) => void;
  visibleColumns?: Array<keyof TableAggregateData>;
}

const placeholderImage = "/pictures/player-placeholder.jpg";

function WigoPlayerIdentity({
  selectedPlayer,
  headshotUrl,
  teamName,
  teamAbbreviation,
  teamColors
}: Pick<
  WigoOverviewSectionProps,
  "selectedPlayer" | "headshotUrl" | "teamName" | "teamAbbreviation" | "teamColors"
>) {
  return (
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
          <div className={styles.chartLoadingPlaceholder}>Select a player</div>
        )}
      </div>
    </>
  );
}

export function WigoDashboardHeader({
  onPlayerSelect
}: WigoDashboardHeaderProps) {
  return (
    <>
      <div className={styles.nameSearchBarContainer}>
        <NameSearchBar onSelect={onPlayerSelect} />
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
    </>
  );
}

export function WigoOverviewSection({
  selectedPlayer,
  headshotUrl,
  teamName,
  teamAbbreviation,
  teamColors,
  teamIdForLog,
  currentSeasonId,
  minGp
}: WigoOverviewSectionProps) {
  return (
    <>
      <WigoPlayerIdentity
        selectedPlayer={selectedPlayer}
        headshotUrl={headshotUrl}
        teamName={teamName}
        teamAbbreviation={teamAbbreviation}
        teamColors={teamColors}
      />
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
  );
}

export function WigoTrendsSection({
  selectedPlayer,
  currentSeasonId
}: WigoTrendsSectionProps) {
  return (
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
        <ToiLineChart playerId={selectedPlayer?.id} seasonId={currentSeasonId} />
      </div>
      <div className={styles.ppgChartContainer}>
        <PpgLineChart playerId={selectedPlayer?.id} seasonId={currentSeasonId} />
      </div>
      <div className={styles.gameScoreContainer}>
        <GameScoreSection
          playerId={selectedPlayer?.id}
          seasonId={currentSeasonId}
        />
      </div>
    </>
  );
}

export function WigoPercentilesSection({
  playerId,
  seasonId,
  minGp,
  onMinGpChange
}: WigoPercentilesSectionProps) {
  return (
    <div className={styles.rateStatBarPercentilesContainer}>
      <RateStatPercentiles
        playerId={playerId}
        seasonId={seasonId}
        minGp={minGp}
        onMinGpChange={onMinGpChange}
      />
    </div>
  );
}

export function WigoComparisonSection({
  data,
  isLoadingAggData,
  aggDataError,
  playerId,
  currentSeasonId,
  leftTimeframe,
  rightTimeframe,
  onCompare,
  visibleColumns
}: WigoComparisonSectionProps) {
  return (
    <div className={styles.timeframeComparisonWrapper}>
      <TimeframeComparison
        initialLeft={leftTimeframe}
        initialRight={rightTimeframe}
        onCompare={onCompare}
      />
      <div className={styles.combinedStatsTableContainer}>
        <StatsTable
          data={data}
          isLoading={isLoadingAggData && data.length === 0}
          error={aggDataError}
          formatCell={formatCellUtil}
          playerId={playerId ?? 0}
          currentSeasonId={currentSeasonId ?? 0}
          leftTimeframe={leftTimeframe}
          rightTimeframe={rightTimeframe}
          visibleColumns={visibleColumns as any}
        />
      </div>
    </div>
  );
}
