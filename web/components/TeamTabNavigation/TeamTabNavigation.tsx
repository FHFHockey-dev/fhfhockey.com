import React, { useState } from "react";
import styles from "./TeamTabNavigation.module.scss";
import { TeamDashboard } from "../TeamDashboard/TeamDashboard";
import { GameStateAnalysis } from "../GameStateAnalysis/GameStateAnalysis";
import MetricsTimeline from "../MetricsTimeline/MetricsTimeline";
import RosterMatrixWrapper from "../RosterMatrix/RosterMatrixWrapper";
import { ShotVisualization } from "../ShotVisualization/ShotVisualization";
import { ShotDataFilters } from "../../hooks/useShotData";
import { LineCombinationsGrid } from "../LineCombinations/LineCombinationsGrid";
import { teamsInfo } from "../../lib/teamsInfo";
import { TeamScheduleCalendar } from "../TeamScheduleCalendar/TeamScheduleCalendar";
import { useTeamSchedule } from "hooks/useTeamSchedule";

// Define ShotData interface
interface ShotData {
  xcoord: number;
  ycoord: number;
  typedesckey: string;
}

interface TeamTabNavigationProps {
  teamId: string;
  teamAbbrev: string;
  seasonId: string;
  currentSeason?: { seasonId: number };
  shotData?: ShotData[];
  opponentShotData?: ShotData[];
  isLoadingShotData?: boolean;
  shotError?: Error | null;
  filters: ShotDataFilters;
  onFilterChange: (filters: ShotDataFilters) => void;
  // New props for stats tab
  summaries?: any[];
  lineCombos?: {
    forwards: string[];
    defensemen: string[];
    goalies: string[];
  } | null;
  lineCombosLoading?: boolean;
  lineCombosError?: string | null;
  playerMap?: Record<string, any>;
  playerMapLoading?: boolean;
  playerMapError?: string | null;
  showAllSeasons?: boolean;
  onToggleAllSeasons?: () => void;
}

type TabKey =
  | "dashboard"
  | "stats"
  | "analysis"
  | "timeline"
  | "roster"
  | "visualization"
  | "schedule";

interface Tab {
  key: TabKey;
  label: string;
  description: string;
}

const TABS: Tab[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Team overview and key metrics"
  },
  {
    key: "schedule",
    label: "Schedule",
    description: "Team schedule and upcoming games"
  },
  {
    key: "stats",
    label: "Season Stats",
    description: "Historical stats and line combinations"
  },
  {
    key: "analysis",
    label: "Game State",
    description: "Situational performance analysis"
  },
  {
    key: "timeline",
    label: "Timeline",
    description: "Performance metrics over time"
  },
  {
    key: "roster",
    label: "Roster",
    description: "Player roster and statistics"
  },
  {
    key: "visualization",
    label: "Shot Map",
    description: "Event visualization and shot maps"
  }
];

