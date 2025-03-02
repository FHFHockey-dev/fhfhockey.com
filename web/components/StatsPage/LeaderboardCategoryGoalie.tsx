// /components/StatsPage/LeaderboardCategoryGoalie.tsx

import React from "react";
import styles from "styles/Stats.module.scss";
import { GoalieStat } from "lib/NHL/statsPageTypes";

interface LeaderboardCategoryGoalieProps {
  title: string;
  leaders?: GoalieStat[];
  statKey: keyof GoalieStat;
}

const LeaderboardCategoryGoalie: React.FC<LeaderboardCategoryGoalieProps> = ({
  title,
  leaders = [],
  statKey
}) => {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {leaders.map((goalie, index) => {
        const rowClasses =
          index === 0
            ? `${styles.leaderRow} ${styles.leaderRowExpanded}`
            : styles.leaderRow;
        let statValue = goalie[statKey];
        if (statKey === "save_pct") {
          statValue = goalie.save_pct
            ? goalie.save_pct.toFixed(3).replace(/^0/, "")
            : "-";
        } else if (statKey === "goals_against_avg") {
          statValue = goalie.goals_against_avg
            ? goalie.goals_against_avg.toFixed(2)
            : "-";
        } else if (statKey === "quality_starts_pct") {
          statValue = goalie.quality_starts_pct
            ? (goalie.quality_starts_pct * 100).toFixed(1)
            : "-";
        }
        return (
          <div key={goalie.goalie_id} className={rowClasses}>
            <div className={styles.topRow}>
              <img
                src={
                  goalie.image_url ||
                  `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${goalie.goalie_id}.jpg`
                }
                alt={goalie.fullName}
                className={styles.playerHeadshot}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className={styles.leaderMain}>
                <div className={styles.nameValueRow}>
                  <div>
                    <div className={styles.leaderName}>{goalie.fullName}</div>
                    <div className={styles.playerDetails}>
                      {goalie.current_team_abbreviation} &middot; #
                      {goalie.sweater_number}
                    </div>
                  </div>
                  <div className={styles.leaderValue}>{statValue}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LeaderboardCategoryGoalie;
