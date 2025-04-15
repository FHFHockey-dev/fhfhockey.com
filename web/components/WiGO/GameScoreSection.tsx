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
    <div className={styles.gameScoreLineChart}>
      {/* Inner grid for Title + Chart */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr", // Title gets needed height, chart gets the rest
          height: "100%", // Make this inner grid fill the parent grid area height
          width: "100%", // Make this inner grid fill the parent grid area width
          overflow: "hidden" // Prevent content spillover (optional but good)
        }}
      >
        {/* Title */}
        <div
          className={styles.ratesLabel} // Reuse label style (or create a dedicated one)
          style={{
            backgroundColor: "#1d3239",
            // gridRow: "1/2", // Not needed with gridTemplateRows
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "5px 0" // Add some padding
          }}
        >
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
            Game Score
          </h3>
        </div>

        {/* Chart Container - THIS IS THE KEY PART */}
        <div
          style={{
            // This div is the grid cell for the chart (row 2)
            //gridRow: "2 / span 1", // Handled by gridTemplateRows: 'auto 1fr'
            position: "relative", // Important for canvas positioning/resizing
            width: "100%", // Ensure it takes full width of its grid cell
            height: "100%", // Ensure it takes full height of its grid cell (the '1fr' part)
            // minHeight: "150px" // Keep if you need a minimum, but might interfere with shrinking fully
            overflow: "hidden" // Prevents chart spilling out if calculations are slightly off
          }}
        >
          {/* The actual chart component */}
          <GameScoreLineChart playerId={playerId} />
        </div>
      </div>
    </div>
  );
};

export default GameScoreSection;
