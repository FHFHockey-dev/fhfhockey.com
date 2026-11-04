import { GameLogDataPoint } from "utils/fetchWigoPlayerStats";
import {
  formatWigoStatValue,
  isWigoCountChartStat,
  isWigoPercentStat,
  isWigoTimeStat
} from "./statMetadata";

// The dashed line is the unweighted mean of the plotted games, not the pooled STD value
// (rates and percentages pool numerators and denominators), so it is labelled as a game mean
// and formatted like the stat itself; only counts read as per-game values.
export function gameLogMean(gameLogData: GameLogDataPoint[]): number | null {
  const values = gameLogData
    .map((d) => d.value)
    .filter((v): v is number => typeof v === "number");
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

export function formatGameMeanLabel(statLabel: string, mean: number): string {
  const value =
    isWigoTimeStat(statLabel) || isWigoPercentStat(statLabel) || !isWigoCountChartStat(statLabel)
      ? formatWigoStatValue(statLabel, mean)
      : mean.toFixed(2);
  return `Game mean: ${value}`;
}
