import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerGameLogForStat } from "utils/fetchWigoPlayerStats";
import { TableAggregateData } from "./types";
import {
  WIGO_STAT_ORDER,
  WigoStatLabel,
  isWigoCountChartStat
} from "./statMetadata";
import {
  diffDirection,
  formatCell,
  formatDiffPercent,
  formatSeasonRange
} from "./tableUtils";
import TimeframeComparison from "./TimeframeComparison";
import WigoHelp from "./WigoHelp";
import dynamic from "next/dynamic";
import styles from "styles/wigoCharts.module.scss";
import { useSeasonPendingMessage } from "hooks/useCurrentSeason";
import { WIGO_QUERY_DEFAULTS } from "components/WiGO/queryDefaults";

// The game-log chart library loads with the chart, not with the page (S8).
const GameLogChart = dynamic(() => import("./StatsTableRowChart"), {
  ssr: false,
  loading: () => <div className={styles.chartLoadingPlaceholder}>Loading game log…</div>
});

export const COMPARISON_PERIODS = [
  "STD",
  "LY",
  "CA",
  "3YA",
  "L5",
  "L10",
  "L20"
] as const;

// One band (TJ, 2026-11-01): periods are rows, the 36 metrics are columns in
// three groups. Per 60 headers drop "/60"; the full label stays the button's
// accessible name, so Totals "G" and Per 60 "G" stay distinct.
export const MATRIX_GROUPS: Array<{
  title: string;
  metrics: Array<{ label: WigoStatLabel; short: string }>;
}> = [
  {
    title: "Totals",
    metrics: ([
      ["GP", "GP"], ["ATOI", "ATOI"], ["Points", "PTS"], ["Goals", "G"],
      ["Assists", "A"], ["SOG", "SOG"], ["S%", "S%"], ["PPP", "PPP"],
      ["PPG", "PPG"], ["PPA", "PPA"], ["PPTOI", "PPTOI"], ["PP%", "PP%"],
      ["HIT", "HIT"], ["BLK", "BLK"], ["PIM", "PIM"], ["ixG", "ixG"],
      ["iCF", "iCF"]
    ] as const).map(([label, short]) => ({ label, short }))
  },
  {
    title: "Per 60",
    metrics: ([
      "G/60", "A/60", "PTS/60", "SOG/60", "ixG/60", "iCF/60", "PPP/60",
      "PPG/60", "PPA/60", "iHDCF/60", "iSCF/60", "HIT/60", "BLK/60",
      "PIM/60", "PTS1/60"
    ] as const).map((label) => ({ label, short: label.replace("/60", "") }))
  },
  {
    title: "On-ice",
    metrics: (["IPP", "oiSH%", "OZS%", "PTS1%"] as const).map((label) => ({
      label,
      short: label
    }))
  }
];
const MATRIX_METRICS = MATRIX_GROUPS.flatMap((group) => group.metrics);
const GROUP_STARTS = new Set(
  MATRIX_GROUPS.slice(1).map((_, index) =>
    MATRIX_GROUPS.slice(0, index + 1).reduce((sum, group) => sum + group.metrics.length, 0)
  )
);
const isGroupStart = (index: number) => GROUP_STARTS.has(index);

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
  const seasonPending = useSeasonPendingMessage();
  // The aggregate query waits for the season and is not "loading" while it
  // waits, so say why the table is blank rather than show bare dashes (A-04).
  const matrixStatus = aggDataError
    || (!playerId ? ""
      : !currentSeasonId ? seasonPending
      : isLoadingAggData ? "Loading stats…"
      : data.length === 0 ? "No WiGO comparison rows for this player yet."
      : "");
  const gameLog = useQuery({
    queryKey: [
      "wigoSelectedStatLog",
      playerId,
      currentSeasonId,
      selectedMetric
    ],
    queryFn: () =>
      fetchPlayerGameLogForStat(playerId!, currentSeasonId!, selectedMetric),
    enabled: !!playerId && !!currentSeasonId,
    ...WIGO_QUERY_DEFAULTS
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
          <span className={styles.matrixCaption}>
            DIFF: % change · counts per game
          </span>
          <WigoHelp label="How comparison differences are calculated">
            <p>
              DIFF = (left − right) / absolute right × 100. Counting stats use
              per-game rates; rates, times and percentages are compared
              directly. Both zero displays “-”; missing values or a zero baseline
              otherwise give no difference. An increase is not necessarily
              better.
            </p>
            <p>L5/L10/L20 use up to the latest 5/10/20 played games, including prior seasons. GP shows the actual sample. Aggregate date bounds and metric coverage are unavailable; a numeric value does not establish complete source coverage.</p>
          </WigoHelp>
          <span role="status">{matrixStatus}</span>
        </div>
        <div className={styles.matrixBand}>
          <table className={styles.comparisonMatrix}>
            <caption className={styles.visuallyHidden}>
              {MATRIX_METRICS.length} metrics by period. L and R mark the
              selected comparison periods; the last row is the difference
              between them.
            </caption>
            <colgroup span={1} />
            {MATRIX_GROUPS.map((group) => (
              <colgroup
                key={group.title}
                span={group.metrics.length}
                className={styles.matrixGroup}
              />
            ))}
            <thead>
              <tr className={styles.matrixGroupRow}>
                <td />
                {MATRIX_GROUPS.map((group) => (
                  <th
                    scope="colgroup"
                    colSpan={group.metrics.length}
                    key={group.title}
                    className={styles.matrixGroupStart}
                  >
                    {group.title}
                  </th>
                ))}
              </tr>
              <tr>
                <th scope="col" className={styles.matrixPeriodCell}>
                  Period
                </th>
                {MATRIX_GROUPS.flatMap((group) =>
                  group.metrics.map(({ label, short }, index) => (
                    <th
                      scope="col"
                      key={label}
                      className={index === 0 ? styles.matrixGroupStart : undefined}
                      data-selected={label === selectedMetric || undefined}
                    >
                      {label === "GP" ? (
                        short
                      ) : (
                        <button
                          type="button"
                          aria-label={label}
                          aria-pressed={label === selectedMetric}
                          aria-controls="wigo-selected-stat"
                          onClick={() => setSelectedMetric(label)}
                        >
                          {short}
                        </button>
                      )}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_PERIODS.map((period) => (
                <tr
                  key={period}
                  data-left={period === leftTimeframe || undefined}
                  data-right={period === rightTimeframe || undefined}
                >
                  <th scope="row" className={styles.matrixPeriodCell}>
                    {period}
                    <span className={styles.periodMarker}>
                      {period === leftTimeframe ? "L" : ""}
                      {period === rightTimeframe ? "R" : ""}
                    </span>
                  </th>
                  {MATRIX_METRICS.map(({ label }, index) => (
                    <td
                      key={label}
                      className={isGroupStart(index) ? styles.matrixGroupStart : undefined}
                      data-selected={label === selectedMetric || undefined}
                    >
                      {formatCell(metricsByLabel.get(label) ?? { label }, period)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className={styles.matrixDiffRow}>
                <th scope="row" className={styles.matrixPeriodCell}>
                  DIFF
                </th>
                {MATRIX_METRICS.map(({ label }, index) => {
                  const diff = metricsByLabel.get(label)?.DIFF;
                  return (
                    <td
                      key={label}
                      className={`${styles.matrixDiffCell} ${isGroupStart(index) ? styles.matrixGroupStart : ""}`}
                      data-selected={label === selectedMetric || undefined}
                      data-diff-sign={diffDirection(diff, 0)}
                      title={formatDiffPercent(diff)}
                      style={typeof diff === "number" && Number.isFinite(diff)
                        ? { "--diff-strength": `${Math.min(Math.abs(diff), 100)}%` } as React.CSSProperties
                        : undefined}
                    >
                      {formatDiffPercent(diff, 0)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
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
              ? formatSeasonRange(currentSeasonId)
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
