import type React from "react";
import type {
  TeamMatrixMetricKey,
  TeamMatrixResponse,
} from "lib/rankings/teamMatrix";
import type { ContextualRankingsSortDirection } from "lib/rankings/rankingTypes";
import type { RankingsFilterState } from "lib/rankings/rankingUrlState";

import {
  formatPercentileScore,
  getScoreTileTone,
} from "./matrixScoreFormatting";

import { formatCaveats } from "./caveatLabels";
import ScoreText from "./ScoreText";
import ScrollRegion from "./ScrollRegion";

import styles from "styles/Rankings.module.scss";

type TeamMatrixTableProps = {
  payload: TeamMatrixResponse | null;
  isLoading: boolean;
  errorMessage?: string;
  onSortMetric: (
    metricKey: TeamMatrixMetricKey,
    direction: ContextualRankingsSortDirection,
  ) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  selectedTeam: string;
  onSelectTeam: (team: string) => void;
  displayMode?: RankingsFilterState["displayMode"];
  density?: RankingsFilterState["density"];
};

type TeamMatrixRow = TeamMatrixResponse["rows"][number];

// Glyph position: x = share of play (chasing → controls), y = pace (high → low events).
// The text line carries xGF%; pace reads from the glyph and the Event Rate column.
const CONTROL_X: Record<string, string> = { chasing_play: "18%", controls_play: "82%" };
const PACE_Y: Record<string, string> = { high_event: "18%", low_event: "82%" };

function TeamStyleCell({ row }: { row: TeamMatrixRow }) {
  const label =
    row.style.label === "Balanced raw profile" ? "Balanced" : row.style.label;
  const xgf = row.metrics.xgf_percentage?.formattedValue;
  return (
    <div
      className={styles.teamStyle}
      data-control={row.style.controlAxis ?? "even"}
      title={`${row.style.displayLabel}. ${row.style.interpretation}`}
    >
      <span
        className={styles.teamStyleGlyph}
        aria-hidden="true"
        style={
          {
            "--style-x": CONTROL_X[row.style.controlAxis ?? ""] ?? "50%",
            "--style-y": PACE_Y[row.style.paceAxis ?? ""] ?? "50%",
          } as React.CSSProperties
        }
      />
      <span className={styles.teamStyleText}>
        <strong>{label}</strong>
        <span>xGF {xgf ?? "N/A"}</span>
      </span>
    </div>
  );
}

function sortDirectionForMetric(args: {
  metricKey: TeamMatrixMetricKey;
  payload: TeamMatrixResponse;
}): ContextualRankingsSortDirection {
  if (args.payload.request.metric !== args.metricKey) return "desc";
  return args.payload.request.sortDirection === "desc" ? "asc" : "desc";
}

function StateBody({ message, colSpan }: { message: string; colSpan: number }) {
  return (
    <tbody>
      <tr>
        <td className={styles.tableStateCell} colSpan={colSpan}>
          {message}
        </td>
      </tr>
    </tbody>
  );
}

