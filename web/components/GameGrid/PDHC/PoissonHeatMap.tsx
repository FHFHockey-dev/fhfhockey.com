// components/GameGrid/PDHC/PoissonHeatMap.tsx

import React, { useEffect, useState } from "react";
import * as d3 from "d3";
import { useTeam } from "../contexts/GameGridContext";
import { generateProbabilityMatrixWithTieBreaker } from "../utils/poissonHelpers";
import styles from "styles/PoissonHeatmap.module.scss";
import supabase from "lib/supabase";
import { calculateBlendedWinOdds, formatWinOdds } from "../utils/calcWinOdds";
import Image from "next/image";
import { teamsInfo } from "lib/teamsInfo";

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
  const [homeWinOdds, setHomeWinOdds] = useState<string>("-");
  const [awayWinOdds, setAwayWinOdds] = useState<string>("-");
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
        // Fetch pre-calculated expected goals and win odds
        const { data, error } = await supabase
          .from("expected_goals")
          .select(
            "home_expected_goals, away_expected_goals, home_win_odds, away_win_odds, home_api_win_odds, away_api_win_odds"
          )
          .eq("game_id", gameId)
          .single();

        if (error) throw error;

        const homeLambda = data.home_expected_goals;
        const awayLambda = data.away_expected_goals;

        // Calculate blended win odds
        const blendedHomeWinOdds = calculateBlendedWinOdds(
          data.home_win_odds,
          data.home_api_win_odds
        );
        const blendedAwayWinOdds = calculateBlendedWinOdds(
          data.away_win_odds,
          data.away_api_win_odds
        );

        setHomeWinOdds(
          blendedHomeWinOdds !== null ? formatWinOdds(blendedHomeWinOdds) : "-"
        );
        setAwayWinOdds(
          blendedAwayWinOdds !== null ? formatWinOdds(blendedAwayWinOdds) : "-"
        );

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

  // Extract team colors from teamsInfo
  const homeTeamInfo = Object.values(teamsInfo).find(
    (team) => team.id === homeTeamId
  );
  const awayTeamInfo = Object.values(teamsInfo).find(
    (team) => team.id === awayTeamId
  );

  if (!homeTeamInfo || !awayTeamInfo) {
    return <div>Team information not found.</div>;
  }

  // Prepare CSS variables
  const cssVariables: React.CSSProperties = {
    "--home-primary-color": homeTeamInfo?.primaryColor || "#333",
    "--home-secondary-color": homeTeamInfo?.secondaryColor || "#555",
    "--home-accent-color": homeTeamInfo?.accent || "#777",
    "--home-alt-color": homeTeamInfo?.alt || "#999",
    "--home-jersey-color": homeTeamInfo?.jersey || "#ccc",
    "--away-primary-color": awayTeamInfo?.primaryColor || "#333",
    "--away-secondary-color": awayTeamInfo?.secondaryColor || "#555",
    "--away-accent-color": awayTeamInfo?.accent || "#777",
    "--away-alt-color": awayTeamInfo?.alt || "#999",
    "--away-jersey-color": awayTeamInfo?.jersey || "#ccc",
    "--divider-color": "#ccc", // Optional: Define a divider color variable
    "--title-color": "#fff", // Optional: Define a title color variable
    "--win-odds-color": "#fff", // Optional: Define win odds text color
  } as React.CSSProperties;

  // Updated renderHeatmap function
  const renderHeatmap = (data: number[][], homeTeam: any, awayTeam: any) => {
    const maxGoals = 10;
    const cellSize = 20;

    // Adjusted margins to reduce whitespace
    const margin = { top: 40, right: 20, bottom: 20, left: 40 };

    const width = margin.left + margin.right + cellSize * (maxGoals + 1);
    const height = margin.top + margin.bottom + cellSize * (maxGoals + 1);

    const colors = d3
      .scaleSequential(
        d3.interpolateRgbBasis(["black", "#aae207af", "#07aae2bf"])
      )
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
          fontSize="15"
          fontFamily="Roboto Condensed, sans-serif"
          fontWeight="bold"
          fill="#FFF"
        >
          {awayTeam.name}
        </text>

        {/* Home Team Name on Y-axis */}
        <text
          x={margin.left - 20} // Adjusted position
          y={margin.top + ((maxGoals + 1) * cellSize) / 2}
          textAnchor="middle"
          fontSize="15"
          fontFamily="Roboto Condensed, sans-serif"
          fontWeight="bold"
          transform={`rotate(-90, ${margin.left - 20}, ${
            margin.top + ((maxGoals + 1) * cellSize) / 2
          })`}
          fill="#FFF"
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
                }: ${xAxisLabels[j]} goals\nProbability: ${(
                  value * 100
                ).toFixed(2)}%`}
              </title>
            </rect>
          ))
        )}
      </svg>
    );
  };
  return (
    <div className={styles.chartContainer}>
      <h4 className={styles.pdchTitle} style={cssVariables}>
        <Image
          src={homeTeam.logo}
          alt={homeTeam.abbreviation}
          className={styles.pdchTitleLogo}
          width={45}
          height={45}
        />{" "}
        vs.{" "}
        <Image
          src={awayTeam.logo}
          alt={awayTeam.abbreviation}
          className={styles.pdchTitleLogo}
          width={45}
          height={45}
        />
      </h4>
      <p className={styles.winOddsLabels}>
        <span className={styles.winOddsLabelsHome}>
          Win Odds:
          <br />
          {homeWinOdds}
        </span>
        <span className={styles.winOddsLabelsDivider}> || </span>
        <span className={styles.winOddsLabelsAway}>
          Win Odds:
          <br />
          {awayWinOdds}
        </span>
      </p>
      {renderHeatmap(data, homeTeam, awayTeam)}
    </div>
  );
};

export default PoissonHeatmap;
