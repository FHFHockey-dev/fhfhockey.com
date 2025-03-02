// /components/StatsPage/LeaderboardCategoryBSH.tsx

import React from "react";
import styles from "styles/Stats.module.scss";
import { SkaterStat } from "lib/NHL/statsPageTypes";
import Segment from "./Segment";

interface LeaderboardCategoryBSHProps {
  title: string;
  leaders?: SkaterStat[];
}

const LeaderboardCategoryBSH: React.FC<LeaderboardCategoryBSHProps> = ({
  title,
  leaders = []
}) => {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {leaders.map((player, index) => {
        const blocks = player.blocked_shots;
        const shots = player.shots;
        const hits = player.hits;
        let bar: JSX.Element | null = null;
        if (player.bsh > 0) {
          bar = (
            <div className={styles.angledBarContainer}>
              <Segment
                flexValue={blocks}
                color="#07aae2"
                label="B"
                isFirst={true}
                isLast={false}
              />
              <Segment
                flexValue={shots}
                color="#F0AD4E"
                label="S"
                isFirst={false}
                isLast={false}
              />
              <Segment
                flexValue={hits}
                color="#D9534F"
                label="H"
                isFirst={false}
                isLast={true}
              />
            </div>
          );
        }
        const rowClasses =
          index === 0
            ? `${styles.leaderRow} ${styles.leaderRowExpanded}`
            : styles.leaderRow;
        return (
          <div key={player.player_id} className={rowClasses}>
            <div className={styles.topRow}>
              <img
                src={
                  player.image_url ||
                  `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${player.player_id}.jpg`
                }
                alt={player.fullName}
                className={styles.playerHeadshot}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className={styles.leaderMain}>
                <div className={styles.nameValueRow}>
                  <div>
                    <div className={styles.leaderName}>{player.fullName}</div>
                    <div className={styles.playerDetails}>
                      {player.current_team_abbreviation} &middot; #
                      {player.sweater_number} &middot; {player.position}
                    </div>
                  </div>
                  <div className={styles.leaderValue}>{player.bsh}</div>
                </div>
              </div>
            </div>
            {bar && <div className={styles.leaderBar}>{bar}</div>}
          </div>
        );
      })}
    </div>
  );
};

export default LeaderboardCategoryBSH;
