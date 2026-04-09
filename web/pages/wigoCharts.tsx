// /pages/wigoCharts.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";

import styles from "styles/wigoCharts.module.scss"; // Main styles
import { TableAggregateData } from "components/WiGO/types";
import {
  WigoComparisonSection,
  WigoDashboardHeader,
  WigoOverviewSection,
  WigoPercentilesSection,
  WigoTrendsSection
} from "components/WiGO/WigoDashboardSections";
import useWigoPlayerDashboard from "hooks/useWigoPlayerDashboard";
import { computeDiffColumn } from "components/WiGO/tableUtils";

const WigoCharts: React.FC = () => {
  const [leftTimeframe, setLeftTimeframe] =
    useState<keyof TableAggregateData>("STD");
  const [rightTimeframe, setRightTimeframe] =
    useState<keyof TableAggregateData>("CA");
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
            <WigoDashboardHeader onPlayerSelect={handlePlayerSelect} />
          </div>

          {/* --- NEW: Left Column Wrapper (Direct Grid Child) --- */}
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
            />
          </div>

          {/* --- NEW: Middle Column Wrapper (Direct Grid Child) --- */}
          <div className={styles.middleColumnWrapper}>
            <WigoTrendsSection
              selectedPlayer={selectedPlayer}
              currentSeasonId={currentSeasonId}
            />
            <WigoPercentilesSection
              playerId={selectedPlayer?.id}
              seasonId={currentSeasonId}
              minGp={minGp}
              onMinGpChange={setMinGp}
            />
          </div>

          {/* --- NEW: Right Column Wrapper (Direct Grid Child) --- */}
          <div className={styles.rightColumnWrapper}>
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
            <WigoDashboardHeader onPlayerSelect={handlePlayerSelect} />
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
                visibleColumns={mobileVisibleColumns}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default WigoCharts;
