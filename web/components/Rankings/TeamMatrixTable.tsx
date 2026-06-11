import type {
  TeamMatrixMetricKey,
  TeamMatrixResponse,
} from "lib/rankings/teamMatrix";
import type { ContextualRankingsSortDirection } from "lib/rankings/rankingTypes";

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

export default function TeamMatrixTable({
  payload,
  isLoading,
  errorMessage,
  onSortMetric,
  onPageChange,
  onPageSizeChange,
}: TeamMatrixTableProps) {
  const metricColumnCount = payload?.meta.metricColumns.length ?? 0;
  const colSpan = 7 + metricColumnCount;

  return (
    <section className={styles.matrixSection}>
      <div className={styles.inlineNotice}>
        Team style caveat: badges are raw/contextual descriptors, not score- or
        venue-adjusted team traits.
        {payload?.meta.sourceWarnings.length
          ? ` ${payload.meta.sourceWarnings.join(" ")}.`
          : ""}
      </div>
      <div className={styles.matrixWrap}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th>Rank</th>
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
                <tr key={row.team.abbreviation}>
                  <td className={styles.stickyRankCell}>{row.sort.rank ?? "-"}</td>
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
                      <td key={column.metricKey}>
                        <div
                          className={`${styles.matrixMetricCell} ${getScoreTileTone(
                            cell.percentile,
                          )}`}
                          title={`${column.label}: ${
                            cell.formattedValue ?? "N/A"
                          } | Rank ${cell.rank ?? "UR"} | ${column.source}`}
                        >
                          <div className={styles.metricScoreStack}>
                            <div className={styles.metricScoreTile}>
                              <strong>{formatPercentileScore(cell.percentile)}</strong>
                            </div>
                            <span className={styles.metricScoreMeta}>
                              <span>{cell.rank == null ? "UR" : `#${cell.rank}`}</span>
                              <span aria-hidden="true">•</span>
                              <span>{cell.formattedValue ?? "-"}</span>
                            </span>
                          </div>
                          {row.warnings.length ? (
                            <span className={styles.metricStateChip}>
                              Raw context
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          )}
        </table>
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
