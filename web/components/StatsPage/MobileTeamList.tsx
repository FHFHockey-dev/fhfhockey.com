import React, { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import styles from "./MobileTeamList.module.scss";

interface TeamListItem {
  team_id: number;
  name: string;
  abbreviation: string;
}

interface TeamColors {
  primary: string;
  secondary: string;
  jersey: string;
  accent: string;
  alt: string;
}

interface MobileTeamListProps {
  teams: TeamListItem[];
  hoveredTeam: string | null;
  teamsGridState: "expanded" | "collapsed";
  activeTeamColors: TeamColors | null;
  animationState: "resting" | "triggered" | "triggeredAlt";
  onTeamMouseEnter: (teamAbbreviation: string) => void;
  onTeamMouseLeave: () => void;
  generateTeamColorStyles: () => React.CSSProperties;
}

export default function MobileTeamList({
  teams,
  hoveredTeam,
  teamsGridState,
  activeTeamColors,
  animationState,
  onTeamMouseEnter,
  onTeamMouseLeave,
  generateTeamColorStyles
}: MobileTeamListProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Dynamically compute expanded height (all content incl. paddings) so max-height animation is accurate
  useLayoutEffect(() => {
    if (headerRef.current && gridRef.current) {
      // Measure inner content height
      const contentEl = gridRef.current;
      // Temporarily remove max-height restriction to measure
      const prev = headerRef.current.style.maxHeight;
      headerRef.current.style.maxHeight = "none";
      const measured = contentEl.getBoundingClientRect().height;
      headerRef.current.style.maxHeight = prev;
      // Add a small buffer for borders/padding
      const target = Math.ceil(measured + 4);
      headerRef.current.style.setProperty("--expanded-height", `${target}px`);
    }
  }, [teams.length]);

  // Recalculate on window resize (orientation changes)
  useLayoutEffect(() => {
    const handler = () => {
      if (headerRef.current && gridRef.current) {
        headerRef.current.style.maxHeight = "none";
        const measured = gridRef.current.getBoundingClientRect().height;
        const target = Math.ceil(measured + 4);
        headerRef.current.style.setProperty("--expanded-height", `${target}px`);
      }
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Clean component without excessive logging for better performance
  return (
    <div
      ref={headerRef}
      className={`${styles.teamSelectHeader} ${styles[teamsGridState]}`}
      data-grid-state={teamsGridState}
    >
      <div
        ref={gridRef}
        className={`${styles.teamsGridContainer} ${
          teamsGridState === "expanded"
            ? styles.teamsGridContainerExpanded
            : styles.teamsGridContainerCollapsed
        }`}
      >
        {/* Only show title in expanded state */}
        {teamsGridState === "expanded" && (
          <h2 className={styles.teamsTitle}>
            <span className={styles.titleAccent}>NHL Teams</span>
          </h2>
        )}

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
          onMouseLeave={onTeamMouseLeave}
        >
          {/* Team name header removed on mobile to reduce vertical space */}

          {/* Mobile team grid */}
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
                onMouseEnter={() => onTeamMouseEnter(team.abbreviation)}
              >
                <img
                  src={`/teamLogos/${team.abbreviation}.png`}
                  alt={team.name}
                  className={styles.teamLogo}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = "/teamLogos/default.png";
                  }}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
