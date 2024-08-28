////////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\PlayerCardDRM.tsx

import { useEffect, useState } from "react";
import { teamsInfo } from "lib/NHL/teamsInfo";
import React from "react";
import styles from "../../styles/LinePairGrid.module.scss";
import { getTeamColors } from "./utilities";

type PlayerCardProps = {
  name: string;
  firstName: string;
  lastName: string;
  teamId: number;
  playerId: string;
  timeFrame: "L7" | "L14" | "L30" | "Totals"; // Add timeFrame prop
  dateRange: { start: Date; end: Date }; // Add dateRange prop
  displayPosition: string; // Add displayPosition prop
};

const PlayerCard: React.FC<PlayerCardProps> = ({
  name,
  firstName,
  lastName,
  teamId,
  playerId,
  timeFrame,
  dateRange,
  displayPosition,
}) => {
  const { primary, secondary, jersey, accentColor } = getTeamColors(teamId);
  const [goals, setGoals] = useState<number | null>(null);
  const [assists, setAssists] = useState<number | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [ppp, setPpp] = useState<number | null>(null);
  const [sog, setSog] = useState<number | null>(null);
  const [hits, setHits] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<number | null>(null);
  const [plusMinus, setPlusMinus] = useState<number | null>(null);

  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        const response = await fetch(
          `/api/v1/db/skaterArray?playerId=${playerId}`
        );
        const data = await response.json();
        const stats = data?.[playerId]?.stats?.[timeFrame]; // Fetch based on timeFrame
        // console.log("Player stats:", stats);

        if (stats) {
          setGoals(stats.goals || 0);
          setAssists(stats.assists || 0);
          setPoints(stats.points || 0);
          setPpp(stats.pp_points || 0);
          setSog(stats.shots || 0);
          setHits(stats.hits || 0);
          setBlocks(stats.blocked_shots || 0);
          setPlusMinus(stats.plus_minus || 0);
        }
      } catch (error) {
        console.error("Failed to fetch player stats:", error);
      }
    };

    fetchPlayerStats();
  }, [playerId, timeFrame]);

  return (
    <div
      className={styles.playerCard}
      style={{
        backgroundColor: primary,
        borderColor: jersey,
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
        <div className={styles.displayPosition}>{displayPosition}</div>
      </div>

      <div className={styles.lastTenGames}>
        <span className={`${styles.line} ${styles.left}`}></span>
        <span>
          {timeFrame === "Totals"
            ? `SEASON TOTALS`
            : `LAST ${
                timeFrame === "L7" ? "7" : timeFrame === "L14" ? "14" : "30"
              } GAMES`}
        </span>
        <span className={`${styles.line} ${styles.right}`}></span>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>G</span>
          <span className={styles.statValue}>
            {goals !== null ? goals : "0"}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>A</span>
          <span className={styles.statValue}>
            {assists !== null ? assists : "0"}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>PTS</span>
          <span className={styles.statValue}>
            {points !== null ? points : "0"}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>PPP</span>
          <span className={styles.statValue}>{ppp !== null ? ppp : "0"}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>SOG</span>
          <span className={styles.statValue}>{sog !== null ? sog : "0"}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>HITS</span>
          <span className={styles.statValue}>{hits !== null ? hits : "0"}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>BLKS</span>
          <span className={styles.statValue}>
            {blocks !== null ? blocks : "0"}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>+/-</span>
          <span className={styles.statValue}>
            {plusMinus !== null ? plusMinus : "0"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
