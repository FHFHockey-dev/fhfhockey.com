// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/GameScoreSection.tsx

import React from "react";
import GameScoreLineChart from "./GameScoreLineChart";
import styles from "styles/wigoCharts.module.scss";

interface GameScoreSectionProps {
  playerId: number | undefined;
}

const GameScoreSection: React.FC<GameScoreSectionProps> = ({ playerId }) => {
  return (
    // This div occupies the .gameScoreLineChart grid area defined in wigoCharts.module.scss
    <div className={styles.chartContainer}>
      <div
        className={styles.ratesLabel}
        style={{
          backgroundColor: "#164352",
          // gridRow: "1/2", // Not needed with gridTemplateRows
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "5px 0" // Add some padding
        }}
      >
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>Game Score</h3>
      </div>

      {/* Chart Container - THIS IS THE KEY PART */}
      <div className={styles.chartCanvasContainer}>
        {/* The actual chart component */}
        <GameScoreLineChart playerId={playerId} />
      </div>
    </div>
  );
};

export default GameScoreSection;
