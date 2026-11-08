import React, { useRef, useState } from "react";
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
import { formatGameMeanLabel, gameLogMean } from "./gameLogMean";
import type { WigoAggregateFreshness } from "utils/fetchWigoPlayerStats";
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
// Spoken names: a column header is read with every cell, so it names the
// metric only, in full (E-02). The action is one shared description.
// Hover definitions (U12) for the metrics whose label does not say what the
// source column means (A-06). The spoken name stays the short full name.
const WIGO_METRIC_DEFINITIONS: Partial<Record<WigoStatLabel, string>> = {
  "PP%": "Share of the team's power-play time the player was on the ice",
  "PTS1%": "Share of points that were goals or primary assists",
  "PTS1/60": "Goals plus primary assists per 60 minutes",
  "OZS%": "Offensive-zone share of offensive and defensive zone starts, all strengths",
  "PPP/60": "Per 60 minutes of power-play time, not all ice time",
  "PPG/60": "Per 60 minutes of power-play time, not all ice time",
  "PPA/60": "Per 60 minutes of power-play time, not all ice time",
  IPP: "Share of on-ice goals the player scored or assisted",
  "oiSH%": "Shooting percentage of the player's team while they were on the ice"
};

export const WIGO_METRIC_NAMES: Record<WigoStatLabel, string> = {
  GP: "Games played",
  ATOI: "Average time on ice",
  Points: "Points",
  Goals: "Goals",
  Assists: "Assists",
  SOG: "Shots on goal",
  "S%": "Shooting percentage",
  PPP: "Power-play points",
  PPG: "Power-play goals",
  PPA: "Power-play assists",
  PPTOI: "Power-play time on ice per game",
  "PP%": "Share of team power-play time",
  HIT: "Hits",
  BLK: "Blocked shots",
  PIM: "Penalty minutes",
  ixG: "Individual expected goals",
  iCF: "Individual shot attempts",
  "G/60": "Goals per 60",
  "A/60": "Assists per 60",
  "PTS/60": "Points per 60",
  "SOG/60": "Shots per 60",
  "ixG/60": "Individual expected goals per 60",
  "iCF/60": "Individual shot attempts per 60",
  "PPP/60": "Power-play points per 60 power-play minutes",
  "PPG/60": "Power-play goals per 60 power-play minutes",
  "PPA/60": "Power-play assists per 60 power-play minutes",
  "iHDCF/60": "Individual high-danger chances per 60",
  "iSCF/60": "Individual scoring chances per 60",
  "HIT/60": "Hits per 60",
  "BLK/60": "Blocked shots per 60",
  "PIM/60": "Penalty minutes per 60",
  IPP: "Individual points percentage",
  "oiSH%": "On-ice shooting percentage",
  "OZS%": "Offensive zone start percentage",
  "PTS1%": "Primary share of points",
  "PTS1/60": "Primary points per 60"
};

const PERIOD_NAMES: Record<string, string> = {
  STD: "Season to date",
  LY: "Last season",
  CA: "Career average",
  "3YA": "Three-year average",
  L5: "Last 5 games",
  L10: "Last 10 games",
  L20: "Last 20 games"
};

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
const SELECTABLE_METRICS: WigoStatLabel[] = MATRIX_METRICS.map((metric) => metric.label).filter(
  (label) => label !== "GP"
);

// "Nov 1": the as-of and stale notes name a day, in UTC like the writer.
const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

