// components/GameGrid/PDHC/PoissonHeatMap.tsx

import React, { useEffect, useState, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { useTeam } from "../contexts/GameGridContext";
import { generateProbabilityMatrixWithTieBreaker } from "../utils/poissonHelpers";
import styles from "styles/PoissonHeatmap.module.scss";
import supabase from "lib/supabase";
import { calculateBlendedWinOdds, formatWinOdds } from "../utils/calcWinOdds";
import Image from "next/legacy/image";
import { teamsInfo } from "lib/teamsInfo";

// Enhanced types
type TeamInfo = {
  id: number;
  name: string;
  abbreviation: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  accent: string;
  alt: string;
  jersey: string;
};

type ExpectedGoalsData = {
  home_expected_goals: number;
  away_expected_goals: number;
  home_win_odds: number;
  away_win_odds: number;
  home_api_win_odds: number;
  away_api_win_odds: number;
};

type PoissonHeatmapProps = {
  homeTeamId: number;
  awayTeamId: number;
  gameId: number;
};

type HeatmapConfig = {
  maxGoals: number;
  cellSize: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

const HeatmapConfig: HeatmapConfig = {
  maxGoals: 10,
  cellSize: 20,
  margin: { top: 40, right: 20, bottom: 20, left: 40 }
};

const PoissonHeatmap: React.FC<PoissonHeatmapProps> = ({
  homeTeamId,
  awayTeamId,
  gameId
}) => {
  // State management
  const [data, setData] = useState<number[][]>([]);
  const [homeWinOdds, setHomeWinOdds] = useState<string>("-");
  const [awayWinOdds, setAwayWinOdds] = useState<string>("-");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Context hooks
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);

  // Memoized team info
  const homeTeamInfo = useMemo(
    () => Object.values(teamsInfo).find((team) => team.id === homeTeamId),
    [homeTeamId]
  );

  const awayTeamInfo = useMemo(
    () => Object.values(teamsInfo).find((team) => team.id === awayTeamId),
    [awayTeamId]
  );

  // Memoized CSS variables
  const cssVariables = useMemo(
    (): React.CSSProperties & { [key: string]: string } => ({
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
      "--divider-color": "#ccc",
      "--title-color": "#fff",
      "--win-odds-color": "#fff"
    }),
    [homeTeamInfo, awayTeamInfo]
  );

  // Data fetching logic
  const fetchExpectedGoals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: expectedGoalsData, error: supabaseError } = await supabase
        .from("expected_goals")
        .select(
          "home_expected_goals, away_expected_goals, home_win_odds, away_win_odds, home_api_win_odds, away_api_win_odds"
        )
        .eq("game_id", gameId)
        .single();

      if (supabaseError) throw supabaseError;

      const {
        home_expected_goals,
        away_expected_goals,
        home_win_odds,
        away_win_odds,
        home_api_win_odds,
        away_api_win_odds
      } = expectedGoalsData as ExpectedGoalsData;

      // Calculate blended win odds
      const blendedHomeWinOdds = calculateBlendedWinOdds(
        home_win_odds,
        home_api_win_odds
      );
      const blendedAwayWinOdds = calculateBlendedWinOdds(
        away_win_odds,
        away_api_win_odds
      );

      setHomeWinOdds(
        blendedHomeWinOdds !== null ? formatWinOdds(blendedHomeWinOdds) : "-"
      );
      setAwayWinOdds(
        blendedAwayWinOdds !== null ? formatWinOdds(blendedAwayWinOdds) : "-"
      );

      // Generate probability matrix with tie-breaker
      const probabilityMatrix = generateProbabilityMatrixWithTieBreaker(
        home_expected_goals,
        away_expected_goals,
        HeatmapConfig.maxGoals
      );

      setData(probabilityMatrix);
    } catch (err: any) {
      console.error("Error fetching expected goals:", err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Effect for data fetching
  useEffect(() => {
    fetchExpectedGoals();
  }, [fetchExpectedGoals]);

  // Memoized color scale
  const colorScale = useMemo(
    () =>
      d3
        .scaleSequential(
          d3.interpolateRgbBasis(["black", "#aae207af", "#07aae2bf"])
        )
        .domain([0, d3.max(data.flat()) || 1]),
    [data]
  );

  // Memoized axis labels
  const axisLabels = useMemo(
    () => Array.from({ length: HeatmapConfig.maxGoals + 1 }, (_, i) => i),
    []
  );

  // Memoized dimensions
  const dimensions = useMemo(
    () => ({
      width:
        HeatmapConfig.margin.left +
        HeatmapConfig.margin.right +
        HeatmapConfig.cellSize * (HeatmapConfig.maxGoals + 1),
      height:
        HeatmapConfig.margin.top +
        HeatmapConfig.margin.bottom +
        HeatmapConfig.cellSize * (HeatmapConfig.maxGoals + 1)
    }),
    []
  );

  // Render functions
  const renderAxisLabels = useCallback(
    () => (
      <>
        {/* X-axis Labels (Goal Values) */}
        {axisLabels.map((label, i) => (
          <text
            key={`x-label-${i}`}
            x={
              HeatmapConfig.margin.left +
              i * HeatmapConfig.cellSize +
              HeatmapConfig.cellSize / 2
            }
            y={HeatmapConfig.margin.top - 5}
            textAnchor="middle"
            fontSize="15"
            fontWeight="900"
            fontFamily="Roboto Condensed, sans-serif"
            fill="#FFF"
          >
            {label}
          </text>
        ))}

        {/* Y-axis Labels (Goal Values) */}
        {axisLabels.map((label, i) => (
          <text
            key={`y-label-${i}`}
            x={HeatmapConfig.margin.left - 5}
            y={
              HeatmapConfig.margin.top +
              i * HeatmapConfig.cellSize +
              HeatmapConfig.cellSize / 2 +
              3
            }
            textAnchor="end"
            fontSize="15"
            fontWeight="900"
            fill="#FFF"
          >
            {label}
          </text>
        ))}
      </>
    ),
    [axisLabels]
  );

  const renderTeamNames = useCallback(
    () => (
      <>
        {/* Away Team Name on X-axis */}
        <text
          x={
            HeatmapConfig.margin.left +
            ((HeatmapConfig.maxGoals + 1) * HeatmapConfig.cellSize) / 2
          }
          y={HeatmapConfig.margin.top - 25}
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
          x={HeatmapConfig.margin.left - 20}
          y={
            HeatmapConfig.margin.top +
            ((HeatmapConfig.maxGoals + 1) * HeatmapConfig.cellSize) / 2 -
            5
          }
          textAnchor="middle"
          fontSize="15"
          fontFamily="Roboto Condensed, sans-serif"
          fontWeight="bold"
          transform={`rotate(-90, ${HeatmapConfig.margin.left - 20}, ${
            HeatmapConfig.margin.top +
            ((HeatmapConfig.maxGoals + 1) * HeatmapConfig.cellSize) / 2
          })`}
          fill="#FFF"
        >
          {homeTeam.name}
        </text>
      </>
    ),
    [homeTeam.name, awayTeam.name]
  );

  const renderHeatmapCells = useCallback(
    () =>
      data.map((row, i) =>
        row.map((value, j) => (
          <rect
            key={`${i}-${j}`}
            x={HeatmapConfig.margin.left + j * HeatmapConfig.cellSize}
            y={HeatmapConfig.margin.top + i * HeatmapConfig.cellSize}
            width={HeatmapConfig.cellSize}
            height={HeatmapConfig.cellSize}
            fill={colorScale(value)}
            stroke="#fff"
            strokeWidth="0.5"
          >
            <title>
              {`${homeTeam.abbreviation}: ${axisLabels[i]} goals, ${
                awayTeam.abbreviation
              }: ${axisLabels[j]} goals\nProbability: ${(value * 100).toFixed(
                2
              )}%`}
            </title>
          </rect>
        ))
      ),
    [data, colorScale, homeTeam.abbreviation, awayTeam.abbreviation, axisLabels]
  );

  // Loading and error states
  if (loading) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.loadingState}>Loading PDHC...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.errorState}>
          Error: {error}
          <button onClick={fetchExpectedGoals} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!homeTeamInfo || !awayTeamInfo) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.errorState}>Team information not found.</div>
      </div>
    );
  }

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

      <svg
        width={dimensions.width}
        height={dimensions.height}
        className={styles.poissonSvg}
      >
        {renderTeamNames()}
        {renderAxisLabels()}
        {renderHeatmapCells()}
      </svg>
    </div>
  );
};

export default PoissonHeatmap;
