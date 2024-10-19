// components/GameGrid/PDHC/PoissonHeatMap.tsx

import React, { useEffect, useState } from "react";
import * as d3 from "d3";
import { useTeam } from "../contexts/GameGridContext";
import { TeamScores } from "./types";
import { poissonProbability } from "../utils/poisson";
import { calculateFinalScores } from "../utils/projection";
import {
  fetchLeagueAvgGoalsFor,
  fetchTeamScores,
} from "../utils/poissonHelpers";
import styles from "styles/PoissonHeatmap.module.scss";

type PoissonHeatmapProps = {
  homeTeamId: number;
  awayTeamId: number;
};

const PoissonHeatmap: React.FC<PoissonHeatmapProps> = ({
  homeTeamId,
  awayTeamId,
}) => {
  const [data, setData] = useState<number[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Access team data from context
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);

  // State to hold league average goals for
  const [leagueAvgGoalsFor, setLeagueAvgGoalsFor] = useState<number>(0);

  useEffect(() => {
    const fetchAndCalculate = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!homeTeam || !awayTeam) {
          throw new Error("Team data not found.");
        }

        // Fetch league average goals for
        const leagueAvg = await fetchLeagueAvgGoalsFor();
        setLeagueAvgGoalsFor(leagueAvg);
        console.log("League Average Goals For:", leagueAvg);

        // Fetch team scores for home and away teams
        const [homeScores, awayScores] = await Promise.all([
          fetchTeamScores(homeTeam.abbreviation),
          fetchTeamScores(awayTeam.abbreviation),
        ]);

        // Calculate game-specific attack and defense scores
        const {
          finalAttScore: homeFinalAttScore,
          finalDefScore: homeFinalDefScore,
        } = await calculateFinalScores(homeScores, awayScores);

        const {
          finalAttScore: awayFinalAttScore,
          finalDefScore: awayFinalDefScore,
        } = await calculateFinalScores(awayScores, homeScores);

        // Log the final attack and defense scores
        console.log("Home Final Attack Score:", homeFinalAttScore);
        console.log("Home Final Defense Score:", homeFinalDefScore);
        console.log("Away Final Attack Score:", awayFinalAttScore);
        console.log("Away Final Defense Score:", awayFinalDefScore);

        // Calculate expected goals (Lambda)
        const homeLambda =
          homeFinalAttScore * awayFinalDefScore * leagueAvgGoalsFor;
        const awayLambda =
          awayFinalAttScore * homeFinalDefScore * leagueAvgGoalsFor;

        // Log the lambdas
        console.log("Home Lambda (Expected Goals):", homeLambda);
        console.log("Away Lambda (Expected Goals):", awayLambda);

        // Generate probability matrix with tie-breaker
        const probabilityMatrix = generateProbabilityMatrixWithTieBreaker(
          homeLambda,
          awayLambda
        );

        setData(probabilityMatrix);
      } catch (err: any) {
        console.error("Error in PoissonHeatmap:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAndCalculate();
  }, [homeTeamId, awayTeamId, homeTeam, awayTeam, leagueAvgGoalsFor]);

  // Function to generate probability matrix with tie-breaker
  const generateProbabilityMatrixWithTieBreaker = (
    homeLambda: number,
    awayLambda: number,
    maxGoals: number = 10
  ): number[][] => {
    const matrix: number[][] = [];
    let totalNonDrawProb = 0;

    // First pass: calculate probabilities and sum non-draw probabilities
    for (let i = 0; i <= maxGoals; i++) {
      matrix[i] = [];
      for (let j = 0; j <= maxGoals; j++) {
        const homeProb = poissonProbability(j, homeLambda); // Home team on X-axis
        const awayProb = poissonProbability(i, awayLambda); // Away team on Y-axis
        matrix[i][j] = homeProb * awayProb;
        if (i !== j) {
          totalNonDrawProb += matrix[i][j];
        }
      }
    }

    // Second pass: calculate draw probabilities
    let drawProb = 0;
    for (let i = 0; i <= maxGoals; i++) {
      for (let j = 0; j <= maxGoals; j++) {
        if (i === j) {
          drawProb += matrix[i][j];
        }
      }
    }

    // Calculate redistribution ratios based on Lambdas
    const totalLambda = homeLambda + awayLambda;
    const homeWinRatio = homeLambda / totalLambda;
    const awayWinRatio = awayLambda / totalLambda;

    // Third pass: redistribute draw probabilities
    for (let i = 0; i <= maxGoals; i++) {
      for (let j = 0; j <= maxGoals; j++) {
        if (i === j) {
          // Remove ties
          const originalProb = matrix[i][j];
          matrix[i][j] = 0;

          // Redistribute
          matrix[i][j] += homeWinRatio * originalProb;
          matrix[j][i] += awayWinRatio * originalProb;
        }
      }
    }

    return matrix;
  };

  if (loading) {
    return <div>Loading PDHC...</div>;
  }

  if (error) {
    return <div>Error loading PDHC: {error}</div>;
  }

  // Render the heatmap
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
              {`Home: ${yAxisLabels[i]} goals, Away: ${
                xAxisLabels[j]
              } goals\nProbability: ${(value * 100).toFixed(2)}%`}
            </title>
          </rect>
        ))
      )}
    </svg>
  );
};

export default PoissonHeatmap;
