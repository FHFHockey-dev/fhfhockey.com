// /pages/StatsPage.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useReducer,
  useCallback,
  useMemo
} from "react";
import styles from "styles/Stats.module.scss";
import LeaderboardCategory from "components/StatsPage/LeaderboardCategory";
import LeaderboardCategoryBSH from "components/StatsPage/LeaderboardCategoryBSH";
import LeaderboardCategoryGoalie from "components/StatsPage/LeaderboardCategoryGoalie";
import GoalieShareChart from "components/GoalieShareChart";
import { StatsProps } from "lib/NHL/statsPageTypes";
import { fetchStatsData } from "lib/NHL/statsPageFetch";
import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";
import Link from "next/link";
import supabase from "lib/supabase";
import { getCurrentSeason } from "lib/NHL/client";
import {
  getTeamAbbreviationById,
  getTeamInfoById,
  teamsInfo
} from "lib/teamsInfo";
import { getTeams } from "lib/NHL/server";

interface TeamListItem {
  team_id: number;
  name: string;
  abbreviation: string;
}

interface QuickStat {
  label: string;
  value: string | number;
  subtitle?: string;
  category?: string;
}

interface TeamColors {
  primary: string;
  secondary: string;
  jersey: string;
  accent: string;
  alt: string;
}

// Team color state management with useReducer
interface TeamColorState {
  activeTeamColors: TeamColors | null;
  hoveredTeam: string | null;
  animationState: "resting" | "triggered" | "triggeredAlt";
  lastTriggeredTeam: string | null;
}

type TeamColorAction =
  | { type: "TEAM_HOVER"; payload: { teamAbbrev: string; colors: TeamColors } }
  | { type: "TEAM_LEAVE" }
  | { type: "CLEAR_COLORS" }
  | { type: "SET_ANIMATION"; payload: "triggered" | "triggeredAlt" };

const teamColorReducer = (
  state: TeamColorState,
  action: TeamColorAction
): TeamColorState => {
  switch (action.type) {
    case "TEAM_HOVER":
      const { teamAbbrev, colors } = action.payload;
      const newAnimationState =
        teamAbbrev !== state.lastTriggeredTeam ||
        state.animationState === "resting"
          ? state.animationState === "resting" ||
            state.animationState === "triggeredAlt"
            ? "triggered"
            : "triggeredAlt"
          : state.animationState;

      return {
        ...state,
        hoveredTeam: teamAbbrev,
        activeTeamColors: colors,
        animationState: newAnimationState,
        lastTriggeredTeam: teamAbbrev
      };
    case "TEAM_LEAVE":
      return {
        ...state,
        hoveredTeam: null
      };
    case "CLEAR_COLORS":
      return {
        ...state,
        activeTeamColors: null
      };
    case "SET_ANIMATION":
      return {
        ...state,
        animationState: action.payload
      };
    default:
      return state;
  }
};

const initialTeamColorState: TeamColorState = {
  activeTeamColors: null,
  hoveredTeam: null,
  animationState: "resting",
  lastTriggeredTeam: null
};

