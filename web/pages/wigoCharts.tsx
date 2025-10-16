// /pages/wigoCharts.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react"; // Added useMemo
import dynamic from "next/dynamic";
import { useRouter } from "next/router";

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

// Simple viewport check; SSR-safe fallback to desktop
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
};

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
  const router = useRouter();
  const isMobile = useIsMobile();

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
    const t = router.query.tab;
    if (!t) return;
    const tab = Array.isArray(t) ? t[0] : t;
    if (validTabs.includes(tab as TabKey)) setActiveTab(tab as TabKey);
  }, [router.query.tab]);

  // Helper to update URL with tab (and keep playerId)
  const updateUrlWith = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const nextQuery = { ...router.query } as Record<string, any>;
      Object.entries(updates).forEach(([k, v]) => {
        if (v === undefined) delete nextQuery[k];
        else nextQuery[k] = v;
      });
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
        shallow: true
      });
    },
    [router]
  );

  // Handle player selection (remains the same)
  const handlePlayerSelect = useCallback(
    (player: Player, headshot: string) => {
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
      // Update the URL with the playerId as a query parameter
      updateUrlWith({ playerId: player.id });
    },
    [updateUrlWith]
  );

  // Auto-select player if playerId is present in the query
  useEffect(() => {
    const playerIdParam = router.query.playerId;
    if (!playerIdParam || selectedPlayer) return;
    // Only proceed if playerIdParam is a string and a valid number
    const playerId = Array.isArray(playerIdParam)
      ? playerIdParam[0]
      : playerIdParam;
    if (!playerId || isNaN(Number(playerId))) return;
    (async () => {
      try {
        const { data, error } = await (await import("lib/supabase")).default
          .from("players")
          .select("*")
          .eq("id", Number(playerId))
          .single();
        if (error || !data) return;
        let headshotUrl = data.image_url || "";
        if (!data.image_url) {
          try {
            const response = await fetch(
              `https://api-web.nhle.com/v1/player/${data.id}/landing`
            );
            if (response.ok) {
              const nhlData = await response.json();
              headshotUrl = nhlData.headshot || "";
            }
          } catch {}
        }
        handlePlayerSelect(data as Player, headshotUrl);
      } catch {}
    })();
  }, [router.query.playerId, selectedPlayer, handlePlayerSelect]);

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
                </>
              )}

              {activeTab === "trends" && (
                <>
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
                        timeOption="SEASON"
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
                </>
              )}

              {activeTab === "percentiles" && (
                <div className={styles.rateStatBarPercentilesContainer}>
                  <RateStatPercentiles
                    playerId={selectedPlayer?.id}
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
