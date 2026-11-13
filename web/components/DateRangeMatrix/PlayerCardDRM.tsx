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
  const { primary, secondary, jersey, accentColor, ink, inkSecondary } = getTeamColors(
    player.teamId,
  );
  const nameParts = player.name.trim().split(/\s+/);
  const firstName = nameParts[0] || player.playerAbbrevName;
  const lastName = nameParts.slice(1).join(" ") || player.lastName;
  const gameLabel = `Played ${player.GP} of ${scopeGameCount} ${
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
        ["--card-ink" as any]: ink,
        ["--card-ink-secondary" as any]: inkSecondary,
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
            ["G", "Goals", stats.goals],
            ["A", "Assists", stats.assists],
            ["PTS", "Points", stats.points],
            ["PPP", "Power-play points", stats.powerPlayPoints],
            ["SOG", "Shots on goal", stats.shots],
            ["HITS", "Hits", stats.hits],
            ["BLKS", "Blocked shots", stats.blockedShots],
            ["+/-", "Plus-minus", stats.plusMinus],
          ].map(([label, name, value]) => (
            <div className={styles.stat} key={label}>
              <abbr className={styles.statLabel} title={String(name)}>{label}</abbr>
              <span className={styles.statValue}>{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.statsUnavailable} role="status">
          No box-score stats for this range.
        </p>
      )}
    </div>
  );
};

export default PlayerCard;