function teamMetricState(
  cell: TeamMatrixResponse["rows"][number]["metrics"][TeamMatrixMetricKey],
  row: TeamMatrixResponse["rows"][number],
  metricKey: TeamMatrixMetricKey,
  staleSource: boolean,
) {
  const unitCoverage = teamUnitMetricCoverage(row, metricKey);
  if (cell.rawValue == null && isStyleDerivedMetric(metricKey)) {
    if (row.warnings.some((warning) => warning.startsWith("insufficient_sample:"))) {
      return { label: "Insufficient sample", marker: "?", className: styles.metricStateUnavailable };
    }
    if (row.warnings.some((warning) => warning.startsWith("nst_5v5_coverage_incomplete:"))) {
      return { label: "Incomplete NST coverage", marker: "?", className: styles.metricStateUnavailable };
    }
  }
  if (
    cell.rawValue == null &&
    isGameContextMetric(metricKey) &&
    row.warnings.some((warning) => warning.startsWith("insufficient_context_sample:"))
  ) {
    return { label: "Insufficient sample", marker: "?", className: styles.metricStateUnavailable };
  }
  if (unitCoverage?.status === "source_gap") {
    return { label: "No unit coverage", marker: "?", className: styles.metricStateUnavailable };
  }
  if (cell.qualifiedPeerCount === 0) {
    return { label: "No sample", marker: "?", className: styles.metricStateUnavailable };
  }
  if (cell.rawValue == null || cell.percentile == null) {
    return { label: "Source pending", marker: "?", className: styles.metricStateUnavailable };
  }
  if (unitCoverage?.status === "partial") {
    return { label: "Partial unit coverage", marker: "!", className: styles.metricStateCaveat };
  }
  if (staleSource) {
    return { label: "Stale source", marker: "~", className: styles.metricStateStale };
  }
  if (row.warnings.length > 0) {
    return { label: "Raw context", marker: "!", className: styles.metricStateCaveat };
  }
  if (cell.rawValue === 0) {
    return { label: "True zero", marker: "0", className: styles.metricStateZero };
  }
  return null;
}

function teamUnitMetricCoverage(
  row: TeamMatrixResponse["rows"][number],
  metricKey: TeamMatrixMetricKey,
) {
  switch (metricKey) {
    case "forward_top_load_index":
      return row.unitUsage.coverage.forwardTopLoad;
    case "defense_pair_top_load_index":
      return row.unitUsage.coverage.defensePairTopLoad;
    case "pp1_pp2_usage_share":
      return row.unitUsage.coverage.pp1Pp2UsageShare;
    default:
      return null;
  }
}

function isStyleDerivedMetric(metricKey: TeamMatrixMetricKey) {
  return (
    metricKey === "xgf_percentage" ||
    metricKey === "shot_quality" ||
    metricKey === "event_rate" ||
    metricKey === "finishing_luck" ||
    metricKey === "save_luck" ||
    metricKey === "net_luck"
  );
}

function isGameContextMetric(metricKey: TeamMatrixMetricKey) {
  return (
    metricKey === "one_goal_game_rate" ||
    metricKey === "home_road_point_pct_gap" ||
    metricKey === "pp_opportunity_rate" ||
    metricKey === "penalties_taken_per_60"
  );
}

