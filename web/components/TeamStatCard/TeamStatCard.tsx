import React from "react";
import styles from "./TeamStatCard.module.scss";

type TeamStatCardProps = {
  name: string;
  /**
   * Team logo url
   */
  logo: string;
};

function TeamStatCard({ name, logo }: TeamStatCardProps) {
  return (
    <article className={styles.card}>
      {/* team logo */}
      <div
        className={styles.image}
        style={{
          background: `linear-gradient(to bottom, transparent 70%, black 100%), url("${logo}")`,
          backgroundSize: "cover",
        }}
      >
        <div className={styles.name}>{name}</div>
      </div>

      <div className={styles.body}>
        <ul>
          <li>
            Skaters: <span className={styles.number}>1</span>
          </li>
          <li>
            Goalies: <span className={styles.number}>2</span>
          </li>
          <li>
            Line Combinations: <span className={styles.number}>4</span>
          </li>
          <li>
            Team Stats: <span className={styles.number}>2</span>
          </li>
        </ul>
      </div>
    </article>
  );
}

export default TeamStatCard;
