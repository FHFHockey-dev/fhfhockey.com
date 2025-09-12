// /pages/StatsPage.tsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import styles from "styles/Stats.module.scss";
import LeaderboardCategory from "components/StatsPage/LeaderboardCategory";
import LeaderboardCategoryBSH from "components/StatsPage/LeaderboardCategoryBSH";
import LeaderboardCategoryGoalie from "components/StatsPage/LeaderboardCategoryGoalie";
import MobileTeamList from "components/StatsPage/MobileTeamList";
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
  // Dev logging wrapper (suppressed in production)
  const debugLog = (...args: any[]) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
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
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- no dependencies; on unmount only
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

  // Scroll handler for teams grid morphing - OPTIMIZED FOR MOBILE UX
  useEffect(() => {
    // Only run on mobile
    if (!isMobile) return;

    // Use ref to track scroll position to avoid dependency issues
    const scrollPositionRef = { current: window.scrollY };
    let ticking = false;
    let isUserScrolling = false;
    let scrollTimeout: NodeJS.Timeout;
    let lastStateChange = 0; // Prevent rapid state changes

    const handleScroll = () => {
      // Mark that user is actively scrolling
      isUserScrolling = true;

      // Clear any existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Set timeout to detect when scrolling has stopped
      scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
      }, 150);

      // Prevent multiple rapid scroll events
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const previousScrollY = scrollPositionRef.current;
          const newScrollDirection =
            currentScrollY > previousScrollY ? "down" : "up";

          // Calculate scroll delta to detect intentional scrolling
          const scrollDelta = Math.abs(currentScrollY - previousScrollY);
          const now = Date.now();

          // Update refs and state
          scrollPositionRef.current = currentScrollY;
          setScrollDirection(newScrollDirection);
          setLastScrollY(currentScrollY);

          // MOBILE-OPTIMIZED THRESHOLDS - Much more responsive
          const expandThreshold = 30; // Expand when very close to top
          const collapseThreshold = 80; // REDUCED: Collapse much sooner for better mobile UX
          const minStateChangeInterval = 150; // Slightly increased to reduce excessive re-renders

          // Get current state to prevent unnecessary updates
          const currentState = teamsGridState;

          // OPTIMIZED: Reduce unnecessary scroll events and state changes
          if (
            scrollDelta < 8 ||
            now - lastStateChange < minStateChangeInterval
          ) {
            ticking = false;
            return;
          }

          // MOBILE UX DEBUG LOGGING (reduced frequency)
          if (scrollDelta > 10) {
            // Only log significant movements
            debugLog("📱 Mobile Scroll:", {
              position: currentScrollY,
              delta: scrollDelta,
              state: currentState,
              thresholds: {
                expand: expandThreshold,
                collapse: collapseThreshold
              },
              direction: newScrollDirection
            });
          }

          // STATE LOGIC WITH IMMEDIATE STATE UPDATES
          if (
            currentScrollY <= expandThreshold &&
            currentState !== "expanded"
          ) {
            // At the very top - expand
            debugLog("🟢 EXPANDING teams grid at scroll:", currentScrollY);

            // CRITICAL FIX: Use React's batch update to ensure immediate state change
            setTeamsGridState(() => {
              debugLog("🟢 State setter called: expanded");
              return "expanded";
            });

            lastStateChange = now;

            // DOM manipulation as backup
            const teamsGridElement =
              (document.querySelector("[data-grid-state]") as HTMLElement) ||
              (document.querySelector(".teamSelectHeader") as HTMLElement);

            if (teamsGridElement) {
              // Force immediate DOM update
              teamsGridElement.setAttribute("data-state", "expanded");
              teamsGridElement.setAttribute("data-grid-state", "expanded");
              debugLog("✅ DOM element found and updated to expanded");
            }
          } else if (
            currentScrollY >= collapseThreshold &&
            currentState !== "collapsed" &&
            newScrollDirection === "down" // Only collapse when scrolling down
          ) {
            // Scrolled down past threshold and moving down - collapse
            debugLog("🔴 COLLAPSING teams grid at scroll:", currentScrollY);

            // CRITICAL FIX: Use React's batch update to ensure immediate state change
            setTeamsGridState(() => {
              debugLog("🔴 State setter called: collapsed");
              return "collapsed";
            });

            lastStateChange = now;

            // DOM manipulation as backup
            const teamsGridElement =
              (document.querySelector("[data-grid-state]") as HTMLElement) ||
              (document.querySelector(".teamSelectHeader") as HTMLElement);

            if (teamsGridElement) {
              // Force immediate DOM update
              teamsGridElement.setAttribute("data-state", "collapsed");
              teamsGridElement.setAttribute("data-grid-state", "collapsed");
              debugLog("✅ DOM element found and updated to collapsed");
            }
          }

          ticking = false;
        });
      }
      ticking = true;
    };

    // PASSIVE SCROLL LISTENER - Critical for performance and preventing scroll blocking
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Set initial state based on current scroll position - FIXED SYNCHRONIZATION
    const initialScrollY = window.scrollY;
    scrollPositionRef.current = initialScrollY;
    setLastScrollY(initialScrollY);

    // ENHANCED INITIAL STATE LOGIC WITH FORCED UPDATE
    debugLog("🚀 Initial scroll position:", initialScrollY);
    if (initialScrollY <= 30) {
      debugLog("🟢 Initial state: expanded");
      setTeamsGridState("expanded");

      // Force DOM update immediately
      setTimeout(() => {
        const teamsGridElement = document.querySelector(
          "[data-grid-state]"
        ) as HTMLElement;
        if (teamsGridElement) {
          teamsGridElement.setAttribute("data-grid-state", "expanded");
          debugLog("🟢 Initial DOM state set to expanded");
        }
      }, 0);
    } else if (initialScrollY >= 80) {
      // UPDATED: Use new collapse threshold
      debugLog("🔴 Initial state: collapsed");
      setTeamsGridState("collapsed");

      // Force DOM update immediately
      setTimeout(() => {
        const teamsGridElement = document.querySelector(
          "[data-grid-state]"
        ) as HTMLElement;
        if (teamsGridElement) {
          teamsGridElement.setAttribute("data-grid-state", "collapsed");
          debugLog("🔴 Initial DOM state set to collapsed");
        }
      }, 0);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [isMobile, teamsGridState]); // CRITICAL: Include teamsGridState to detect desync

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
                      <img
                        src={`/teamLogos/${team.abbreviation ?? "default"}.png`}
                        alt={team.name}
                        className={styles.teamLogo}
                        width={45}
                        height={45}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.src = "/teamLogos/default.png";
                        }}
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
              <div
                key={`points-${leader.player_id}`}
                className={styles.mobileLeaderItem}
              >
                <div className={styles.mobileLeaderInfo}>
                  <div className={styles.mobileLeaderName}>
                    {leader.fullName}
                  </div>
                  <div className={styles.mobileLeaderTeam}>Points Leader</div>
                </div>
                <div className={styles.mobileLeaderValue}>{leader.points}</div>
              </div>
            ))}
            {/* Goals Leaders */}
            {goalsLeaders.slice(0, 2).map((leader, index) => (
              <div
                key={`goals-${leader.player_id}`}
                className={styles.mobileLeaderItem}
              >
                <div className={styles.mobileLeaderInfo}>
                  <div className={styles.mobileLeaderName}>
                    {leader.fullName}
                  </div>
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
              <div
                key={`save-pct-${leader.goalie_id}`}
                className={styles.mobileLeaderItem}
              >
                <div className={styles.mobileLeaderInfo}>
                  <div className={styles.mobileLeaderName}>
                    {leader.fullName}
                  </div>
                  <div className={styles.mobileLeaderTeam}>Save %</div>
                </div>
                <div className={styles.mobileLeaderValue}>
                  {leader.save_pct
                    ? leader.save_pct.toFixed(3).replace(/^0/, "")
                    : "-.---"}
                </div>
              </div>
            ))}
            {/* Wins Leaders */}
            {goalieLeadersWins.slice(0, 2).map((leader, index) => (
              <div
                key={`wins-${leader.goalie_id}`}
                className={styles.mobileLeaderItem}
              >
                <div className={styles.mobileLeaderInfo}>
                  <div className={styles.mobileLeaderName}>
                    {leader.fullName}
                  </div>
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