function TeamMetricCell({
  cell,
  column,
  row,
  displayMode,
  staleMatrixSnapshot,
}: {
  cell: TeamMatrixResponse["rows"][number]["metrics"][TeamMatrixMetricKey];
  column: TeamMatrixResponse["meta"]["metricColumns"][number];
  row: TeamMatrixResponse["rows"][number];
  displayMode: RankingsFilterState["displayMode"];
  staleMatrixSnapshot: boolean;
}) {
  const unavailable =
    cell.qualifiedPeerCount === 0 || cell.rawValue == null || cell.percentile == null;
  const staleStyleSource =
    isStyleDerivedMetric(column.metricKey) &&
    row.record.styleSnapshotDate != null &&
    row.record.styleSnapshotDate !== row.record.latestPowerDate;
  const staleSource = !unavailable && (staleMatrixSnapshot || staleStyleSource);
  const state = teamMetricState(cell, row, column.metricKey, staleSource);
  const unitCoverage = teamUnitMetricCoverage(row, column.metricKey);
  const title = [
    column.label,
    cell.formattedValue ? `Value ${cell.formattedValue}` : null,
    cell.rank == null ? null : `Rank ${cell.rank}`,
    cell.percentile == null ? null : `Percentile ${cell.percentile.toFixed(1)}%`,
    column.lowerIsBetter ? "Lower raw values are better" : null,
    unitCoverage
      ? `Line usage ${
          unitCoverage.status === "complete"
            ? "complete"
            : unitCoverage.status === "partial"
              ? "partial"
              : "no data"
        }; ${unitCoverage.games} resolved games; latest ${unitCoverage.latestDate ?? "none"}`
      : null,
    unitCoverage?.warnings.length
      ? `Line-usage coverage: ${formatCaveats(unitCoverage.warnings)}`
      : null,
    staleMatrixSnapshot ? "Snapshot is older than latest available team matrix snapshot" : null,
    staleStyleSource
      ? `Team style source ${row.record.styleSnapshotDate} differs from team power snapshot ${row.record.latestPowerDate}`
      : null,
    isStyleDerivedMetric(column.metricKey) && row.record.styleCoverage
      ? `NST 5v5 coverage ${row.record.styleCoverage.coveredGames} of ${row.record.styleCoverage.eligibleGames} played games`
      : null,
    row.warnings.length ? `Caveats: ${formatCaveats(row.warnings)}` : null,
    column.source,
  ].filter(Boolean).join(" | ");
  const percentileLabel = formatPercentileScore(cell.percentile);
  const rankLabel = cell.rank == null ? "–" : `#${cell.rank}`;
  const primaryLabel =
    displayMode === "raw_rank"
      ? unavailable
        ? "N/A"
        : rankLabel
      : unavailable
        ? "N/A"
        : percentileLabel;
  const showRank = displayMode === "both";

  return (
    <td>
      <div
        className={`${styles.matrixMetricCell} ${
          unavailable ? styles.scoreToneMuted : getScoreTileTone(cell.percentile)
        }`}
        title={title}
        aria-label={title}
      >
        <div className={styles.metricScoreStack}>
          <div className={styles.metricScoreTile}>
            <strong>
              <ScoreText label={primaryLabel} />
            </strong>
          </div>
          {showRank ? (
            <span className={styles.metricRankLine}>
              {unavailable ? "N/A" : rankLabel}
            </span>
          ) : null}
          <span className={styles.metricValueLine}>
            {unavailable ? "N/A" : cell.formattedValue ?? "-"}
          </span>
        </div>
        {state ? (
          <span
            className={`${styles.metricStateChip} ${state.className}`}
            title={state.label}
            aria-label={state.label}
          >
            {state.marker}
          </span>
        ) : null}
      </div>
    </td>
  );
}

