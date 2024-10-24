// components/GameGrid/PDHC/PoissonHeatMap.tsx

import React, { useEffect, useState } from "react";
import * as d3 from "d3";
import { useTeam } from "../contexts/GameGridContext";
import { generateProbabilityMatrixWithTieBreaker } from "../utils/poissonHelpers";
import styles from "styles/PoissonHeatmap.module.scss";
import supabase from "lib/supabase";

type PoissonHeatmapProps = {
  homeTeamId: number;
  awayTeamId: number;
  gameId: number; // Add gameId as a prop
};

const PoissonHeatmap: React.FC<PoissonHeatmapProps> = ({
  homeTeamId,
  awayTeamId,
  gameId,
}) => {
  const [data, setData] = useState<number[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Access team data from context
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);

  useEffect(() => {
    const fetchExpectedGoals = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch pre-calculated expected goals from 'expected_goals' table
        const { data, error } = await supabase
          .from("expected_goals")
          .select("home_expected_goals, away_expected_goals")
          .eq("game_id", gameId)
          .single();

        if (error) throw error;

        const homeLambda = data.home_expected_goals;
        const awayLambda = data.away_expected_goals;

        console.log("Home Expected Goals (Lambda):", homeLambda);
        console.log("Away Expected Goals (Lambda):", awayLambda);

        // Generate probability matrix with tie-breaker
        const probabilityMatrix = generateProbabilityMatrixWithTieBreaker(
          homeLambda,
          awayLambda
        );

        setData(probabilityMatrix);
      } catch (err: any) {
        console.error("Error fetching expected goals:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExpectedGoals();
  }, [gameId, homeTeamId, awayTeamId]);

  if (loading) {
    return <div>Loading PDHC...</div>;
  }

  if (error) {
    return <div>Error loading PDHC: {error}</div>;
  }

  // Render the heatmap (no changes needed here)
  return (
    <div className={styles.chartContainer}>
      <h4 className={styles.pdchTitle}>
        {homeTeam.abbreviation} vs {awayTeam.abbreviation}
      </h4>
      {renderHeatmap(data, homeTeam, awayTeam)}
    </div>
  );
};

// Updated renderHeatmap function
const renderHeatmap = (data: number[][], homeTeam: any, awayTeam: any) => {
  const maxGoals = 10;
  const cellSize = 20;

  // Adjusted margins to reduce whitespace
  const margin = { top: 40, right: 20, bottom: 20, left: 40 };

  const width = margin.left + margin.right + cellSize * (maxGoals + 1);
  const height = margin.top + margin.bottom + cellSize * (maxGoals + 1);

  const colors = d3
    .scaleSequential(d3.interpolateInferno)
    .domain([0, d3.max(data.flat()) || 1]);

  const xAxisLabels = Array.from({ length: maxGoals + 1 }, (_, i) => i);
  const yAxisLabels = Array.from({ length: maxGoals + 1 }, (_, i) => i);

  return (
    <svg width={width} height={height}>
      {/* Away Team Name on X-axis */}
      <text
        x={margin.left + ((maxGoals + 1) * cellSize) / 2}
        y={margin.top - 20} // Adjusted position
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
      >
        {awayTeam.name}
      </text>

      {/* Home Team Name on Y-axis */}
      <text
        x={margin.left - 20} // Adjusted position
        y={margin.top + ((maxGoals + 1) * cellSize) / 2}
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
        transform={`rotate(-90, ${margin.left - 20}, ${
          margin.top + ((maxGoals + 1) * cellSize) / 2
        })`}
      >
        {homeTeam.name}
      </text>

      {/* X-axis Labels (Goal Values) */}
      {xAxisLabels.map((label, i) => (
        <text
          key={`x-label-${i}`}
          x={margin.left + i * cellSize + cellSize / 2}
          y={margin.top - 5}
          textAnchor="middle"
          fontSize="10"
        >
          {label}
        </text>
      ))}

      {/* Y-axis Labels (Goal Values) */}
      {yAxisLabels.map((label, i) => (
        <text
          key={`y-label-${i}`}
          x={margin.left - 5}
          y={margin.top + i * cellSize + cellSize / 2 + 3}
          textAnchor="end"
          fontSize="10"
        >
          {label}
        </text>
      ))}

      {/* Heatmap Cells */}
      {data.map((row, i) =>
        row.map((value, j) => (
          <rect
            key={`${i}-${j}`}
            x={margin.left + j * cellSize}
            y={margin.top + i * cellSize}
            width={cellSize}
            height={cellSize}
            fill={colors(value)}
            stroke="#fff"
            strokeWidth="0.5"
          >
            <title>
              {`${homeTeam.abbreviation}: ${yAxisLabels[i]} goals, ${
                awayTeam.abbreviation
              }: ${xAxisLabels[j]} goals\nProbability: ${(value * 100).toFixed(
                2
              )}%`}
            </title>
          </rect>
        ))
      )}
    </svg>
  );
};

export default PoissonHeatmap;
