///////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:/Users/timbr/OneDrive/Desktop/fhfhockey.com-3/web/components/DateRangeMatrix/GoalieCardDRM.tsx
import React from "react";
import styles from "../../styles/LinePairGrid.module.scss";
import { getTeamColors } from "components/DateRangeMatrix/utilities";
import type { PlayerData } from "components/DateRangeMatrix/utilities";
import type { ScopedGoalieCardStats } from "./fetchAggregatedData";

type GoalieCardProps = {
  player: PlayerData;
  stats?: ScopedGoalieCardStats;
  scopeGameCount: number;
};

const GoalieCardDRM: React.FC<GoalieCardProps> = ({
  player,
  stats,
  scopeGameCount,
}) => {
  const teamColors = getTeamColors(player.teamId);
  const nameParts = player.name.trim().split(/\s+/);
  const firstName = nameParts[0] || player.playerAbbrevName;
  const lastName = nameParts.slice(1).join(" ") || player.lastName;
  const formattedSavePct =
    stats?.savePercentage == null
      ? "—"
      : stats.savePercentage.toFixed(3).replace(/^0/, "");

  return (
    <div
      className={styles.goalieCard}
      style={{
        ["--accent-color" as any]: teamColors.accentColor,
        ["--secondary-color" as any]: teamColors.secondary,
        ["--primary-color" as any]: teamColors.primary,
        ["--jersey-color" as any]: teamColors.jersey,
        ["--card-ink" as any]: teamColors.ink,
        ["--card-ink-secondary" as any]: teamColors.inkSecondary,
      }}
    >
      <div className={styles.goalieCardHeader}>
        <div className={styles.goalieCardName}>
          <span className={styles.firstNameGoalieCard}>{firstName}</span>
          <span className={styles.lastNameGoalieCard}>{lastName}</span>
        </div>
      </div>

      <div className={styles.goalieRecord}>
        <span className={`${styles.line} ${styles.left}`}></span>
        <span>
          Played {player.GP} of {scopeGameCount}{" "}
          {scopeGameCount === 1 ? "game" : "games"}
        </span>
        <span className={`${styles.line} ${styles.right}`}></span>
      </div>

      {stats ? (
        <div className={styles.statsGridGoalies}>
          <div className={styles.goalieStat}>
            <abbr className={styles.goalieStatLabel} title="Games played">GP</abbr>
            <span className={styles.goalieStatValue}>{stats.gamesPlayed}</span>
          </div>
          <div className={styles.goalieStat}>
            <abbr className={styles.goalieStatLabel} title="Save percentage">SV%</abbr>
            <span className={styles.goalieStatValue}>{formattedSavePct}</span>
          </div>
          <div className={styles.goalieStat}>
            <abbr className={styles.goalieStatLabel} title="Goals-against average">GAA</abbr>
            <span className={styles.goalieStatValue}>
              {stats.goalsAgainstAverage.toFixed(2)}
            </span>
          </div>
          <div className={styles.goalieStat}>
            <abbr className={styles.goalieStatLabel} title="Saves">SV</abbr>
            <span className={styles.goalieStatValue}>{stats.saves}</span>
          </div>
        </div>
      ) : (
        <p className={styles.statsUnavailable} role="status">
          No goalie stats for this range.
        </p>
      )}
    </div>
  );
};

export default GoalieCardDRM;
