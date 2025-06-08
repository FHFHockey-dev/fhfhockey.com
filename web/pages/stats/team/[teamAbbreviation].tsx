import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import { formatPercent, formatSeason } from "../../../utils/stats/formatters";
import styles from "styles/TeamStatsPage.module.scss";
import React, { useEffect, useState, useRef } from "react";
import useCurrentSeason from "hooks/useCurrentSeason";
import { useShotData, ShotDataFilters } from "hooks/useShotData";
import { ShotVisualization } from "components/ShotVisualization/ShotVisualization";
import { teamsInfo } from "lib/teamsInfo";
import { LineCombinationsGrid } from "components/LineCombinations/LineCombinationsGrid";
import { TeamDashboard } from "components/TeamDashboard/TeamDashboard";
import { GameStateAnalysis } from "components/GameStateAnalysis/GameStateAnalysis";
import RosterMatrixWrapper from "components/RosterMatrix/RosterMatrixWrapper";
import MetricsTimeline from "components/MetricsTimeline/MetricsTimeline";

// Shot data interface
interface ShotData {
  xcoord: number;
  ycoord: number;
  typedesckey: string; // 'goal' or 'shot'
}

interface TeamSeasonSummary {
  season_id: number;
  team_id: number;
  team_full_name: string;
  games_played: number;
  wins: number;
  losses: number;
  ot_losses: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goals_for_per_game: number;
  goals_against_per_game: number;
  shots_for_per_game: number;
  shots_against_per_game: number;
  faceoff_win_pct: number;
  penalty_kill_pct: number;
  power_play_pct: number;
  regulation_and_ot_wins: number;
  point_pct: number;
}

interface TeamColors {
  primary: string;
  secondary: string;
  jersey: string;
  accent: string;
  alt: string;
}