export default function TeamMatrixTable({
  payload,
  isLoading,
  errorMessage,
  onSortMetric,
  onPageChange,
  onPageSizeChange,
  selectedTeam,
  onSelectTeam,
  displayMode = "both",
  density = "detailed",
}: TeamMatrixTableProps) {
  const metricColumnCount = payload?.meta.metricColumns.length ?? 0;
  const colSpan = 7 + metricColumnCount;
  const normalizedSelectedTeam = selectedTeam.trim().toUpperCase();
  const staleMatrixSnapshot =
    payload?.meta.snapshotDate != null &&
    payload.meta.latestAvailableSnapshotDate != null &&
    payload.meta.snapshotDate !== payload.meta.latestAvailableSnapshotDate;

  return (
    <section className={styles.matrixSection}>
      <ScrollRegion className={styles.matrixWrap} label="Team rankings matrix">
        <table
          className={`${styles.matrixTable} ${styles.matrixTableFlatHeader} ${density === "compact" ? styles.matrixCompact : ""}`}
        >
          <thead>
            <tr>
              <th className={styles.stickyRankCell} scope="col">Rank</th>
              <th className={styles.stickyPlayerCell} scope="col">Team</th>
              <th className={styles.teamStyleCell} scope="col">Style</th>
              <th>Games</th>
              <th>PP</th>
              <th>PK</th>
              <th>Trend</th>
              {payload?.meta.metricColumns.map((column) => (
                <th key={column.metricKey}>
                  <button
                    type="button"
                    className={styles.matrixSortButton}
                    onClick={() =>
                      onSortMetric(
                        column.metricKey,
                        sortDirectionForMetric({
                          metricKey: column.metricKey,
                          payload,
                        }),
                      )
                    }
                    title={column.description}
                  >
                    {column.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          {isLoading ? (
            <StateBody message="Loading team rankings..." colSpan={colSpan} />
          ) : errorMessage ? (
            <StateBody message={errorMessage} colSpan={colSpan} />
          ) : !payload || payload.rows.length === 0 ? (
            <StateBody message="No team rankings match this filter." colSpan={colSpan} />
          ) : (
            <tbody>
              {payload.rows.map((row) => (
                <tr
                  key={row.team.abbreviation}
                  className={
                    row.team.abbreviation.toUpperCase() === normalizedSelectedTeam
                      ? styles.selectedMatrixRow
                      : undefined
                  }
                >
                  <td className={styles.stickyRankCell}>
                    <button
                      type="button"
                      className={styles.rowSelectButton}
                      aria-label={`Select ${row.team.name ?? row.team.abbreviation}`}
                      aria-pressed={
                        row.team.abbreviation.toUpperCase() === normalizedSelectedTeam
                      }
                      onClick={() => onSelectTeam(row.team.abbreviation)}
                    >
                      {row.sort.rank ?? "-"}
                    </button>
                  </td>
                  <td className={styles.stickyPlayerCell}>
                    <div className={styles.playerCell}>
                      <span className={styles.playerIdentity}>
                        <strong>{row.team.abbreviation}</strong>
                        <span>{row.team.name ?? "Team name unavailable"}</span>
                      </span>
                    </div>
                  </td>
                  <td className={styles.textCell}>
                    <TeamStyleCell row={row} />
                  </td>
                  <td>{row.record.styleGames || "-"}</td>
                  <td>{row.record.ppTier ?? "-"}</td>
                  <td>{row.record.pkTier ?? "-"}</td>
                  <td>
                    {row.record.trend10 == null
                      ? "-"
                      : row.record.trend10.toFixed(1)}
                  </td>
                  {payload.meta.metricColumns.map((column) => {
                    const cell = row.metrics[column.metricKey];
                    return (
                      <TeamMetricCell
                        key={column.metricKey}
                        cell={cell}
                        column={column}
                        row={row}
                        displayMode={displayMode}
                        staleMatrixSnapshot={Boolean(staleMatrixSnapshot)}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </ScrollRegion>
      <div className={styles.inlineNotice}>
        Team style describes raw 5v5 results; it is not adjusted for score,
        venue or opponent, and it is not a read on the coach&apos;s system.
        xG, shot quality, event rate and luck use Natural Stat Trick (NST) 5v5 xG
        and need NST data for every game played.
        {payload?.meta.sampleFloor ? ` ${payload.meta.sampleFloor.label}.` : ""}
        {payload?.meta.sourceWarnings.length
          ? ` Data notes: ${formatCaveats(payload.meta.sourceWarnings)}.`
          : ""}
        {payload?.meta.sourcePendingMetricContracts.length
          ? ` Not published yet: ${payload.meta.sourcePendingMetricContracts
              .map((contract) => contract.label)
              .join(", ")}.`
          : ""}
      </div>
      {payload ? (
        <footer className={styles.matrixFooter}>
          <div className={styles.matrixLegend} aria-label="Team source state legend">
            <span>
              Showing {payload.meta.rowCount} of {payload.meta.totalRankedRows} teams
            </span>
            <span className={styles.legendPill}>? Source pending/no sample</span>
            <span className={styles.legendPill}>~ Stale source</span>
            <span className={styles.legendPill}>! Raw context/caveat</span>
            <span className={styles.legendPill}>0 True zero</span>
          </div>
          <div className={styles.paginationControls}>
            <button
              type="button"
              disabled={payload.meta.page <= 1}
              onClick={() => onPageChange(payload.meta.page - 1)}
            >
              <span aria-hidden="true">‹ </span>Prev
            </button>
            <span>
              Page {payload.meta.page} of {payload.meta.pageCount}
            </span>
            <button
              type="button"
              disabled={payload.meta.page >= payload.meta.pageCount}
              onClick={() => onPageChange(payload.meta.page + 1)}
            >
              Next<span aria-hidden="true"> ›</span>
            </button>
            <label>
              Rows
              <select
                value={payload.meta.pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
              >
                {[10, 25, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
