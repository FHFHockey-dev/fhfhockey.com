// /pages/StatsPage.tsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import styles from "styles/Stats.module.scss";
import LeaderboardCategory from "components/StatsPage/LeaderboardCategory";
import LeaderboardCategoryBSH from "components/StatsPage/LeaderboardCategoryBSH";
import LeaderboardCategoryGoalie from "components/StatsPage/LeaderboardCategoryGoalie";
import MobileTeamList from "components/StatsPage/MobileTeamList";
import MobileTabInterface from "components/StatsPage/MobileTabInterface";
import GoalieShareChart from "components/GoalieShareChart";
import { StatsProps } from "lib/NHL/statsPageTypes";
import { fetchStatsData } from "lib/NHL/statsPageFetch";
import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";
import OptimizedImage from "components/common/OptimizedImage";
import Link from "next/link";
import supabase from "lib/supabase";
import { fallbackTeamLogo } from "lib/images";
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
  skaterSeasonLabel = "Season",
  goalieSeasonLabel = "Season",
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
  // Dev logging wrapper (suppressed in production)
  const debugLog = (...args: any[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(...args);
    }
  };
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
  // New state for teams grid morphing
  const [teamsGridState, setTeamsGridState] = useState<
    "expanded" | "collapsed"
  >("expanded");
  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout>();
  const mouseLeaveTimeoutRef = useRef<NodeJS.Timeout>();
  // Removed scrollTimeoutRef: using localized timeout handles within effects to avoid lint warnings

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
    // Cleanup on unmount: snapshot ref values once to satisfy exhaustive-deps guidance
    return () => {
      const hoverTimeout = hoverTimeoutRef.current;
      const leaveTimeout = mouseLeaveTimeoutRef.current;
      if (hoverTimeout) clearTimeout(hoverTimeout);
      if (leaveTimeout) clearTimeout(leaveTimeout);
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
    }
  ];

  // Accessible filter options definition
  const filterOptions = useMemo(
    () => [
      { key: "all", label: "All Players" },
      { key: "C", label: "Center" },
      { key: "LW", label: "Left Wing" },
      { key: "RW", label: "Right Wing" },
      { key: "D", label: "Defense" },
      { key: "G", label: "Goalie" }
    ],
    []
  );

  const selectedFilterIndex = filterOptions.findIndex(
    (f) => f.key === selectedFilter
  );

  const onFilterKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key))
      return;
    e.preventDefault();
    if (selectedFilterIndex === -1) return;
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      (selectedFilterIndex + dir + filterOptions.length) % filterOptions.length;
    setSelectedFilter(filterOptions[nextIndex].key);
  };

  // Scroll handler for teams grid morphing
  useEffect(() => {
    if (!isMobile) return;

    const expandThreshold = 30;
    const collapseThreshold = 80;
    let previousScrollY = window.scrollY;
    let currentState: "expanded" | "collapsed" =
      previousScrollY >= collapseThreshold ? "collapsed" : "expanded";
    let frameId: number | null = null;

    setTeamsGridState(currentState);

    const handleScroll = () => {
      if (frameId !== null) return;

      frameId = requestAnimationFrame(() => {
        frameId = null;
        const currentScrollY = window.scrollY;
        const scrollingDown = currentScrollY > previousScrollY;
        const scrollDelta = Math.abs(currentScrollY - previousScrollY);
        previousScrollY = currentScrollY;

        if (scrollDelta < 8) return;

        if (currentScrollY <= expandThreshold && currentState !== "expanded") {
          currentState = "expanded";
          setTeamsGridState("expanded");
        } else if (
          currentScrollY >= collapseThreshold &&
          currentState !== "collapsed" &&
          scrollingDown
        ) {
          currentState = "collapsed";
          setTeamsGridState("collapsed");
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [isMobile]);

  // Mobile detection hook
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 480);
    };

    // Check on mount
    checkIsMobile();

    // Add resize listener
    window.addEventListener("resize", checkIsMobile);

    return () => {
      window.removeEventListener("resize", checkIsMobile);
    };
  }, []);

  return (
    <div className={styles.container}>
      {/* Skip link for keyboard users */}
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>
      {/* Conditional Teams Grid - Mobile vs Desktop */}
      {isMobile ? (
        <MobileTeamList
          teams={teams}
          hoveredTeam={hoveredTeam}
          teamsGridState={teamsGridState}
          activeTeamColors={activeTeamColors}
          animationState={animationState}
          onTeamMouseEnter={handleTeamMouseEnter}
          onTeamMouseLeave={handleTeamMouseLeave}
          generateTeamColorStyles={generateTeamColorStyles}
        />
      ) : (
        // Desktop Teams Grid (existing implementation)
        <div
          className={`${styles.teamSelectheader} ${styles[teamsGridState]}`}
          role="region"
          aria-label="Select an NHL team"
        >
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
              {/* Desktop team grid with containers and abbreviations */}
              <div
                className={styles.teamList}
                role="list"
                aria-label="Teams list"
              >
                {teams.map((team) => (
                  <Link
                    // team_id is the canonical unique identifier; previously used non-existent team.id
                    key={team.team_id ?? team.abbreviation}
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
                      <OptimizedImage
                        src={
                          team.abbreviation
                            ? `/teamLogos/${team.abbreviation}.png`
                            : fallbackTeamLogo
                        }
                        alt={team.name}
                        className={styles.teamLogo}
                        width={45}
                        height={45}
                        loading="lazy"
                        decoding="async"
                        fallbackSrc={fallbackTeamLogo}
                      />
                    </div>
                    <span className={styles.teamAbbreviation}>
                      {team.abbreviation}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar Section - Dynamic positioning based on teams grid state */}
      <div
        className={`${styles.searchSection} ${isMobile ? (teamsGridState === "collapsed" ? styles.teamsCollapsed : styles.teamsExpanded) : ""}`}
      >
        <div className={styles.searchBarWrapper}>
          <PlayerSearchBar />
        </div>
      </div>

      {/* Main Layout with Sidebars */}
      <div className={styles.mainLayout} id="main-content" role="main">
        {/* Left Sidebar - Skater Statistics */}
        <aside
          className={styles.leftSidebar}
          role="complementary"
          aria-labelledby="skater-stats-heading"
        >
          <header className={styles.leaderboardHeader}>
            <h2 id="skater-stats-heading" className={styles.title}>
              <span className={styles.titleAccent}>Skater Statistics</span>
            </h2>
            <div className={styles.seasonBadge}>{skaterSeasonLabel} Season</div>
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
                <div
                  className={styles.quickStatsGrid}
                  role="list"
                  aria-label="Key metrics"
                >
                  {quickStats.map((stat, index) => (
                    <div
                      key={index}
                      role="listitem"
                      className={`${styles.quickStatCard} ${stat.category ? styles[stat.category] : ""}`}
                    >
                      <div className={styles.quickStatIcon} aria-hidden="true">
                        <div className={styles.iconInner}></div>
                      </div>
                      <div className={styles.quickStatContent}>
                        <div
                          className={styles.quickStatValue}
                          aria-label={`${stat.label} value`}
                        >
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
          <section
            className={styles.filterSection}
            aria-labelledby="position-filter-heading"
          >
            <h2 id="position-filter-heading" className={styles.filterTitle}>
              Filter by Position
            </h2>
            <div
              className={styles.filterButtons}
              role="radiogroup"
              aria-label="Player position filter"
              onKeyDown={onFilterKeyDown}
            >
              {filterOptions.map((filter, idx) => {
                const isSelected = selectedFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    className={`${styles.filterButton} ${
                      isSelected ? styles.filterButtonActive : ""
                    }`}
                    onClick={() => setSelectedFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                );
              })}
              {/* Live region announcing current filter */}
              <div aria-live="polite" className={styles.visuallyHidden}>
                Selected filter: {filterOptions[selectedFilterIndex]?.label}
              </div>
            </div>
          </section>

          {/* Goalie Share Chart */}
          <section
            className={styles.goalieChartSection}
            aria-labelledby="goalie-share-heading"
          >
            <h2 id="goalie-share-heading" className={styles.sectionTitle}>
              Goalie Share Analysis
            </h2>
            <GoalieShareChart />
          </section>
        </main>

        {/* Right Sidebar - Goaltender Statistics */}
        <aside
          className={styles.rightSidebar}
          role="complementary"
          aria-labelledby="goalie-stats-heading"
        >
          <header className={styles.leaderboardHeader}>
            <h2 id="goalie-stats-heading" className={styles.title}>
              <span className={styles.titleAccent}>Goaltender Statistics</span>
            </h2>
            <div className={styles.seasonBadge}>{goalieSeasonLabel} Season</div>
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
      <MobileTabInterface
        pointsLeaders={pointsLeaders}
        goalsLeaders={goalsLeaders}
        pppLeaders={pppLeaders}
        bshLeaders={bshLeaders}
        goalieLeadersWins={goalieLeadersWins}
        goalieLeadersSavePct={goalieLeadersSavePct}
        goalieLeadersGAA={goalieLeadersGAA}
        goalieLeadersQS={goalieLeadersQS}
      />
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
