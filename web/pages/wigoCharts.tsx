import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";

import styles from "styles/wigoCharts.module.scss";
import { TableAggregateData } from "components/WiGO/types";
import {
  WigoComparisonSection,
  WigoDashboardHeader,
  WigoOverviewSection,
  WigoPercentilesSection,
  WigoTrendsSection,
} from "components/WiGO/WigoDashboardSections";
import useWigoPlayerDashboard from "hooks/useWigoPlayerDashboard";
import { computeDiffColumn } from "components/WiGO/tableUtils";

type TabKey = "overview" | "trends" | "percentiles" | "comparison";
const VALID_TABS: TabKey[] = [
  "overview",
  "trends",
  "percentiles",
  "comparison",
];

const WigoCharts: React.FC = () => {
  const router = useRouter();
  const [leftTimeframe, setLeftTimeframe] =
    useState<keyof TableAggregateData>("STD");
  const [rightTimeframe, setRightTimeframe] =
    useState<keyof TableAggregateData>("CA");
  const [minGp, setMinGp] = useState<number>(10);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const wideDesktop = (viewportWidth ?? 0) >= 1600;

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
    playerDataError,
    handlePlayerSelect,
    updateUrlWith,
  } = useWigoPlayerDashboard();
  const tab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
  const activeTab: TabKey = VALID_TABS.includes(tab as TabKey) ? tab as TabKey : "overview";

  useEffect(() => {
    setLeftTimeframe("STD");
    setRightTimeframe("CA");
  }, [selectedPlayer?.id]);

  const displayDataWithDiff = useMemo(() => {
    if (rawCombinedData.length === 0) {
      return []; // Return empty array if no raw data
    }
    return computeDiffColumn(rawCombinedData, leftTimeframe, rightTimeframe);
  }, [rawCombinedData, leftTimeframe, rightTimeframe]); // Dependencies

  const handleTimeframeCompare = useCallback((left: string, right: string) => {
    setLeftTimeframe(left as keyof TableAggregateData);
    setRightTimeframe(right as keyof TableAggregateData);
  }, []);

  const handlePlayerClear = useCallback(() => {
    void updateUrlWith({ playerId: undefined });
    document.getElementById("wigo-player-search")?.focus();
  }, [updateUrlWith]);

  const renderTabs = () => (
    <div className={styles.mobileTabsBar}>
      {VALID_TABS.map((t) => (
        <button
          key={t}
          className={t === activeTab ? styles.activeTab : styles.tabBtn}
          onClick={() => {
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
        {playerDataError && <p role="alert">{playerDataError}</p>}
        {viewportWidth !== null && viewportWidth > 768 && <div
          className={styles.wigoDashboardContent}
          style={
            {
              "--primary-color": teamColors.primaryColor,
              "--secondary-color": teamColors.secondaryColor,
              "--accent-color": teamColors.accentColor,
              "--alt-color": teamColors.altColor,
              "--jersey-color": teamColors.jerseyColor,
            } as React.CSSProperties
          }
        >
          <div className={styles.headerRowWrapper} data-coverage="C01">
            <WigoDashboardHeader
              onPlayerSelect={handlePlayerSelect}
              selectedPlayer={selectedPlayer}
              headshotUrl={headshotUrl}
              teamAbbreviation={teamAbbreviation}
              onPlayerClear={handlePlayerClear}
            />
          </div>

          <div className={styles.leftColumnWrapper}>
            <WigoOverviewSection
              selectedPlayer={selectedPlayer}
              headshotUrl={headshotUrl}
              teamName={teamName}
              teamAbbreviation={teamAbbreviation}
              teamColors={teamColors}
              teamIdForLog={teamIdForLog}
              currentSeasonId={currentSeasonId}
              minGp={minGp}
              desktop={wideDesktop}
            />
            {wideDesktop && <WigoTrendsSection selectedPlayer={selectedPlayer} currentSeasonId={currentSeasonId} summaryOnly />}
          </div>

          <div className={styles.comparisonColumnWrapper}>
            <WigoComparisonSection
              data={displayDataWithDiff}
              isLoadingAggData={isLoadingAggData}
              aggDataError={aggDataError}
              playerId={selectedPlayer?.id}
              currentSeasonId={currentSeasonId}
              leftTimeframe={leftTimeframe}
              rightTimeframe={rightTimeframe}
              onCompare={handleTimeframeCompare}
              desktop={wideDesktop}
            />
          </div>

          <div className={styles.trendsColumnWrapper}>
            <WigoTrendsSection
              selectedPlayer={selectedPlayer}
              currentSeasonId={currentSeasonId}
              trendsOnly={wideDesktop}
            />
            {!wideDesktop && <WigoPercentilesSection playerId={selectedPlayer?.id} seasonId={currentSeasonId} minGp={minGp} onMinGpChange={setMinGp} />}
          </div>
          {wideDesktop && <div className={styles.percentilesBand}>
            <WigoPercentilesSection
              playerId={selectedPlayer?.id}
              seasonId={currentSeasonId}
              minGp={minGp}
              onMinGpChange={setMinGp}
              desktop
            />
          </div>}

        </div>}

        {viewportWidth !== null && viewportWidth <= 768 && <div
          className={styles.mobileContainer}
          style={
            {
              "--primary-color": teamColors.primaryColor,
              "--secondary-color": teamColors.secondaryColor,
              "--accent-color": teamColors.accentColor,
              "--alt-color": teamColors.altColor,
              "--jersey-color": teamColors.jerseyColor,
            } as React.CSSProperties
          }
        >
          <div className={styles.mobileHeaderRow}>
            <WigoDashboardHeader
              onPlayerSelect={handlePlayerSelect}
              selectedPlayer={selectedPlayer}
              headshotUrl={headshotUrl}
              teamAbbreviation={teamAbbreviation}
              onPlayerClear={handlePlayerClear}
            />
          </div>

          {renderTabs()}

          <div className={styles.mobilePanel}>
            {activeTab === "overview" && (
              <WigoOverviewSection
                selectedPlayer={selectedPlayer}
                headshotUrl={headshotUrl}
                teamName={teamName}
                teamAbbreviation={teamAbbreviation}
                teamColors={teamColors}
                teamIdForLog={teamIdForLog}
                currentSeasonId={currentSeasonId}
                minGp={minGp}
              />
            )}

            {activeTab === "trends" && (
              <WigoTrendsSection
                selectedPlayer={selectedPlayer}
                currentSeasonId={currentSeasonId}
              />
            )}

            {activeTab === "percentiles" && (
              <WigoPercentilesSection
                playerId={selectedPlayer?.id}
                seasonId={currentSeasonId}
                minGp={minGp}
                onMinGpChange={setMinGp}
              />
            )}

            {activeTab === "comparison" && (
              <WigoComparisonSection
                data={displayDataWithDiff}
                isLoadingAggData={isLoadingAggData}
                aggDataError={aggDataError}
                playerId={selectedPlayer?.id}
                currentSeasonId={currentSeasonId}
                leftTimeframe={leftTimeframe}
                rightTimeframe={rightTimeframe}
                onCompare={handleTimeframeCompare}
              />
            )}
          </div>
        </div>}
      </div>
    </div>
  );
};
export default WigoCharts;
