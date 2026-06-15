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
};

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
  staleSource: boolean,
) {
  if (cell.qualifiedPeerCount === 0) {
    return { label: "No sample", className: styles.metricStateUnavailable };
  }
  if (cell.rawValue == null || cell.percentile == null) {
    return { label: "Source pending", className: styles.metricStateUnavailable };
  }
  if (staleSource) {
    return { label: "Stale source", className: styles.metricStateStale };
  }
  if (row.warnings.length > 0) {
    return { label: "Raw context", className: styles.metricStateCaveat };
  }
  if (cell.rawValue === 0) {
    return { label: "True zero", className: styles.metricStateZero };
  }
  return null;
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
  const state = teamMetricState(cell, row, staleSource);
  const title = [
    column.label,
    cell.formattedValue ? `Value ${cell.formattedValue}` : null,
    cell.rank == null ? null : `Rank ${cell.rank}`,
    cell.percentile == null ? null : `Percentile ${cell.percentile.toFixed(1)}%`,
    column.lowerIsBetter ? "Lower raw values are better" : null,
    staleMatrixSnapshot ? "Snapshot is older than latest available team matrix snapshot" : null,
    staleStyleSource
      ? `Team style source ${row.record.styleSnapshotDate} differs from team power snapshot ${row.record.latestPowerDate}`
      : null,
    row.warnings.length ? `Caveats: ${row.warnings.join(", ")}` : null,
    column.source,
  ].filter(Boolean).join(" | ");
  const percentileLabel = formatPercentileScore(cell.percentile);
  const rankLabel = cell.rank == null ? "UR" : `#${cell.rank}`;
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
            <strong>{primaryLabel}</strong>
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
          <span className={`${styles.metricStateChip} ${state.className}`}>
            {state.label}
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
      <div className={styles.matrixWrap}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th>Sort Rank</th>
              <th>Team</th>
              <th>Style</th>
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
                  onClick={() => onSelectTeam(row.team.abbreviation)}
                >
                  <td className={styles.stickyRankCell}>
                    <button
                      type="button"
                      className={styles.rowSelectButton}
                      aria-pressed={
                        row.team.abbreviation.toUpperCase() === normalizedSelectedTeam
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectTeam(row.team.abbreviation);
                      }}
                    >
                      {row.sort.rank ?? "-"}
                    </button>
                  </td>
                  <td className={styles.stickyPlayerCell}>
                    <div className={styles.playerCell}>
                      <strong>{row.team.abbreviation}</strong>
                      <span>{row.team.name ?? "Team name unavailable"}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.playerCell}>
                      <strong>{row.style.label}</strong>
                      <span>{row.style.source}</span>
                    </div>
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
      </div>
      <div className={styles.inlineNotice}>
        Team style caveat: badges are raw/contextual descriptors, not score- or
        venue-adjusted team traits.
        {payload?.meta.sourceWarnings.length
          ? ` ${payload.meta.sourceWarnings.join(" ")}.`
          : ""}
      </div>
      {payload ? (
        <footer className={styles.matrixFooter}>
          <span>
            Showing {payload.meta.rowCount} of {payload.meta.totalRankedRows} teams
          </span>
          <div>
            <button
              type="button"
              disabled={payload.meta.page <= 1}
              onClick={() => onPageChange(payload.meta.page - 1)}
            >
              Prev
            </button>
            <span>
              Page {payload.meta.page} of {payload.meta.pageCount}
            </span>
            <button
              type="button"
              disabled={payload.meta.page >= payload.meta.pageCount}
              onClick={() => onPageChange(payload.meta.page + 1)}
            >
              Next
            </button>
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
          </div>
        </footer>
      ) : null}
    </section>
  );
}
