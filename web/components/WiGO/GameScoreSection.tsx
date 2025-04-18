// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/GameScoreSection.tsx

import React from "react";
import GameScoreLineChart from "./GameScoreLineChart";
import styles from "styles/wigoCharts.module.scss";

interface GameScoreSectionProps {
  playerId: number | undefined;
}

const GameScoreSection: React.FC<GameScoreSectionProps> = ({ playerId }) => {
  return (
    <div className={styles.chartContainer}>
      <div
        className={styles.ratesLabel}
        style={{
          backgroundColor: "Rgb(6, 47, 61)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "5px 0"
        }}
      >
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>Game Score</h3>
      </div>

      <div className={styles.chartCanvasContainer}>
        {/* The actual chart component */}
        <GameScoreLineChart playerId={playerId} />
      </div>
    </div>
  );
};

export default GameScoreSection;
