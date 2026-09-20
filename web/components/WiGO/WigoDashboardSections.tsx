import React, { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";

import CategoryCoverageChart from "components/CategoryCoverageChart";
import OpponentGamelog from "components/WiGO/OpponentGamelog";
import PerGameStatsTable from "components/WiGO/PerGameStatsTable";
import PlayerHeader from "components/WiGO/PlayerHeader";
import { formatHeight, formatWeight, getAge, formatPosition } from "./playerBiography";
import PlayerRatingsDisplay from "components/WiGO/PlayerRatingsDisplay";
import NameSearchBar from "components/WiGO/NameSearchBar";
import RateStatPercentiles from "components/WiGO/RateStatPercentiles";
import WigoSectionCard from "./WigoSectionCard";
import WigoComparisonMatrix from "./WigoComparisonMatrix";
import StatsTable from "components/WiGO/StatsTable";
import TimeframeComparison from "components/WiGO/TimeframeComparison";
import TeamPerformanceDrivers from "components/WiGO/TeamPerformanceDrivers";
import { formatCell as formatCellUtil } from "components/WiGO/tableUtils";
import { Player, TableAggregateData, TeamColors } from "components/WiGO/types";
import styles from "styles/wigoCharts.module.scss";

const ChartLoadingPlaceholder = ({ message }: { message: string }) => (
  <div className={styles.chartLoadingPlaceholder}>{message}</div>
);

const GameScoreSection = dynamic(() => import("components/WiGO/GameScoreSection"), {
  ssr: false,
  loading: () => <ChartLoadingPlaceholder message="Loading Game Score…" />,
});

const ToiLineChart = dynamic(() => import("components/WiGO/ToiLineChart"), {
  ssr: false,
  loading: () => <ChartLoadingPlaceholder message="Loading TOI Chart..." />,
});

const PpgLineChart = dynamic(() => import("components/WiGO/PpgLineChart"), {
  ssr: false,
  loading: () => <ChartLoadingPlaceholder message="Loading PPG Chart..." />,
});

const ConsistencyChart = dynamic(
  () => import("components/WiGO/ConsistencyChart"),
  {
    ssr: false,
    loading: () => <ChartLoadingPlaceholder message="Loading Consistency..." />,
  },
);

interface WigoDashboardHeaderProps {
  onPlayerSelect: (player: Player, headshotUrl: string) => void;
  selectedPlayer: Player | null;
  headshotUrl: string | null;
  teamAbbreviation: string | null;
  onPlayerClear: () => void;
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
  desktop?: boolean;
}

interface WigoTrendsSectionProps {
  summaryOnly?: boolean;
  trendsOnly?: boolean;
  selectedPlayer: Player | null;
  currentSeasonId: number | null;
}

interface WigoPercentilesSectionProps {
  desktop?: boolean;
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
  desktop?: boolean;
}

const placeholderImage = "/pictures/player-placeholder.jpg";

function WigoPlayerIdentity({
  selectedPlayer,
  headshotUrl,
  teamName,
  teamAbbreviation,
  teamColors,
}: Pick<
  WigoOverviewSectionProps,
  | "selectedPlayer"
  | "headshotUrl"
  | "teamName"
  | "teamAbbreviation"
  | "teamColors"
>) {
  return (
    <>
      <div className={styles.playerIdentityCard}>
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
        {selectedPlayer ? (
          <div className={styles.playerIdentityCopy}>
            <span className={styles.playerTeam}>{teamName}</span>
            <h2 className={styles.playerName}>
              <span>{selectedPlayer.firstName}</span>
              {selectedPlayer.lastName}
            </h2>
            <span className={styles.playerRole}>
              {selectedPlayer.sweater_number
                ? `#${selectedPlayer.sweater_number} · `
                : ""}
              {formatPosition(selectedPlayer.position)}
              {teamAbbreviation ? ` · ${teamAbbreviation}` : ""}
            </span>
          </div>
        ) : (
          <div className={styles.chartLoadingPlaceholder}>Select a player</div>
        )}
      </div>
      {selectedPlayer ? (
        <div className={styles.playerMetaGrid}>
          <span>
            <small>Age</small>
            {getAge(selectedPlayer.birthDate)}
          </span>
          <span>
            <small>Height</small>
            {formatHeight(selectedPlayer.heightInCentimeters)}
          </span>
          <span>
            <small>Weight</small>
            {formatWeight(selectedPlayer.weightInKilograms)}
          </span>
          <span>
            <small>Position</small>
            {formatPosition(selectedPlayer.position)}
          </span>
        </div>
      ) : null}
    </>
  );
}

export function WigoDashboardHeader({
  onPlayerSelect,
  selectedPlayer,
  headshotUrl,
  teamAbbreviation,
  onPlayerClear,
}: WigoDashboardHeaderProps) {
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  return (
    <>
      <div className={styles.wigoContextIdentity}>
        <span className={styles.spanColorBlue}>WiGO</span>
        <span className={styles.wigoContextTagline}>What Is Going On</span>
      </div>
      <div className={styles.nameSearchBarContainer}>
        <NameSearchBar
          onSelect={onPlayerSelect}
          selectedPlayer={selectedPlayer}
        />
      </div>
      <div className={styles.selectedPlayerControl}>
        {selectedPlayer ? (
          <>
            <div className={styles.selectedPlayerThumb}>
              <Image
                src={headshotUrl && headshotUrl !== failedThumbnail ? headshotUrl : placeholderImage}
                onError={() => setFailedThumbnail(headshotUrl)}
                alt=""
                fill
                sizes="40px"
              />
            </div>
            <div className={styles.selectedPlayerText}>
              <strong>{selectedPlayer.fullName}</strong>
              <span>
                {teamAbbreviation || "NHL"} · {formatPosition(selectedPlayer.position)}
              </span>
            </div>
            <button type="button" onClick={onPlayerClear}>
              Clear
            </button>
          </>
        ) : (
          <span className={styles.noSelectedPlayer}>No player selected</span>
        )}
      </div>
      <div className={styles.wigoHeader} aria-hidden="true">
        <div className={styles.headerText}>
          Player research
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
  minGp,
  desktop = false,
}: WigoOverviewSectionProps) {
  return (
    <>
      <div className={styles.identitySummary} data-coverage="C02 C03"><WigoPlayerIdentity
        selectedPlayer={selectedPlayer}
        headshotUrl={headshotUrl}
        teamName={teamName}
        teamAbbreviation={teamAbbreviation}
        teamColors={teamColors}
      /></div>
      <div className={desktop ? styles.summaryProduction : styles.perGameStatsContainer}>
        <PerGameStatsTable
          playerId={selectedPlayer?.id}
          seasonId={currentSeasonId}
          desktop={desktop}
        />
      </div>
      <div className={styles.opponentLogContainer} data-coverage="C06">
        <OpponentGamelog
          teamId={teamIdForLog}
          seasonId={currentSeasonId}
          highlightColor={teamColors.primaryColor || "#07aae2"}
        />
      </div>
      <div className={styles.ratingsContainer} data-coverage="C07">
        {desktop ? <WigoSectionCard title="Player ratings" toolbar={<details className="wigo-chart-help"><summary aria-label="Player rating methodology and cohort">ⓘ</summary><p>Weighted percentile composites, using the existing {currentSeasonId} cohorts and minimum {minGp} GP. Overall All/Even combines offense and defense. Special combines PP offense and PK defense with ice-time weighting. Adjust the rate panel’s minimum GP to change the cohort.</p></details>}>
          <PlayerRatingsDisplay playerId={selectedPlayer?.id} seasonId={currentSeasonId} minGp={minGp} />
        </WigoSectionCard> : <>
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
        )}</>}
      </div>
      <div className={styles.teamDriversSummary} data-coverage="C08 C09 C10 C11"><TeamPerformanceDrivers
        teamId={teamIdForLog}
        teamAbbreviation={teamAbbreviation}
        seasonId={currentSeasonId}
      /></div>
    </>
  );
}

