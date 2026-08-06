import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import styles from "styles/TeamStatsPage.module.scss";
import React, { useEffect, useState, useRef } from "react";
import { useShotData, ShotDataFilters } from "hooks/useShotData";
import { useTeamStatsHeaderData } from "hooks/useTeamStatsHeaderData";
import { teamsInfo } from "lib/teamsInfo";
import { LineCombinationsGrid } from "components/LineCombinations/LineCombinationsGrid";
import { TeamTabNavigation } from "components/TeamTabNavigation/TeamTabNavigation";
import TeamDropdown from "components/TeamDropdown";
import { getTeams } from "lib/NHL/server";
import { getTeamAbbreviationById } from "lib/teamsInfo";
import { getTeamSurfaceLinks } from "lib/navigation/siteSurfaceLinks";
import SurfaceWorkflowLinks from "components/SurfaceWorkflowLinks";

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

function formatSeasonLabel(seasonId: number | string | null | undefined) {
  const season = String(seasonId ?? "");
  if (!/^\d{8}$/.test(season)) return "Season";
  return `${season.slice(0, 4)}-${season.slice(6, 8)}`;
}

export function formatOrdinal(value: number | null | undefined) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) return "—";
  const normalized = Number(value);
  const lastTwoDigits = normalized % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return `${normalized}th`;
  const suffix =
    normalized % 10 === 1
      ? "st"
      : normalized % 10 === 2
        ? "nd"
        : normalized % 10 === 3
          ? "rd"
          : "th";
  return `${normalized}${suffix}`;
}

export default function TeamStatsPage({
  teamName,
  summaries,
  teamAbbreviation,
  teamColors,
  teams = []
}: {
  teamName: string;
  summaries: TeamSeasonSummary[];
  teamAbbreviation: string;
  teamColors: TeamColors | null;
  teams: { team_id: number; name: string; abbreviation: string }[];
}) {
  const teamId = summaries[0]?.team_id;
  const pageSeasonId = summaries[0]?.season_id;
  const summarySeasonLabel = formatSeasonLabel(pageSeasonId);

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

  const {
    data: standingsData,
    loading: standingsLoading,
    error: standingsError
  } = useTeamStatsHeaderData(teamId, teamAbbreviation, pageSeasonId);

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
    pageSeasonId?.toString(),
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
              <div className={styles.teamName}>
                {teamName}
                {teams.length > 0 && (
                  <TeamDropdown teams={teams} currentTeam={teamAbbreviation} />
                )}
              </div>
              <p className={styles.seasonInfo}>
                {summarySeasonLabel} Season
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
                    {formatOrdinal(standingsData.division_sequence)}
                  </span>
                  <span className={styles.quickStatLabel}>
                    {standingsData.division_name}
                  </span>
                </div>
                <div className={styles.quickStat}>
                  <span className={styles.quickStatValue}>
                    {formatOrdinal(standingsData.conference_sequence)}
                  </span>
                  <span className={styles.quickStatLabel}>
                    {standingsData.conference_name}
                  </span>
                </div>
                <div className={styles.quickStat}>
                  <span className={styles.quickStatValue}>
                    {formatOrdinal(standingsData.league_sequence)}
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
          seasonId={pageSeasonId?.toString() || ""}
          currentSeason={
            pageSeasonId === undefined ? undefined : { seasonId: pageSeasonId }
          }
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
        <SurfaceWorkflowLinks
          eyebrow="Team workflow"
          title={`Keep exploring ${teamAbbreviation}`}
          description="Move between this team dashboard, deployment, matchup, schedule, and trend context without switching to a legacy team route."
          links={getTeamSurfaceLinks(teamAbbreviation)}
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
  if (!Object.prototype.hasOwnProperty.call(teamsInfo, teamAbbreviation)) {
    return { notFound: true };
  }
  const canonicalTeamAbbreviation = teamAbbreviation as keyof typeof teamsInfo;
  const teamInfo = teamsInfo[canonicalTeamAbbreviation];
  const teamIdNum = teamInfo.id;
  const { data } = await supabase
    .from("team_summary_years")
    .select("*")
    .eq("team_id", teamIdNum)
    .order("season_id", { ascending: false });

  if (!data || data.length === 0) {
    return { notFound: true };
  }

  // Get teams for the dropdown
  let teams: { team_id: number; name: string; abbreviation: string }[] = [];
  try {
    const allTeams = await getTeams();
    teams = allTeams.map((team) => ({
      team_id: team.id,
      name: team.name,
      abbreviation:
        team.abbreviation?.trim() ||
        getTeamAbbreviationById(team.id) ||
        team.name
    }));
    // Sort alphabetically by abbreviation
    teams.sort((a, b) =>
      (a?.abbreviation ?? "").localeCompare(b?.abbreviation ?? "")
    );
  } catch (error) {
    console.error("Error fetching teams:", error);
    // Continue without teams data if there's an error
  }

  return {
    props: {
      teamName: data[0].team_full_name,
      summaries: data,
      teamAbbreviation: canonicalTeamAbbreviation,
      teams,
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
