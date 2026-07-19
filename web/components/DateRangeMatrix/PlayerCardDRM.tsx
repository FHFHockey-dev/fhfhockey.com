////////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\PlayerCardDRM.tsx

import React from "react";
import styles from "../../styles/LinePairGrid.module.scss";
import { getTeamColors } from "./utilities";
import type { PlayerData } from "./utilities";
import type { ScopedSkaterCardStats } from "./fetchAggregatedData";

type PlayerCardProps = {
  player: PlayerData;
  stats?: ScopedSkaterCardStats;
  scopeGameCount: number;
};

const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  stats,
  scopeGameCount,
}) => {
  const { primary, secondary, jersey, accentColor } = getTeamColors(
    player.teamId,
  );
  const nameParts = player.name.trim().split(/\s+/);
  const firstName = nameParts[0] || player.playerAbbrevName;
  const lastName = nameParts.slice(1).join(" ") || player.lastName;
  const gameLabel = `${player.GP} GP in ${scopeGameCount} matching ${
    scopeGameCount === 1 ? "game" : "games"
  }`;

  return (
    <div
      className={styles.playerCard}
      style={{
        ["--accent-color" as any]: accentColor,
        ["--secondary-color" as any]: secondary,
        ["--primary-color" as any]: primary,
        ["--jersey-color" as any]: jersey,
      }}
    >
      <div className={styles.playerCardHeader}>
        <div className={styles.playerCardName}>
          <span className={styles.firstNamePlayerCard}>{firstName}</span>
          <span className={styles.lastNamePlayerCard}>{lastName}</span>
        </div>
        <div className={styles.displayPosition}>{player.displayPosition}</div>
      </div>

      <div className={styles.lastTenGames}>
        <span className={`${styles.line} ${styles.left}`}></span>
        <span>{gameLabel}</span>
        <span className={`${styles.line} ${styles.right}`}></span>
      </div>

      {stats ? (
        <div className={styles.statsGrid}>
          {[
            ["G", stats.goals],
            ["A", stats.assists],
            ["PTS", stats.points],
            ["PPP", stats.powerPlayPoints],
            ["SOG", stats.shots],
            ["HITS", stats.hits],
            ["BLKS", stats.blockedShots],
            ["+/-", stats.plusMinus],
          ].map(([label, value]) => (
            <div className={styles.stat} key={label}>
              <span className={styles.statLabel}>{label}</span>
              <span className={styles.statValue}>{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.statsUnavailable} role="status">
          Box-score stats unavailable for this matrix scope.
        </p>
      )}
    </div>
  );
};

export default PlayerCard;
