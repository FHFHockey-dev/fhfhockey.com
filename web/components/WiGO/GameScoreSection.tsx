// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/GameScoreSection.tsx

import React from "react";
import GameScoreLineChart from "./GameScoreLineChart";
import styles from "styles/wigoCharts.module.scss";
import Spinner from "components/Spinner"; // Import Spinner for potential use inside GameScoreLineChart

interface GameScoreSectionProps {
  // Allow null/undefined to be passed down
  playerId: number | null | undefined;
}

const GameScoreSection: React.FC<GameScoreSectionProps> = ({ playerId }) => {
  return (
    // Ensure chartContainer has display: flex, flex-direction: column in SCSS
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3>Game Score</h3>
      </div>

      <div className={styles.chartCanvasContainer}>
        <GameScoreLineChart playerId={playerId} />
      </div>
    </div>
  );
};

export default GameScoreSection;