export function WigoTrendsSection({
  selectedPlayer,
  currentSeasonId,
  summaryOnly = false,
  trendsOnly = false,
}: WigoTrendsSectionProps) {
  return (
    <>
      {!trendsOnly && <div className={styles.consistencyAndCategoryWrapper}>
        <div className={styles.consistencyRatingContainer} data-coverage="C14">
          {selectedPlayer ? (
            <ConsistencyChart
              playerId={selectedPlayer.id}
              seasonId={currentSeasonId}
            />
          ) : (
            <ChartLoadingPlaceholder message="Select a player" />
          )}
        </div>
        <div className={styles.percentileChartContainer} data-coverage="C15">
          <div className={styles.chartTitle}>
            <h3 style={{ margin: 0 }}>Category percentiles</h3>
            {summaryOnly && <span className={styles.radarContext}>Skaters · {currentSeasonId ?? "Season unavailable"} · 0–100</span>}
          </div>
          <CategoryCoverageChart
            playerId={selectedPlayer?.id}
            compact={summaryOnly}
            timeOption="SEASON"
          />
        </div>
      </div>}
      {!summaryOnly && <><div className={styles.toiChartContainer} data-coverage="C16">
        <ToiLineChart
          playerId={selectedPlayer?.id}
          seasonId={currentSeasonId}
        />
      </div>
      <div className={styles.ppgChartContainer} data-coverage="C17">
        <PpgLineChart
          playerId={selectedPlayer?.id}
          seasonId={currentSeasonId}
        />
      </div>
      <div className={styles.gameScoreContainer} data-coverage="C18">
        <GameScoreSection
          playerId={selectedPlayer?.id}
          seasonId={currentSeasonId}
        />
      </div></>}
    </>
  );
}

export function WigoPercentilesSection({
  playerId,
  seasonId,
  minGp,
  onMinGpChange,
  desktop = false,
}: WigoPercentilesSectionProps) {
  return (
    <div className={styles.rateStatBarPercentilesContainer} data-coverage="C19">
      <RateStatPercentiles
        playerId={playerId}
        seasonId={seasonId}
        minGp={minGp}
        onMinGpChange={onMinGpChange}
        desktop={desktop}
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
  visibleColumns,
  desktop = false,
}: WigoComparisonSectionProps) {
  if (desktop) return <WigoComparisonMatrix {...{data, isLoadingAggData, aggDataError, playerId, currentSeasonId, leftTimeframe, rightTimeframe, onCompare}} />;
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
