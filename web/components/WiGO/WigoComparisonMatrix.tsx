import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerGameLogForStat } from "utils/fetchWigoPlayerStats";
import { TableAggregateData } from "./types";
import {
  WIGO_STAT_ORDER,
  WigoStatLabel,
  isWigoCountChartStat
} from "./statMetadata";
import { formatCell } from "./tableUtils";
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
  const metrics = WIGO_STAT_ORDER.map(
    (label) => data.find((row) => row.label === label) ?? { label }
  );
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
              directly. Both zero gives 0%; missing values or a zero baseline
              otherwise give no difference. An increase is not necessarily
              better.
            </p>
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
        <table className={styles.comparisonMatrix}>
          <caption className={styles.visuallyHidden}>
            Seven timeframes and relative difference across 36 metrics. L and R
            mark the selected comparison periods.
          </caption>
          <colgroup>
            <col style={{ width: 78 }} />
            {WIGO_STAT_ORDER.map((label) => (
              <col key={label} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {WIGO_STAT_ORDER.map((label) => (
                <th
                  scope="col"
                  key={label}
                  data-selected={label === selectedMetric || undefined}
                >
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
                      {label.includes("/") ? (
                        <>
                          {label.split("/")[0]}
                          <wbr />/{label.split("/")[1]}
                        </>
                      ) : (
                        label
                      )}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_PERIODS.map((period) => (
              <tr
                key={period}
                data-left={period === leftTimeframe || undefined}
                data-right={period === rightTimeframe || undefined}
              >
                <th scope="row">
                  {period}{" "}
                  <span className={styles.periodMarker}>
                    {period === leftTimeframe ? "L" : ""}
                    {period === rightTimeframe ? "R" : ""}
                  </span>
                </th>
                {metrics.map((row) => (
                  <td
                    key={row.label}
                    data-selected={row.label === selectedMetric || undefined}
                  >
                    {formatCell(row, period)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className={styles.matrixDiff}>
              <th scope="row">DIFF</th>
              {metrics.map((row) => (
                <td
                  key={row.label}
                  data-selected={row.label === selectedMetric || undefined}
                  data-diff-sign={typeof row.DIFF === "number" && Number.isFinite(row.DIFF)
                    ? row.DIFF < 0 ? "negative" : "positive"
                    : undefined}
                  style={typeof row.DIFF === "number" && Number.isFinite(row.DIFF)
                    ? { "--diff-strength": `${Math.min(Math.abs(row.DIFF), 100)}%` } as React.CSSProperties
                    : undefined}
                >
                  {typeof row.DIFF === "number" && Number.isFinite(row.DIFF)
                    ? `${row.DIFF > 0 ? "+" : ""}${row.DIFF.toFixed(1)}%`
                    : "-"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
      <section
        id="wigo-selected-stat"
        className={styles.selectedStatPanel}
        aria-label="Selected-stat game log"
        data-coverage="C13"
      >
        <h3>Selected stat game log · {selectedMetric}</h3>
        <p>
          {currentSeasonId
            ? `${String(currentSeasonId).slice(0, 4)}–${String(currentSeasonId).slice(6)}`
            : "Season unavailable"}{" "}
          · current-season games
        </p>
        <GameLogChart
          height={300}
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
