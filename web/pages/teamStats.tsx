// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-1\web\pages\teamStats.tsx

import React from "react";
import Link from "next/link";
import useTeams from "../hooks/useTeams";
import styles from "../styles/teamStats.module.scss";
import { teamsInfo } from "lib/teamsInfo";

interface CustomStyle extends React.CSSProperties {
  "--primary-color"?: string;
  "--secondary-color"?: string;
  "--accent-color"?: string;
  "--alt-color"?: string;
  "--jersey"?: string;
}

const TeamStats = () => {
  const teams = useTeams();

  // Sort teams alphabetically by name
  const sortedTeams = teams
    ?.slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={styles.teamStatsContainer}>
      <h1 className={styles.pageHeader}>
        <span className={styles.spanColorBlue}>Team</span> Stats
      </h1>
      <div className={styles.teamsGrid}>
        {sortedTeams && sortedTeams.length > 0 ? (
          sortedTeams.map((team) => {
            const teamInfo = teamsInfo[team.abbreviation];
            return (
              <Link href={`/teamStats/${team.abbreviation}`} key={team.id}>
                <a
                  className={styles.teamCard}
                  style={
                    {
                      "--primary-color":
                        teamInfo?.primaryColor || ("" as string),
                      "--secondary-color":
                        teamInfo?.secondaryColor || ("" as string),
                      "--jersey": teamInfo?.jersey || "black",
                      "--accent-color": teamInfo?.accent || ("" as string),
                      "--alt-color": teamInfo?.alt || "black",
                    } as CustomStyle
                  }
                >
                  <div className="center-stripe"></div>
                  <img
                    src={`/teamLogos/${team.name.replace(/\s+/g, " ")}.png`}
                    alt={team.name}
                    className={styles.teamLogo}
                  />
                  <div className={styles.teamAbbrev}>{team.abbreviation}</div>
                </a>
              </Link>
            );
          })
        ) : (
          <p className={styles.loading}>Loading...</p>
        )}
      </div>
    </div>
  );
};

export default TeamStats;
