// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/GameScoreSection.tsx

import React from "react";
import GameScoreLineChart from "./GameScoreLineChart";
import styles from "styles/wigoCharts.module.scss";
import Spinner from "components/Spinner"; // Import Spinner for potential use inside GameScoreLineChart

interface GameScoreSectionProps {
  // Allow null/undefined to be passed down
  playerId: number | null | undefined;
  seasonId?: number | null;
}

const GameScoreSection: React.FC<GameScoreSectionProps> = ({
  playerId,
  seasonId
}) => {
  return (
    // Ensure chartContainer has display: flex, flex-direction: column in SCSS
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3>Game Score</h3>
      </div>

      <div className={styles.chartCanvasContainer}>
        <GameScoreLineChart playerId={playerId} seasonId={seasonId} />
      </div>
    </div>
  );
};

export default GameScoreSection;
