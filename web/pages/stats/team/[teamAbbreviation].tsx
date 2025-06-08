import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import { formatPercent, formatSeason } from "../../../utils/stats/formatters";
import styles from "styles/TeamStatsPage.module.scss";
import React, { useEffect, useState, useRef } from "react";
import useCurrentSeason from "hooks/useCurrentSeason";
import { useShotData, ShotDataFilters } from "hooks/useShotData";
import { teamsInfo } from "lib/teamsInfo";
import { LineCombinationsGrid } from "components/LineCombinations/LineCombinationsGrid";
import { TeamTabNavigation } from "components/TeamTabNavigation/TeamTabNavigation";

// Shot data interface
interface ShotData {
  xcoord: number;
  ycoord: number;
  typedesckey: string; // 'goal' or 'shot'
}

// Standings interfaces for enhanced header - Updated to match actual data structure
interface StandingsData {
  division_sequence: number;
  conference_sequence: number;
  league_sequence: number;
  points: number;
  wins: number;
  losses: number;
  ot_losses: number;
  streak_code: string;
  streak_count: number;
  l10_wins: number;
  l10_losses: number;
  l10_ot_losses: number;
  goal_for: number;
  goal_against: number;
  point_pctg: number;
  division_name: string;
  conference_name: string;
  games_played: number;
  regulation_wins: number;
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

  // State for standings data
  const [standingsData, setStandingsData] = useState<StandingsData | null>(
    null
  );
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsError, setStandingsError] = useState<string | null>(null);

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

  // Fetch standings data for the current team and season - Updated to match TeamDashboard
  useEffect(() => {
    const fetchStandingsData = async () => {
      if (!teamId || !currentSeason) return;

      setStandingsLoading(true);
      setStandingsError(null);

      try {
        // Fetch team summary data for accurate official stats
        const { data: summaryData, error: summaryError } = await supabase
          .from("team_summary_years")
          .select(
            `
            games_played,
            wins,
            losses,
            ot_losses,
            points,
            goals_for,
            goals_against,
            point_pct,
            regulation_and_ot_wins
          `
          )
          .eq("team_id", teamId)
          .eq("season_id", currentSeason.seasonId)
          .single();

        if (summaryError) throw summaryError;

        // Fetch current standings position from nhl_standings_details
        const { data: standings, error: standingsError } = await supabase
          .from("nhl_standings_details")
          .select(
            `
            division_sequence,
            conference_sequence,
            league_sequence,
            streak_code,
            streak_count,
            l10_wins,
            l10_losses,
            l10_ot_losses,
            division_name,
            conference_name
          `
          )
          .eq("team_abbrev", teamAbbreviation)
          .eq("season_id", currentSeason.seasonId)
          .order("date", { ascending: false })
          .limit(1);

        if (standingsError) throw standingsError;

        // Combine data from both sources
        if (summaryData) {
          const standingsRecord = standings?.[0];
          setStandingsData({
            division_sequence: standingsRecord?.division_sequence || 0,
            conference_sequence: standingsRecord?.conference_sequence || 0,
            league_sequence: standingsRecord?.league_sequence || 0,
            points: summaryData.points || 0,
            wins: summaryData.wins || 0,
            losses: summaryData.losses || 0,
            ot_losses: summaryData.ot_losses || 0,
            streak_code: standingsRecord?.streak_code || "",
            streak_count: standingsRecord?.streak_count || 0,
            l10_wins: standingsRecord?.l10_wins || 0,
            l10_losses: standingsRecord?.l10_losses || 0,
            l10_ot_losses: standingsRecord?.l10_ot_losses || 0,
            goal_for: summaryData.goals_for || 0,
            goal_against: summaryData.goals_against || 0,
            point_pctg: summaryData.point_pct || 0,
            division_name: standingsRecord?.division_name || "",
            conference_name: standingsRecord?.conference_name || "",
            games_played: summaryData.games_played || 0,
            regulation_wins: summaryData.regulation_and_ot_wins || 0
          });
        }
      } catch (err) {
        setStandingsError(
          err instanceof Error ? err.message : "An error occurred"
        );
        setStandingsData(null);
      } finally {
        setStandingsLoading(false);
      }
    };

    fetchStandingsData();
  }, [teamId, currentSeason, teamAbbreviation]);

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
          <div className={styles.teamDetails}>
            <div className={styles.teamInfo}>
              <h2 className={styles.teamName}>{teamName}</h2>
              <p className={styles.seasonInfo}>
                2024-25 Season • Last Updated: {new Date().toLocaleDateString()}
              </p>
            </div>

            {/* Enhanced team stats from TeamDashboard header */}
            {standingsData && (
              <div className={styles.quickStats}>
                <div className={styles.quickStat}>
                  <span className={styles.quickStatValue}>
                    {standingsData.points}
                  </span>
                  <span className={styles.quickStatLabel}>Points</span>
                </div>
                <div className={styles.quickStat}>
                  <span className={styles.quickStatValue}>
                    {standingsData.wins}-{standingsData.losses}-
                    {standingsData.ot_losses}
                  </span>
                  <span className={styles.quickStatLabel}>Record</span>
                </div>
                <div className={styles.quickStat}>
                  <span className={styles.quickStatValue}>
                    {standingsData.division_sequence}
                    {standingsData.division_sequence === 1
                      ? "st"
                      : standingsData.division_sequence === 2
                        ? "nd"
                        : standingsData.division_sequence === 3
                          ? "rd"
                          : "th"}
                  </span>
                  <span className={styles.quickStatLabel}>
                    {standingsData.division_name}
                  </span>
                </div>
                <div className={styles.quickStat}>
                  <span className={styles.quickStatValue}>
                    {standingsData.conference_sequence}
                    {standingsData.conference_sequence === 1
                      ? "st"
                      : standingsData.conference_sequence === 2
                        ? "nd"
                        : standingsData.conference_sequence === 3
                          ? "rd"
                          : "th"}
                  </span>
                  <span className={styles.quickStatLabel}>
                    {standingsData.conference_name}
                  </span>
                </div>
                <div className={styles.quickStat}>
                  <span className={styles.quickStatValue}>
                    {standingsData.league_sequence}
                    {standingsData.league_sequence === 1
                      ? "st"
                      : standingsData.league_sequence === 2
                        ? "nd"
                        : standingsData.league_sequence === 3
                          ? "rd"
                          : "th"}
                  </span>
                  <span className={styles.quickStatLabel}>NHL</span>
                </div>
              </div>
            )}
            {standingsLoading && (
              <div className={styles.quickStatsLoading}>
                Loading standings...
              </div>
            )}
            {standingsError && (
              <div className={styles.quickStatsError}>
                Unable to load standings
              </div>
            )}
          </div>
        </div>

        {/* Integrated Tab Navigation */}
        <TeamTabNavigation
          teamId={teamId?.toString() || ""}
          teamAbbrev={teamAbbreviation}
          seasonId={currentSeason?.seasonId?.toString() || ""}
          currentSeason={currentSeason}
          shotData={shotData}
          opponentShotData={opponentShotData}
          isLoadingShotData={isLoading}
          shotError={error}
          filters={filters}
          onFilterChange={handleFilterChange}
          summaries={summaries}
          lineCombos={lineCombos}
          lineCombosLoading={lineCombosLoading}
          lineCombosError={lineCombosError}
          playerMap={playerMap}
          playerMapLoading={playerMapLoading}
          playerMapError={playerMapError}
          showAllSeasons={showAllSeasons}
          onToggleAllSeasons={() => setShowAllSeasons((v) => !v)}
        />
      </div>
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