export function TeamTabNavigation({
  teamId,
  teamAbbrev,
  seasonId,
  currentSeason,
  shotData = [],
  opponentShotData = [],
  isLoadingShotData = false,
  shotError,
  filters,
  onFilterChange,
  summaries = [],
  lineCombos,
  lineCombosLoading = false,
  lineCombosError,
  playerMap = {},
  playerMapLoading = false,
  playerMapError,
  showAllSeasons = false,
  onToggleAllSeasons
}: TeamTabNavigationProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  const teamInfo = teamsInfo[teamAbbrev];

  // Fetch team schedule data with corrected parameters
  const {
    games,
    loading: scheduleLoading,
    error: scheduleError,
    record
  } = useTeamSchedule(teamAbbrev, seasonId, teamId);

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <TeamDashboard
            teamId={teamId}
            teamAbbrev={teamAbbrev}
            seasonId={seasonId}
          />
        );

      case "schedule":
        return (
          <TeamScheduleCalendar
            games={games}
            teamId={parseInt(teamId, 10)}
            teamAbbreviation={teamAbbrev}
            seasonId={seasonId}
            loading={scheduleLoading}
            error={scheduleError}
            record={record}
          />
        );

      case "stats":
        return (
          <div className={styles.statsContent}>
            <div className={styles.teamStatsTopRow}>
              <div className={styles.seasonStatsColumn}>
                <div className={styles.seasonStatsHeaderLeft}>Season Stats</div>
                <div className={styles.teamStatsTableContainer}>
                  <table className={styles.teamStatsTable}>
                    <thead>
                      <tr>
                        <th>Season</th>
                        <th>GP</th>
                        <th>W</th>
                        <th>L</th>
                        <th>OTL</th>
                        <th>PTS</th>
                        <th>PTS%</th>
                        <th>ROW</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>GF/GP</th>
                        <th>GA/GP</th>
                        <th>SF/GP</th>
                        <th>SA/GP</th>
                        <th>FO%</th>
                        <th>PP%</th>
                        <th>PK%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllSeasons
                        ? summaries
                        : summaries.slice(0, 10)
                      ).map((row, idx) => (
                        <tr key={idx}>
                          <td>
                            {row.season_id
                              ? `${row.season_id.toString().slice(0, 4)}-${row.season_id.toString().slice(4)}`
                              : "-"}
                          </td>
                          <td>{row.games_played ?? "-"}</td>
                          <td>{row.wins ?? "-"}</td>
                          <td>{row.losses ?? "-"}</td>
                          <td>{row.ot_losses ?? "-"}</td>
                          <td>{row.points ?? "-"}</td>
                          <td>
                            {row.point_pct
                              ? `${(row.point_pct * 100).toFixed(1)}%`
                              : "-"}
                          </td>
                          <td>{row.regulation_and_ot_wins ?? "-"}</td>
                          <td>{row.goals_for ?? "-"}</td>
                          <td>{row.goals_against ?? "-"}</td>
                          <td>{row.goals_for_per_game?.toFixed(2) ?? "-"}</td>
                          <td>
                            {row.goals_against_per_game?.toFixed(2) ?? "-"}
                          </td>
                          <td>{row.shots_for_per_game?.toFixed(1) ?? "-"}</td>
                          <td>
                            {row.shots_against_per_game?.toFixed(1) ?? "-"}
                          </td>
                          <td>
                            {row.faceoff_win_pct
                              ? `${(row.faceoff_win_pct * 100).toFixed(1)}%`
                              : "-"}
                          </td>
                          <td>
                            {row.power_play_pct
                              ? `${(row.power_play_pct * 100).toFixed(1)}%`
                              : "-"}
                          </td>
                          <td>
                            {row.penalty_kill_pct
                              ? `${(row.penalty_kill_pct * 100).toFixed(1)}%`
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summaries.length > 10 && (
                    <div className={styles.showMoreSeasonsButtonContainer}>
                      <button
                        className={styles.showMoreSeasonsButton}
                        onClick={onToggleAllSeasons}
                      >
                        {showAllSeasons
                          ? "Show Fewer Seasons"
                          : `Show All (${summaries.length}) Seasons`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.lineCombinationsColumn}>
                <div className={styles.seasonStatsHeaderRight}>
                  Line Combinations
                </div>
                <div
                  className={`${styles.lineCombinations} ${styles.lineCombinationsFixedHeight}`}
                >
                  {lineCombosLoading || playerMapLoading ? (
                    <div>Loading...</div>
                  ) : null}
                  {lineCombosError && (
                    <div style={{ color: "red" }}>{lineCombosError}</div>
                  )}
                  {playerMapError && (
                    <div style={{ color: "red" }}>{playerMapError}</div>
                  )}
                  {!lineCombosLoading &&
                    !playerMapLoading &&
                    !lineCombosError &&
                    !playerMapError &&
                    lineCombos && (
                      <LineCombinationsGrid
                        forwards={lineCombos.forwards}
                        defensemen={lineCombos.defensemen}
                        goalies={lineCombos.goalies}
                        playerMap={playerMap}
                        cardClassName={styles.lineCombinationsCard}
                      />
                    )}
                  {!lineCombosLoading &&
                    !playerMapLoading &&
                    !lineCombosError &&
                    !playerMapError &&
                    !lineCombos && <div>No line combinations found.</div>}
                </div>
              </div>
            </div>
          </div>
        );

      case "analysis":
        return (
          <GameStateAnalysis
            teamId={teamId}
            teamAbbrev={teamAbbrev}
            seasonId={seasonId}
          />
        );

      case "timeline":
        return (
          <MetricsTimeline
            teamId={teamId}
            teamAbbrev={teamAbbrev}
            seasonId={seasonId}
          />
        );

      case "roster":
        return (
          <RosterMatrixWrapper
            teamId={teamId}
            teamAbbrev={teamAbbrev}
            seasonId={seasonId}
          />
        );

      case "visualization":
        return (
          <div className={styles.visualizationContent}>
            <div className={styles.sectionHeader}>
              <h3>Event Visualization</h3>
              <p>
                Event data for the {currentSeason?.seasonId} season. Use the
                filters to select event types and game types to display.
              </p>
            </div>
            <div className={styles.shotVisualizationContainer}>
              <ShotVisualization
                shotData={shotData}
                opponentShotData={opponentShotData}
                isLoading={isLoadingShotData}
                onFilterChange={onFilterChange}
                filters={filters}
                teamAbbreviation={teamAbbrev}
                alwaysShowOpponentLegend={true}
              />
            </div>
            {shotError && (
              <div className={styles.errorMessage}>
                Error loading event data: {shotError.message}
              </div>
            )}
          </div>
        );

      default:
        return <div>Tab content not found</div>;
    }
  };

  return (
    <>
      {/* Tab Navigation */}
      <div
        className={styles.tabNavigation}
        style={
          {
            "--team-primary-color": teamInfo?.primaryColor || "#1976d2",
            "--team-secondary-color": teamInfo?.secondaryColor || "#424242",
            "--team-jersey-color": teamInfo?.jersey || "#ffffff",
            "--team-accent-color": teamInfo?.accent || "#ff9800"
          } as React.CSSProperties
        }
      >
        <div className={styles.tabList}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`${styles.tabButton} ${
                activeTab === tab.key ? styles.active : ""
              }`}
              title={tab.description}
            >
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabDescription}>{tab.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>{renderTabContent()}</div>
    </>
  );
}
