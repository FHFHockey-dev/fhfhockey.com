// /pages/StatsPage.tsx

import React, { useState, useEffect, useRef } from "react";
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

interface ActiveGradient {
  id: string;
  colors: TeamColors;
  opacity: number;
  fadeState: "fadeIn" | "active" | "fadeOut";
  createdAt: number;
}

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
  const [activeTeamColors, setActiveTeamColors] = useState<TeamColors | null>(
    null
  );
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const [animationState, setAnimationState] = useState<
    "resting" | "triggered" | "triggeredAlt"
  >("resting");
  const [lastTriggeredTeam, setLastTriggeredTeam] = useState<string | null>(
    null
  );
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();
  const mouseLeaveTimeoutRef = useRef<NodeJS.Timeout>();

  const handleTeamMouseEnter = (teamAbbreviation: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (mouseLeaveTimeoutRef.current) {
      clearTimeout(mouseLeaveTimeoutRef.current);
    }

    setHoveredTeam(teamAbbreviation);

    hoverTimeoutRef.current = setTimeout(() => {
      const teamInfo = teamsInfo[teamAbbreviation];
      if (!teamInfo) return;

      if (
        teamAbbreviation !== lastTriggeredTeam ||
        animationState === "resting"
      ) {
        if (animationState === "resting" || animationState === "triggeredAlt") {
          setAnimationState("triggered");
        } else {
          setAnimationState("triggeredAlt");
        }
        setLastTriggeredTeam(teamAbbreviation);
      }

      setActiveTeamColors({
        primary: teamInfo.primaryColor,
        secondary: teamInfo.secondaryColor,
        jersey: teamInfo.jersey,
        accent: teamInfo.accent,
        alt: teamInfo.alt
      });
    }, 200);
  };

  const handleTeamMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    setHoveredTeam(null);

    mouseLeaveTimeoutRef.current = setTimeout(() => {
      setActiveTeamColors(null);
    }, 500);
  };

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

  const generateTeamColorStyles = (): React.CSSProperties => {
    if (!activeTeamColors) {
      return {};
    }

    return {
      "--team-primary": activeTeamColors.primary,
      "--team-secondary": activeTeamColors.secondary,
      "--team-jersey": activeTeamColors.jersey,
      "--team-accent": activeTeamColors.accent,
      "--team-alt": activeTeamColors.alt
    } as React.CSSProperties;
  };

  const quickStats: QuickStat[] = [
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
  ];

  return (
    <div className={styles.container}>
      {/* Teams Grid with Sticky Positioning */}
      <div className={styles.teamSelectheader}>
        {/* Teams Grid with Sliding Diagonal Background */}
        <div className={styles.teamsGridContainer}>
          <h2 className={styles.teamsTitle}>
            <span className={styles.titleAccent}>NHL Teams</span>
          </h2>

          <div
            className={`${styles.teamsSection} ${
              activeTeamColors ? styles.teamsSectionActive : ""
            } ${
              animationState === "triggered"
                ? styles.teamsSectionTriggered
                : animationState === "triggeredAlt"
                  ? styles.teamsSectionTriggeredAlt
                  : ""
            }`}
            style={generateTeamColorStyles()}
            onMouseLeave={handleTeamMouseLeave}
          >
            <div className={styles.teamNameHeader}>
              <span className={styles.teamNameText}>
                {hoveredTeam
                  ? teams.find((team) => team.abbreviation === hoveredTeam)
                      ?.name || hoveredTeam
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
                    hoveredTeam && hoveredTeam !== team.abbreviation
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
      </div>

      {/* Search Bar Section - Normal Flow (Not Sticky) */}
      <div className={styles.searchSection}>
        <div className={styles.searchBarWrapper}>
          <PlayerSearchBar />
        </div>
      </div>

      {/* Main Layout with Sidebars */}
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
                  {/* PlayerSearchBar moved to sticky section above */}
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

      {/* Mobile Leaderboard Cards - Appear Below Main Content on Mobile */}
      <section className={styles.mobileLeaderboardSection}>
        {/* Skater Statistics Card */}
        <div className={styles.mobileLeaderboardCard}>
          <div className={styles.mobileCardHeader}>
            <h2 className={styles.mobileCardTitle}>Skater Stats</h2>
            <span className={styles.mobileCardType}>Players</span>
          </div>
          <div className={styles.mobileLeadersList}>
            {/* Points Leaders */}
            {pointsLeaders.slice(0, 3).map((leader, index) => (
              <div key={`points-${leader.player_id}`} className={styles.mobileLeaderItem}>
                <div className={styles.mobileLeaderInfo}>
                  <div className={styles.mobileLeaderName}>{leader.fullName}</div>
                  <div className={styles.mobileLeaderTeam}>Points Leader</div>
                </div>
                <div className={styles.mobileLeaderValue}>{leader.points}</div>
              </div>
            ))}
            {/* Goals Leaders */}
            {goalsLeaders.slice(0, 2).map((leader, index) => (
              <div key={`goals-${leader.player_id}`} className={styles.mobileLeaderItem}>
                <div className={styles.mobileLeaderInfo}>
                  <div className={styles.mobileLeaderName}>{leader.fullName}</div>
                  <div className={styles.mobileLeaderTeam}>Goals Leader</div>
                </div>
                <div className={styles.mobileLeaderValue}>{leader.goals}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Goaltender Statistics Card */}
        <div className={styles.mobileLeaderboardCard}>
          <div className={styles.mobileCardHeader}>
            <h2 className={styles.mobileCardTitle}>Goalie Stats</h2>
            <span className={styles.mobileCardType}>Goalies</span>
          </div>
          <div className={styles.mobileLeadersList}>
            {/* Save Percentage Leaders */}
            {goalieLeadersSavePct.slice(0, 3).map((leader, index) => (
              <div key={`save-pct-${leader.goalie_id}`} className={styles.mobileLeaderItem}>
                <div className={styles.mobileLeaderInfo}>
                  <div className={styles.mobileLeaderName}>{leader.fullName}</div>
                  <div className={styles.mobileLeaderTeam}>Save %</div>
                </div>
                <div className={styles.mobileLeaderValue}>
                  {leader.save_pct ? leader.save_pct.toFixed(3).replace(/^0/, "") : "-.---"}
                </div>
              </div>
            ))}
            {/* Wins Leaders */}
            {goalieLeadersWins.slice(0, 2).map((leader, index) => (
              <div key={`wins-${leader.goalie_id}`} className={styles.mobileLeaderItem}>
                <div className={styles.mobileLeaderInfo}>
                  <div className={styles.mobileLeaderName}>{leader.fullName}</div>
                  <div className={styles.mobileLeaderTeam}>Wins</div>
                </div>
                <div className={styles.mobileLeaderValue}>{leader.wins}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
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
