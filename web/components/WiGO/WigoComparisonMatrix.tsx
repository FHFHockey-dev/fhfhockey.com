import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerGameLogForStat } from "utils/fetchWigoPlayerStats";
import { TableAggregateData } from "./types";
import {
  WIGO_STAT_ORDER,
  WigoStatLabel,
  isWigoCountChartStat
} from "./statMetadata";
import { formatCell, formatDiffPercent } from "./tableUtils";
import TimeframeComparison from "./TimeframeComparison";
import GameLogChart from "./StatsTableRowChart";
import styles from "styles/wigoCharts.module.scss";

export const COMPARISON_PERIODS = [
  "STD",
  "LY",
  "CA",
  "3YA",
  "L5",
  "L10",
  "L20"
] as const;

// Transposed into two 18-metric halves so 36 metrics × 8 columns stay legible on one screen at 1280px.
const MATRIX_SPLIT = WIGO_STAT_ORDER.indexOf("G/60");
export const MATRIX_HALVES = [
  {
    title: "Totals and shares",
    short: "Totals",
    labels: [...WIGO_STAT_ORDER.slice(0, MATRIX_SPLIT), "IPP"] as WigoStatLabel[]
  },
  {
    title: "Per 60 and on-ice",
    short: "Rates",
    labels: WIGO_STAT_ORDER.slice(MATRIX_SPLIT).filter((label) => label !== "IPP") as WigoStatLabel[]
  }
];

interface Props {
  data: TableAggregateData[];
  isLoadingAggData: boolean;
  aggDataError: string | null;
  playerId: number | undefined;
  currentSeasonId: number | null;
  leftTimeframe: keyof TableAggregateData;
  rightTimeframe: keyof TableAggregateData;
  onCompare: (left: string, right: string) => void;
}

export default function WigoComparisonMatrix({
  data,
  isLoadingAggData,
  aggDataError,
  playerId,
  currentSeasonId,
  leftTimeframe,
  rightTimeframe,
  onCompare
}: Props) {
  const [selectedMetric, setSelectedMetric] = useState<WigoStatLabel>("SOG/60");
  const gameLog = useQuery({
    queryKey: [
      "wigoSelectedStatLog",
      playerId,
      currentSeasonId,
      selectedMetric
    ],
    queryFn: () =>
      fetchPlayerGameLogForStat(playerId!, currentSeasonId!, selectedMetric),
    enabled: !!playerId && !!currentSeasonId
  });
  const metricsByLabel = new Map(data.map((row) => [row.label, row]));
  const selectedRow = data.find((row) => row.label === selectedMetric);
  const gp = data.find((row) => row.label === "GP");
  const averages = Object.fromEntries(
    COMPARISON_PERIODS.map((period) => [period, selectedRow?.[period]])
  );
  const gpData = Object.fromEntries(
    COMPARISON_PERIODS.map((period) => [period, gp?.[period]])
  );

  return (
    <>
      <section
        className={styles.comparisonMatrixPanel}
        aria-label="Comparison matrix"
        data-coverage="C12"
      >
        <div className={styles.matrixToolbar}>
          <TimeframeComparison
            initialLeft={leftTimeframe}
            initialRight={rightTimeframe}
            onCompare={onCompare}
          />
          <span>
            DIFF: {leftTimeframe} vs {rightTimeframe} · relative % · counts per
            game
          </span>
          <details className={styles.matrixHelp}>
            <summary aria-label="How comparison differences are calculated">
              ⓘ
            </summary>
            <p>
              DIFF = (left − right) / absolute right × 100. Counting stats use
              per-game rates; rates, times and percentages are compared
              directly. Both zero displays “-”; missing values or a zero baseline
              otherwise give no difference. An increase is not necessarily
              better.
            </p>
            <p>L5/L10/L20 use up to the latest 5/10/20 played games, including prior seasons. GP shows the actual sample. Aggregate date bounds and metric coverage are unavailable; a numeric value does not establish complete source coverage.</p>
          </details>
          <span role="status">
            {aggDataError ||
              (isLoadingAggData
                ? "Loading stats…"
                : !playerId
                  ? "Select a player"
                  : "")}
          </span>
        </div>
        <div className={styles.matrixHalves}>
          {MATRIX_HALVES.map((half) => (
            <table key={half.title} className={styles.comparisonMatrix}>
              <caption className={styles.visuallyHidden}>
                {half.title}: seven timeframes and relative difference for{" "}
                {half.labels.length} metrics. L and R mark the selected
                comparison periods.
              </caption>
              <colgroup>
                <col className={styles.matrixLabelColumn} />
                {COMPARISON_PERIODS.map((period) => (
                  <col key={period} />
                ))}
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">{half.short}</th>
                  {COMPARISON_PERIODS.map((period) => (
                    <th
                      scope="col"
                      key={period}
                      data-left={period === leftTimeframe || undefined}
                      data-right={period === rightTimeframe || undefined}
                    >
                      {period}
                      <span className={styles.periodMarker}>
                        {period === leftTimeframe ? "L" : ""}
                        {period === rightTimeframe ? "R" : ""}
                      </span>
                    </th>
                  ))}
                  <th scope="col">DIFF</th>
                </tr>
              </thead>
              <tbody>
                {half.labels.map((label) => {
                  const row = metricsByLabel.get(label) ?? { label };
                  return (
                    <tr
                      key={label}
                      data-selected={label === selectedMetric || undefined}
                    >
                      <th scope="row">
                        {label === "GP" ? (
                          label
                        ) : (
                          <button
                            type="button"
                            aria-label={`Show ${label} game log`}
                            aria-pressed={label === selectedMetric}
                            aria-controls="wigo-selected-stat"
                            onClick={() => setSelectedMetric(label)}
                          >
                            {label}
                          </button>
                        )}
                      </th>
                      {COMPARISON_PERIODS.map((period) => (
                        <td
                          key={period}
                          data-left={period === leftTimeframe || undefined}
                          data-right={period === rightTimeframe || undefined}
                        >
                          {formatCell(row, period)}
                        </td>
                      ))}
                      <td
                        className={styles.matrixDiffCell}
                        data-diff-sign={typeof row.DIFF === "number" && Number.isFinite(row.DIFF)
                          ? row.DIFF < 0 ? "negative" : "positive"
                          : undefined}
                        style={typeof row.DIFF === "number" && Number.isFinite(row.DIFF)
                          ? { "--diff-strength": `${Math.min(Math.abs(row.DIFF), 100)}%` } as React.CSSProperties
                          : undefined}
                      >
                        {formatDiffPercent(row.DIFF)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </div>
      </section>
      <section
        id="wigo-selected-stat"
        className={styles.selectedStatPanel}
        aria-label="Selected-stat game log"
        data-coverage="C13"
      >
        <h3>
          {selectedMetric} game log{" "}
          <span>
            {currentSeasonId
              ? `${String(currentSeasonId).slice(0, 4)}–${String(currentSeasonId).slice(6)}`
              : "Season unavailable"}{" "}
            games
          </span>
        </h3>
        <GameLogChart
          fill
          playerId={playerId ?? 0}
          seasonId={currentSeasonId ?? 0}
          statLabel={selectedMetric}
          gameLogData={gameLog.data ?? []}
          averages={averages}
          gpData={gpData}
          isLoading={gameLog.isFetching}
          error={
            gameLog.error
              ? `Failed to load game log for ${selectedMetric}.`
              : null
          }
          tableType={isWigoCountChartStat(selectedMetric) ? "COUNTS" : "RATES"}
        />
      </section>
    </>
  );
}
