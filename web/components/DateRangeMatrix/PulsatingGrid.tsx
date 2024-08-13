/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\PulsatingGrid.tsx

import React, { useEffect, useState } from "react";
import classNames from "classnames";
import styles from "./PulsatingGrid.module.scss";
import { getColor } from "./utilities";

type PulsatingGridProps = {
  rows: number;
  cols: number;
  pulsating: boolean;
};

const PulsatingGrid: React.FC<PulsatingGridProps> = ({
  rows,
  cols,
  pulsating,
}) => {
  const [colors, setColors] = useState<string[][]>([]);
  const [opacities, setOpacities] = useState<number[][]>([]);

  useEffect(() => {
    const generateGridData = () => {
      const newColors: string[][] = [];
      const newOpacities: number[][] = [];

      for (let i = 0; i < rows; i++) {
        const colorRow: string[] = [];
        const opacityRow: number[] = [];
        for (let j = 0; j < cols; j++) {
          const randomColor = getColor(
            Math.random() > 0.5 ? "F" : "D",
            Math.random() > 0.5 ? "F" : "D"
          );
          colorRow.push(randomColor);
          opacityRow.push(Math.random());
        }
        newColors.push(colorRow);
        newOpacities.push(opacityRow);
      }

      setColors(newColors);
      setOpacities(newOpacities);
    };

    generateGridData();

    let interval: NodeJS.Timeout;
    if (pulsating) {
      interval = setInterval(() => {
        setOpacities((prevOpacities) =>
          prevOpacities.map((row) => row.map(() => Math.random()))
        );
      }, 500);
    }

    return () => clearInterval(interval);
  }, [rows, cols, pulsating]);

  return (
    <div className={styles.gridWrapper}>
      <div className={classNames(styles.grid)}>
        <div className={classNames(styles.playerInfoSize)}></div>
        {new Array(rows).fill(0).map((_, row) =>
          new Array(cols).fill(0).map((_, col) => (
            <div
              key={`${row}-${col}`}
              className={classNames(styles.cell)}
              style={{
                backgroundColor: colors[row] ? colors[row][col] : "#000",
                opacity: opacities[row] ? opacities[row][col] : 1,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default PulsatingGrid;