export default function TeamStatsPage({
  teamName,
  summaries,
  teamAbbreviation,
  teamColors
}: {
  teamName: string;
  summaries: TeamSeasonSummary[];
  teamAbbreviation: string;
  teamColors: TeamColors | null;
}) {
  const currentSeason = useCurrentSeason();
  const teamId = summaries[0]?.team_id;

  // State for event and game type filters
  const [filters, setFilters] = useState<ShotDataFilters>({
    eventTypes: ["goal", "shot-on-goal"],
    gameTypes: ["02"] // Regular season by default
  });

  // State for line combinations
  const [lineCombos, setLineCombos] = useState<{
    forwards: string[];
    defensemen: string[];
    goalies: string[];
  } | null>(null);
  const [lineCombosLoading, setLineCombosLoading] = useState(false);
  const [lineCombosError, setLineCombosError] = useState<string | null>(null);

  // State for player info map
  const [playerMap, setPlayerMap] = useState<Record<string, any>>({});
  const [playerMapLoading, setPlayerMapLoading] = useState(false);
  const [playerMapError, setPlayerMapError] = useState<string | null>(null);

  // Add refs for table and line combinations
  const tableRef = useRef<HTMLTableElement>(null);
  const lineCombinationsRef = useRef<HTMLDivElement>(null);
  const [fixedLineCombosHeight, setFixedLineCombosHeight] = useState<
    number | null
  >(null);

  // On initial mount, set the fixed height for line combinations
  useEffect(() => {
    if (tableRef.current && fixedLineCombosHeight === null) {
      setFixedLineCombosHeight(tableRef.current.offsetHeight);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!teamId) return;
    setLineCombosLoading(true);
    setLineCombosError(null);
    supabase
      .from("lineCombinations")
      .select("forwards,defensemen,goalies,gameId")
      .eq("teamId", teamId)
      .order("gameId", { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          setLineCombosError(error.message);
          setLineCombos(null);
        } else if (data && data.length > 0) {
          setLineCombos({
            forwards: (data[0].forwards || []).map(String),
            defensemen: (data[0].defensemen || []).map(String),
            goalies: (data[0].goalies || []).map(String)
          });
        } else {
          setLineCombos(null);
        }
        setLineCombosLoading(false);
      });
  }, [teamId]);

  // Fetch player info for all unique player IDs in the lineCombos
  useEffect(() => {
    if (!lineCombos) return;
    const allIds = [
      ...lineCombos.forwards,
      ...lineCombos.defensemen,
      ...lineCombos.goalies
    ].filter(Boolean);
    const uniqueIds = Array.from(new Set(allIds));
    if (uniqueIds.length === 0) return;
    setPlayerMapLoading(true);
    setPlayerMapError(null);
    supabase
      .from("yahoo_nhl_player_map")
      .select(
        "nhl_player_id, nhl_player_name, mapped_position, eligible_positions"
      )
      .in("nhl_player_id", uniqueIds)
      .then(({ data, error }) => {
        if (error) {
          setPlayerMapError(error.message);
          setPlayerMap({});
        } else if (data) {
          const map: Record<string, any> = {};
          data.forEach((row) => {
            if (row.nhl_player_id != null) {
              map[row.nhl_player_id] = row;
            }
          });
          setPlayerMap(map);
        }
        setPlayerMapLoading(false);
      });
  }, [lineCombos]);

  // Show more/less for stats table
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const displayedSummaries = showAllSeasons
    ? summaries
    : summaries.slice(0, 10);

  // Use our custom hook to fetch shot data with filters
  const { shotData, opponentShotData, isLoading, error } = useShotData(
    teamId,
    currentSeason?.seasonId.toString(),
    filters
  );

  // Handle filter changes from the visualization component
  const handleFilterChange = (newFilters: ShotDataFilters) => {
    setFilters(newFilters);
  };

  return (
    <div
      className={
        styles.teamStatsPageContainer +
        (teamColors ? " " + styles.hasTeamColors : "")
      }
      style={
        teamColors
          ? ({
              // These CSS variables are still set inline for dynamic theming
              "--primary-color": teamColors.primary,
              "--secondary-color": teamColors.secondary,
              "--jersey": teamColors.jersey,
              "--accent": teamColors.accent,
              "--alt": teamColors.alt
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className={styles.teamHeader}>
        <div className={styles.teamLogoContainer}>
          <img
            src={`/teamLogos/${teamAbbreviation}.png`}
            alt={teamAbbreviation}
            className={styles.teamLogo}
          />
          <h2 className={styles.teamName}>{teamName}</h2>
        </div>
      </div>
      <div className={styles.teamStatsTopRow}>
        <div className={styles.seasonStatsColumn}>
          <div className={styles.seasonStatsHeaderLeft}>Season Stats</div>
          <div className={styles.teamStatsTableContainer}>
            <table className={styles.teamStatsTable} ref={tableRef}>
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
                {displayedSummaries.map((row, idx) => (
                  <tr key={idx}>
                    <td>{formatSeason(row.season_id)}</td>
                    <td>{row.games_played ?? "-"}</td>
                    <td>{row.wins ?? "-"}</td>
                    <td>{row.losses ?? "-"}</td>
                    <td>{row.ot_losses ?? "-"}</td>
                    <td>{row.points ?? "-"}</td>
                    <td>{formatPercent(row.point_pct)}</td>
                    <td>{row.regulation_and_ot_wins ?? "-"}</td>
                    <td>{row.goals_for ?? "-"}</td>
                    <td>{row.goals_against ?? "-"}</td>
                    <td>{row.goals_for_per_game?.toFixed(2) ?? "-"}</td>
                    <td>{row.goals_against_per_game?.toFixed(2) ?? "-"}</td>
                    <td>{row.shots_for_per_game?.toFixed(1) ?? "-"}</td>
                    <td>{row.shots_against_per_game?.toFixed(1) ?? "-"}</td>
                    <td>{formatPercent(row.faceoff_win_pct)}</td>
                    <td>{formatPercent(row.power_play_pct)}</td>
                    <td>{formatPercent(row.penalty_kill_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summaries.length > 10 && (
              <div className={styles.showMoreSeasonsButtonContainer}>
                <button
                  className={styles.showMoreSeasonsButton}
                  onClick={() => setShowAllSeasons((v) => !v)}
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
          <div className={styles.seasonStatsHeaderRight}>Line Combinations</div>
          <div
            className={
              styles.lineCombinations + " " + styles.lineCombinationsFixedHeight
            }
            ref={lineCombinationsRef}
            style={
              fixedLineCombosHeight
                ? ({
                    ["--line-combos-height"]: `${fixedLineCombosHeight}px`
                  } as React.CSSProperties)
                : undefined
            }
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

      {/* Team Dashboard Section */}
      <TeamDashboard
        teamId={teamId?.toString() || ""}
        teamAbbrev={teamAbbreviation}
        seasonId={currentSeason?.seasonId?.toString() || ""}
      />

      {/* Game State Analysis Section */}
      <GameStateAnalysis
        teamId={teamId?.toString() || ""}
        teamAbbrev={teamAbbreviation}
        seasonId={currentSeason?.seasonId?.toString() || ""}
      />

      {/* Performance Timeline Section */}
      <MetricsTimeline
        teamId={teamId?.toString() || ""}
        teamAbbrev={teamAbbreviation}
        seasonId={currentSeason?.seasonId?.toString() || ""}
      />

      {/* Roster Matrix Section */}
      <div className={styles.sectionTitleContainer}>
        <div className={styles.sectionTitle}>
          <h3>Roster Matrix</h3>
          <p>Player roster data for the {currentSeason?.seasonId} season.</p>
        </div>
      </div>
      <div className={styles.rosterMatrixContainer}>
        <RosterMatrixWrapper />
      </div>

      {/* Add Event Visualization section with filtering */}
      <div className={styles.sectionTitleContainer}>
        <div className={styles.sectionTitle}>
          <h3>Event Visualization</h3>
          <p>
            Event data for the {currentSeason?.seasonId} season. Use the filters
            to select event types and game types to display.
          </p>
        </div>
      </div>
      <div className={styles.shotVisualizationContainer}>
        <ShotVisualization
          shotData={shotData}
          opponentShotData={opponentShotData}
          isLoading={isLoading}
          onFilterChange={handleFilterChange}
          filters={filters}
          teamAbbreviation={teamAbbreviation}
          alwaysShowOpponentLegend={true}
        />
      </div>
      {error && (
        <div className={styles.errorMessage}>
          Error loading event data: {error.message}
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { teamAbbreviation } = context.query;
  if (!teamAbbreviation || Array.isArray(teamAbbreviation)) {
    return { notFound: true };
  }
  // Look up team info by abbreviation
  const teamInfo = teamsInfo[teamAbbreviation as string];
  if (!teamInfo) {
    return { notFound: true };
  }
  const teamIdNum = teamInfo.id;
  const { data } = await supabase
    .from("team_summary_years")
    .select("*")
    .eq("team_id", teamIdNum)
    .order("season_id", { ascending: false });

  if (!data || data.length === 0) {
    return { notFound: true };
  }

  return {
    props: {
      teamName: data[0].team_full_name,
      summaries: data,
      teamAbbreviation,
      teamColors: teamInfo
        ? {
            primary: teamInfo.primaryColor,
            secondary: teamInfo.secondaryColor,
            jersey: teamInfo.jersey,
            accent: teamInfo.accent,
            alt: teamInfo.alt
          }
        : null
    }
  };
}
