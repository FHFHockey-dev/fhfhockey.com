import type {
  GoalieMatrixMetricKey,
  GoalieMatrixResponse,
} from "lib/rankings/goalieMatrix";
import { formatToiClock } from "lib/rankings/rankingFormatters";
import type { ContextualRankingsSortDirection } from "lib/rankings/rankingTypes";

import {
  formatPercentileScore,
  getScoreTileTone,
} from "./matrixScoreFormatting";

import styles from "styles/Rankings.module.scss";

type GoalieMatrixTableProps = {
  payload: GoalieMatrixResponse | null;
  isLoading: boolean;
  errorMessage?: string;
  onSortMetric: (
    metricKey: GoalieMatrixMetricKey,
    direction: ContextualRankingsSortDirection,
  ) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

function sortDirectionForMetric(args: {
  metricKey: GoalieMatrixMetricKey;
  payload: GoalieMatrixResponse;
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

export default function GoalieMatrixTable({
  payload,
  isLoading,
  errorMessage,
  onSortMetric,
  onPageChange,
  onPageSizeChange,
}: GoalieMatrixTableProps) {
  const metricColumnCount = payload?.meta.metricColumns.length ?? 0;
  const colSpan = 7 + metricColumnCount;

  return (
    <section className={styles.matrixSection}>
      <div className={styles.inlineNotice}>
        Goalie role caveat: Start Share uses latest projection role context;
        emergency call-up denominator adjustment remains planned.
        {payload?.meta.sourceWarnings.length
          ? ` Source caveats: ${payload.meta.sourceWarnings.join(", ")}.`
          : ""}
      </div>
      <div className={styles.matrixWrap}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Goalie</th>
              <th>Team</th>
              <th>GP</th>
              <th>Starts</th>
              <th>Shots</th>
              <th>TOI</th>
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
            <StateBody message="Loading goalie rankings..." colSpan={colSpan} />
          ) : errorMessage ? (
            <StateBody message={errorMessage} colSpan={colSpan} />
          ) : !payload || payload.rows.length === 0 ? (
            <StateBody message="No goalie rankings match this filter." colSpan={colSpan} />
          ) : (
            <tbody>
              {payload.rows.map((row) => (
                <tr key={row.entity.id}>
                  <td className={styles.stickyRankCell}>
                    {row.sort.rank ?? "-"}
                  </td>
                  <td className={styles.stickyPlayerCell}>
                    <div className={styles.playerCell}>
                      <strong>{row.entity.name ?? `Goalie ${row.entity.id}`}</strong>
                      <span>
                        {row.sample.confidence} sample
                        {row.role.confirmedStatus ? " · confirmed starter" : ""}
                      </span>
                    </div>
                  </td>
                  <td>{row.team.abbreviation ?? "-"}</td>
                  <td>{row.sample.gamesPlayed}</td>
                  <td>{row.sample.gamesStarted}</td>
                  <td>{row.sample.shotsAgainst}</td>
                  <td>{formatToiClock(row.sample.toiSeconds)}</td>
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
                              {row.sample.minimumSampleMet ? "Source caveat" : "Low sample"}
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
            Showing {payload.meta.rowCount} of {payload.meta.totalRankedRows} goalies
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