interface Props {
  // Phone tab (U10): jump buttons, a focusable side-scrolling band with the
  // period column pinned, and the L-window note.
  phone?: boolean;
  freshness?: WigoAggregateFreshness | null;
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
  phone = false,
  freshness = null,
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
  // Roving tabindex: one header button is in the tab order; arrows move focus
  // only, Enter or Space selects, so focus alone never swaps the chart.
  const [focusMetric, setFocusMetric] = useState<WigoStatLabel>("SOG/60");
  const headerButtons = useRef(new Map<WigoStatLabel, HTMLButtonElement>());
  const bandRef = useRef<HTMLDivElement>(null);
  const groupHeaders = useRef(new Map<string, HTMLTableCellElement>());
  const [bandAtEnd, setBandAtEnd] = useState(false);
  const jumpToGroup = (title: string) => {
    const band = bandRef.current;
    const header = groupHeaders.current.get(title);
    const pinned = band?.querySelector<HTMLElement>("tbody th")?.offsetWidth ?? 0;
    if (band && header) band.scrollTo({ left: Math.max(0, header.offsetLeft - pinned), behavior: "smooth" });
  };
  const moveHeaderFocus = (event: React.KeyboardEvent, label: WigoStatLabel) => {
    const labels = SELECTABLE_METRICS;
    const index = labels.indexOf(label);
    const target =
      event.key === "ArrowRight" ? labels[Math.min(index + 1, labels.length - 1)]
      : event.key === "ArrowLeft" ? labels[Math.max(index - 1, 0)]
      : event.key === "Home" ? labels[0]
      : event.key === "End" ? labels[labels.length - 1]
      : null;
    if (!target) return;
    event.preventDefault();
    setFocusMetric(target);
    headerButtons.current.get(target)?.focus();
  };
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
  const gameMean = gameLogMean(gameLog.data ?? []);
  // Honest states (U9): how current the rows are, a stale STD row, and a
  // compared period with no data at all (a rookie's CA), which blanks DIFF.
  const asOf = [freshness?.careerUpdatedAt, freshness?.recentUpdatedAt]
    .filter((value): value is string => !!value && Number.isFinite(Date.parse(value)))
    .sort()[0];
  const stdStale = !!freshness?.stdStale && data.length > 0;
  const emptyPeriods = data.length === 0 ? [] : [leftTimeframe, rightTimeframe].filter(
    (period, index, pair) => pair.indexOf(period) === index &&
      data.every((row) => row.label === "GP" || row[period] == null)
  );
  const matrixNotes = [
    stdStale
      ? `STD is stale: its GP is ${freshness?.stdGp ?? "missing"}, this season ${freshness?.totalsGp} played`
      : null,
    ...emptyPeriods.map((period) => `No ${String(period)} data yet, so DIFF is blank`)
  ].filter(Boolean);
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
            <p>
              <strong>CA</strong> is the career average: a per-season average of
              every past season, excluding this one. <strong>3YA</strong> is the
              three seasons before this one. <strong>PP%</strong> is the share
              of the team&apos;s power-play time the player was on the ice.
              <strong> PTS1%</strong> is the share of points that were goals or
              primary assists. <strong>OZS%</strong> counts all strengths.
              PPP, PPG and PPA per 60 use power-play time, not all ice time.
            </p>
          </WigoHelp>
          {asOf && data.length > 0 && (
            <span className={styles.matrixCaption}>As of {shortDay(asOf)}</span>
          )}
          <span role="status">{matrixStatus}</span>
          {matrixNotes.length > 0 && (
            <span className={styles.matrixNotes} role="note">{matrixNotes.join(" · ")}</span>
          )}
        </div>
        {phone && (
          <div className={styles.bandJump} role="group" aria-label="Jump to a metric group">
            {MATRIX_GROUPS.map((group) => (
              <button type="button" key={group.title} onClick={() => jumpToGroup(group.title)}>
                {group.title}
              </button>
            ))}
          </div>
        )}
        <div
          className={styles.matrixBand}
          ref={bandRef}
          data-at-end={phone && bandAtEnd ? true : undefined}
          {...(phone
            ? {
                tabIndex: 0,
                role: "region",
                "aria-label": "Comparison band, scrolls sideways",
                onScroll: (event: React.UIEvent<HTMLDivElement>) => {
                  const band = event.currentTarget;
                  setBandAtEnd(band.scrollLeft + band.clientWidth >= band.scrollWidth - 2);
                }
              }
            : {})}
        >
          <table className={styles.comparisonMatrix}>
            <caption className={styles.visuallyHidden}>
              {MATRIX_METRICS.length} metrics by period. The last row is the
              difference between the left and right comparison periods.
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
                <td className={styles.matrixPeriodCell} />
                {MATRIX_GROUPS.map((group) => (
                  <th
                    scope="colgroup"
                    colSpan={group.metrics.length}
                    key={group.title}
                    className={styles.matrixGroupStart}
                    ref={(element) => {
                      if (element) groupHeaders.current.set(group.title, element);
                    }}
                  >
                    <span className={styles.matrixGroupTitle}>{group.title}</span>
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
                        <abbr title={WIGO_METRIC_NAMES[label]}>{short}</abbr>
                      ) : (
                        <button
                          type="button"
                          ref={(element) => {
                            if (element) headerButtons.current.set(label, element);
                            else headerButtons.current.delete(label);
                          }}
                          data-metric={label}
                          aria-label={WIGO_METRIC_NAMES[label]}
                          title={WIGO_METRIC_DEFINITIONS[label]
                            ? `${WIGO_METRIC_NAMES[label]}: ${WIGO_METRIC_DEFINITIONS[label]}`
                            : WIGO_METRIC_NAMES[label]}
                          aria-pressed={label === selectedMetric}
                          aria-controls="wigo-selected-stat"
                          aria-describedby="wigo-band-action"
                          tabIndex={label === focusMetric ? 0 : -1}
                          onFocus={() => setFocusMetric(label)}
                          onKeyDown={(event) => moveHeaderFocus(event, label)}
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
                    <span aria-hidden="true">
                      {period}
                      {period === "STD" && stdStale ? "*" : ""}
                      <span className={styles.periodMarker}>
                        {period === leftTimeframe ? "L" : ""}
                        {period === rightTimeframe ? "R" : ""}
                      </span>
                    </span>
                    <span className={styles.visuallyHidden}>
                      {PERIOD_NAMES[period]}
                      {period === "STD" && stdStale ? ", stale row" : ""}
                      {period === leftTimeframe ? ", left comparison period" : ""}
                      {period === rightTimeframe ? ", right comparison period" : ""}
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
                  <span aria-hidden="true">DIFF</span>
                  <span className={styles.visuallyHidden}>
                    Difference, left versus right, percent
                  </span>
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
          <span id="wigo-band-action" className={styles.visuallyHidden}>
            Shows its game log below.
          </span>
        </div>
        {phone && (
          <p className={styles.bandNote}>
            L5/L10/L20: up to the latest played games across seasons; see GP for
            the actual samples.
          </p>
        )}
      </section>
      <section
        id="wigo-selected-stat"
        className={styles.selectedStatPanel}
        aria-label="Selected-stat game log"
        data-coverage="C13"
      >
        <h3 aria-live="polite">
          {selectedMetric} game log{" "}
          <span>
            {currentSeasonId
              ? formatSeasonRange(currentSeasonId)
              : "Season unavailable"}{" "}
            games
          </span>
          {gameMean !== null && (
            <span className={styles.gameLogMean}>
              {" "}· {formatGameMeanLabel(selectedMetric, gameMean)}
            </span>
          )}
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
              ? `Couldn't load the ${selectedMetric} game log.`
              : null
          }
          tableType={isWigoCountChartStat(selectedMetric) ? "COUNTS" : "RATES"}
          leftTimeframe={String(leftTimeframe)}
          rightTimeframe={String(rightTimeframe)}
        />
      </section>
    </>
  );
}