export default function StatsPage({
  pointsLeaders,
  goalsLeaders,
  pppLeaders,
  bshLeaders,
  goalieLeadersWins,
  goalieLeadersSavePct,
  goalieLeadersGAA,
  goalieLeadersQS,
  teams = []
}: StatsProps & { teams: TeamListItem[] }) {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [teamColorState, dispatch] = useReducer(
    teamColorReducer,
    initialTeamColorState
  );
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();
  const mouseLeaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Memoized team color generation function
  const generateTeamColorStyles = useCallback((): React.CSSProperties => {
    if (!teamColorState.activeTeamColors) {
      return {};
    }

    return {
      "--team-primary": teamColorState.activeTeamColors.primary,
      "--team-secondary": teamColorState.activeTeamColors.secondary,
      "--team-jersey": teamColorState.activeTeamColors.jersey,
      "--team-accent": teamColorState.activeTeamColors.accent,
      "--team-alt": teamColorState.activeTeamColors.alt
    } as React.CSSProperties;
  }, [teamColorState.activeTeamColors]);

  const handleTeamMouseEnter = useCallback((teamAbbreviation: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (mouseLeaveTimeoutRef.current) {
      clearTimeout(mouseLeaveTimeoutRef.current);
    }

    hoverTimeoutRef.current = setTimeout(() => {
      const teamInfo = teamsInfo[teamAbbreviation];
      if (!teamInfo) return;

      const colors: TeamColors = {
        primary: teamInfo.primaryColor,
        secondary: teamInfo.secondaryColor,
        jersey: teamInfo.jersey,
        accent: teamInfo.accent,
        alt: teamInfo.alt
      };

      dispatch({
        type: "TEAM_HOVER",
        payload: { teamAbbrev: teamAbbreviation, colors }
      });
    }, 200);
  }, []);

  const handleTeamMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    dispatch({ type: "TEAM_LEAVE" });

    mouseLeaveTimeoutRef.current = setTimeout(() => {
      dispatch({ type: "CLEAR_COLORS" });
    }, 500);
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (mouseLeaveTimeoutRef.current) {
        clearTimeout(mouseLeaveTimeoutRef.current);
      }
    };
  }, []);

  // Memoized quick stats calculation
  const quickStats: QuickStat[] = useMemo(
    () => [
      {
        label: "Points Leader",
        value: pointsLeaders[0]?.points || 0,
        subtitle: `${pointsLeaders[0]?.fullName || "N/A"}`,
        category: "scoring"
      },
      {
        label: "Goals Leader",
        value: goalsLeaders[0]?.goals || 0,
        subtitle: `${goalsLeaders[0]?.fullName || "N/A"}`,
        category: "scoring"
      },
      {
        label: "Save Percentage",
        value: goalieLeadersSavePct[0]?.save_pct
          ? goalieLeadersSavePct[0].save_pct.toFixed(3).replace(/^0/, "")
          : "-.---",
        subtitle: `${goalieLeadersSavePct[0]?.fullName || "N/A"}`,
        category: "goaltending"
      },
      {
        label: "Active Teams",
        value: teams.length,
        subtitle: "NHL Organizations",
        category: "league"
      }
    ],
    [pointsLeaders, goalsLeaders, goalieLeadersSavePct, teams]
  );

  return (
    <div className={styles.container}>
      {/* Main Layout with Sidebars */}
      <div className={styles.teamSelectheader}>
        {/* Teams Grid with Sliding Diagonal Background */}
        <div className={styles.teamsGridContainer}>
          <h2 className={styles.teamsTitle}>
            <span className={styles.titleAccent}>NHL Teams</span>
          </h2>

          <div
            className={`${styles.teamsSection} ${
              teamColorState.activeTeamColors ? styles.teamsSectionActive : ""
            } ${
              teamColorState.animationState === "triggered"
                ? styles.teamsSectionTriggered
                : teamColorState.animationState === "triggeredAlt"
                  ? styles.teamsSectionTriggeredAlt
                  : ""
            }`}
            style={generateTeamColorStyles()}
            onMouseLeave={handleTeamMouseLeave}
          >
            <div className={styles.teamNameHeader}>
              <span className={styles.teamNameText}>
                {teamColorState.hoveredTeam
                  ? teams.find(
                      (team) => team.abbreviation === teamColorState.hoveredTeam
                    )?.name || teamColorState.hoveredTeam
                  : ""}
              </span>
            </div>
            {/* team grid */}
            <div className={styles.teamList}>
              {teams.map((team) => (
                <Link
                  key={team.team_id}
                  href={`/stats/team/${team.abbreviation}`}
                  className={`${styles.teamListItem} ${
                    teamColorState.hoveredTeam &&
                    teamColorState.hoveredTeam !== team.abbreviation
                      ? styles.teamListItemBlurred
                      : ""
                  }`}
                  title={team.name}
                  onMouseEnter={() => handleTeamMouseEnter(team.abbreviation)}
                >
                  <div className={styles.teamLogoContainer}>
                    <span className={styles.teamAbbreviation}>
                      {team.abbreviation}
                    </span>
                    <img
                      src={`/teamLogos/${team.abbreviation}.png`}
                      alt={team.name}
                      className={styles.teamLogo}
                      loading="lazy"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.mainLayout}>
          {/* Left Sidebar - Skater Statistics */}
          <aside className={styles.leftSidebar}>
            <header className={styles.leaderboardHeader}>
              <h1 className={styles.title}>
                <span className={styles.titleAccent}>Skater Statistics</span>
              </h1>
              <div className={styles.seasonBadge}>2024-25 Season</div>
            </header>
            <div className={styles.leaderboards}>
              <LeaderboardCategory
                title="Points"
                leaders={pointsLeaders}
                statKey="points"
              />
              <LeaderboardCategory
                title="Goals"
                leaders={goalsLeaders}
                statKey="goals"
              />
              <LeaderboardCategory
                title="Power Play Points"
                leaders={pppLeaders}
                statKey="pp_points"
              />
              <LeaderboardCategoryBSH title="BSH Index" leaders={bshLeaders} />
            </div>
          </aside>

          {/* Middle Content Section */}
          <main className={styles.middleContent}>
            <div className={styles.topRowHero}>
              {/* Hero Section - Clean and Minimal */}
              <section className={styles.heroSection}>
                <div className={styles.heroContent}>
                  <h1 className={styles.heroTitle}>Underlying Stats Hub</h1>

                  <p className={styles.heroSubtitle}>
                    Advanced hockey statistics and player performance analysis
                  </p>
                  <PlayerSearchBar />
                </div>

                {/* Quick Stats - Bento Box Layout */}
                <section className={styles.quickStatsSection}>
                  <h2 className={styles.sectionTitle}>Key Metrics</h2>
                  <div className={styles.quickStatsGrid}>
                    {quickStats.map((stat, index) => (
                      <div
                        key={index}
                        className={`${styles.quickStatCard} ${stat.category ? styles[stat.category] : ""}`}
                      >
                        <div className={styles.quickStatIcon}>
                          <div className={styles.iconInner}></div>
                        </div>
                        <div className={styles.quickStatContent}>
                          <div className={styles.quickStatValue}>
                            {stat.value}
                          </div>
                          <div className={styles.quickStatLabel}>
                            {stat.label}
                          </div>
                          {stat.subtitle && (
                            <div className={styles.quickStatSubtitle}>
                              {stat.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </section>
            </div>

            {/* Position Filter */}
            <section className={styles.filterSection}>
              <h3 className={styles.filterTitle}>Filter by Position</h3>
              <div className={styles.filterButtons}>
                {[
                  { key: "all", label: "All Players" },
                  { key: "C", label: "Center" },
                  { key: "LW", label: "Left Wing" },
                  { key: "RW", label: "Right Wing" },
                  { key: "D", label: "Defense" },
                  { key: "G", label: "Goalie" }
                ].map((filter) => (
                  <button
                    key={filter.key}
                    className={`${styles.filterButton} ${
                      selectedFilter === filter.key
                        ? styles.filterButtonActive
                        : ""
                    }`}
                    onClick={() => setSelectedFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Goalie Share Chart */}
            <section className={styles.goalieChartSection}>
              <h3 className={styles.sectionTitle}>Goalie Share Analysis</h3>
              <GoalieShareChart />
            </section>
          </main>

          {/* Right Sidebar - Goaltender Statistics */}
          <aside className={styles.rightSidebar}>
            <header className={styles.leaderboardHeader}>
              <h1 className={styles.title}>
                <span className={styles.titleAccent}>
                  Goaltender Statistics
                </span>
              </h1>
            </header>
            <div className={styles.leaderboards}>
              <LeaderboardCategoryGoalie
                title="Wins"
                leaders={goalieLeadersWins}
                statKey="wins"
              />
              <LeaderboardCategoryGoalie
                title="Save Percentage"
                leaders={goalieLeadersSavePct}
                statKey="save_pct"
              />
              <LeaderboardCategoryGoalie
                title="Goals Against Average"
                leaders={goalieLeadersGAA}
                statKey="goals_against_avg"
              />
              <LeaderboardCategoryGoalie
                title="Quality Start Percentage"
                leaders={goalieLeadersQS}
                statKey="quality_starts_pct"
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  const data = await fetchStatsData();

  try {
    const teams = await getTeams();
    const formattedTeams = teams.map((team) => ({
      team_id: team.id,
      name: team.name,
      abbreviation:
        team.abbreviation?.trim() ||
        getTeamAbbreviationById(team.id) ||
        team.name
    }));

    formattedTeams.sort((a, b) =>
      (a?.abbreviation ?? "").localeCompare(b?.abbreviation ?? "")
    );

    return { props: { ...data, teams: formattedTeams } };
  } catch (error) {
    console.error("Error fetching teams:", error);
    return { props: { ...data, teams: [] } };
  }
}
