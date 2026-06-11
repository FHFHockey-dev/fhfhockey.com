import type {
  PlayerMatrixMetricCell,
  PlayerMatrixResponse,
  PlayerMatrixRow,
} from "lib/rankings/playerMatrix";
import {
  formatDeploymentLabel,
  formatToiClock,
} from "lib/rankings/rankingFormatters";
import type {
  ContextualRankingsSortDirection,
} from "lib/rankings/rankingTypes";
import {
  formatPercentileScore,
  getScoreTileTone,
} from "./matrixScoreFormatting";

import styles from "styles/Rankings.module.scss";

type PlayerMatrixTableProps = {
  payload: PlayerMatrixResponse | null;
  isLoading: boolean;
  errorMessage?: string;
  selectedPlayerId: number | null;
  onSelectPlayer: (playerId: number) => void;
  onSortMetric: (
    metricKey: string,
    direction: ContextualRankingsSortDirection,
  ) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const SCORE_TILE_LEGEND = [
  { label: "95-100", toneClass: styles.scoreTonePeak },
  { label: "90-94", toneClass: styles.scoreToneElite },
  { label: "80-89", toneClass: styles.scoreToneStrong },
  { label: "60-79", toneClass: styles.scoreTonePositive },
  { label: "40-59", toneClass: styles.scoreToneNeutral },
  { label: "20-39", toneClass: styles.scoreToneWeak },
  { label: "0-19", toneClass: styles.scoreTonePoor },
  { label: "N/A", toneClass: styles.scoreToneMuted },
];

function metricCellTitle(cell: PlayerMatrixMetricCell, staleSource: boolean) {
  const parts = [
    cell.fullLabel,
    cell.formattedValue ? `Value ${cell.formattedValue}` : null,
    cell.rank == null ? null : `Rank ${cell.rank}`,
    cell.percentile == null ? null : `Percentile ${cell.percentile.toFixed(1)}%`,
    cell.sampleConfidence === "low" ? "Low sample" : null,
    !cell.qualifiedPeerCount ? "No qualified peer sample" : null,
    staleSource ? "Snapshot is older than latest available matrix snapshot" : null,
    cell.lowerIsBetter ? "Lower raw values are better" : null,
    cell.availabilityReason,
    cell.sourceQualityFlags.length > 0
      ? `Caveats: ${cell.sourceQualityFlags.join(", ")}`
      : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function metricState(cell: PlayerMatrixMetricCell, staleSource: boolean) {
  if (cell.availabilityState === "planned") {
    return { label: "Planned", className: styles.metricStatePlanned };
  }
  if (cell.availabilityState === "unavailable" || cell.availabilityReason) {
    return {
      label: !cell.qualifiedPeerCount ? "No sample" : "Source pending",
      className: styles.metricStateUnavailable,
    };
  }
  if (staleSource) {
    return { label: "Stale source", className: styles.metricStateStale };
  }
  if (cell.sampleConfidence === "low" || cell.warnings.length > 0) {
    return { label: "Low sample", className: styles.metricStateLowSample };
  }
  if (cell.sourceQualityFlags.length > 0) {
    return { label: "Source caveat", className: styles.metricStateCaveat };
  }
  if (cell.rawValue === 0) {
    return { label: "True zero", className: styles.metricStateZero };
  }
  return null;
}

function MatrixMetricCell({
  cell,
  latestSnapshotDate,
}: {
  cell: PlayerMatrixMetricCell;
  latestSnapshotDate: string | null;
}) {
  const unavailable = cell.availabilityState !== "available" || cell.availabilityReason;
  const staleSource =
    !unavailable &&
    latestSnapshotDate != null &&
    cell.snapshotDate != null &&
    cell.snapshotDate !== latestSnapshotDate;
  const score =
    cell.availabilityState === "planned"
      ? "Planned"
      : unavailable
        ? "N/A"
        : formatPercentileScore(cell.percentile);
  const state = metricState(cell, staleSource);
  const rankLabel = cell.rank == null ? "UR" : `#${cell.rank}`;
  const valueLabel = cell.formattedValue ?? "-";
  return (
    <td>
      <div
        className={`${styles.matrixMetricCell} ${
          unavailable ? styles.scoreToneMuted : getScoreTileTone(cell.percentile)
        }`}
        title={metricCellTitle(cell, staleSource)}
        aria-label={metricCellTitle(cell, staleSource)}
      >
        <div className={styles.metricScoreStack}>
          <div className={styles.metricScoreTile}>
            <strong>{score}</strong>
          </div>
          <span className={styles.metricScoreMeta}>
            <span>{unavailable ? "N/A" : rankLabel}</span>
            <span aria-hidden="true">•</span>
            <span>{unavailable ? "N/A" : valueLabel}</span>
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

function sortMetricLabel(payload: PlayerMatrixResponse) {
  const column = payload.meta.metricColumns.find(
    (entry) => entry.metricKey === payload.meta.sortMetric,
  );
  return column?.shortLabel ?? payload.meta.sortMetric;
}

function sortDirectionForMetric(args: {
  metricKey: string;
  payload: PlayerMatrixResponse;
}): ContextualRankingsSortDirection {
  if (args.payload.meta.sortMetric !== args.metricKey) return "desc";
  return args.payload.meta.sortDirection === "desc" ? "asc" : "desc";
}

function groupedHeaders(payload: PlayerMatrixResponse) {
  return payload.meta.metricGroups
    .map((group) => ({
      group,
      columns: payload.meta.metricColumns.filter(
        (column) => column.groupKey === group.key,
      ),
    }))
    .filter((entry) => entry.columns.length > 0);
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

function Row({
  row,
  payload,
  selected,
  onSelectPlayer,
}: {
  row: PlayerMatrixRow;
  payload: PlayerMatrixResponse;
  selected: boolean;
  onSelectPlayer: (playerId: number) => void;
}) {
  return (
    <tr
      className={selected ? styles.selectedMatrixRow : undefined}
      onClick={() => onSelectPlayer(row.entity.id)}
    >
      <td className={styles.stickyRankCell}>
        <button
          type="button"
          className={styles.rowSelectButton}
          aria-pressed={selected}
          onClick={(event) => {
            event.stopPropagation();
            onSelectPlayer(row.entity.id);
          }}
        >
          {row.sort.rank ?? "-"}
        </button>
      </td>
      <td className={styles.stickyPlayerCell}>
        <div className={styles.playerCell}>
          <strong>{row.entity.name ?? `Player ${row.entity.id}`}</strong>
          <span>
            {row.entity.position ?? "-"} · {row.team.name ?? row.team.abbreviation ?? "Team unavailable"}
          </span>
        </div>
      </td>
      <td>{row.team.abbreviation ?? "-"}</td>
      <td>{row.entity.position ?? "-"}</td>
      <td>{row.sample.gamesPlayed ?? "-"}</td>
      <td>{formatToiClock(row.sample.toiPerGameSeconds)}</td>
      <td>{formatDeploymentLabel(row.deployment)}</td>
      {payload.meta.metricColumns.map((column) => (
        <MatrixMetricCell
          key={column.metricKey}
          cell={row.metrics[column.metricKey]}
          latestSnapshotDate={payload.meta.latestAvailableSnapshotDate}
        />
      ))}
    </tr>
  );
}

export default function PlayerMatrixTable({
  payload,
  isLoading,
  errorMessage,
  selectedPlayerId,
  onSelectPlayer,
  onSortMetric,
  onPageChange,
  onPageSizeChange,
}: PlayerMatrixTableProps) {
  const metricColumnCount = payload?.meta.metricColumns.length ?? 0;
  const colSpan = 7 + metricColumnCount;

  return (
    <section className={styles.matrixSection}>
      {payload?.meta.unavailableMetrics.length ? (
        <div className={styles.inlineNotice}>
          Some requested metrics are unavailable in this context:{" "}
          {payload.meta.unavailableMetrics
            .map((metric) => `${metric.label}: ${metric.reason}`)
            .join("; ")}
        </div>
      ) : null}
      <div className={styles.matrixWrap}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th
                className={styles.stickyRankCell}
                scope="col"
                rowSpan={2}
                title={
                  payload
                    ? `Sort rank by ${sortMetricLabel(payload)} percentile. Metric ties may share a raw rank.`
                    : "Sort rank"
                }
              >
                <span>Sort Rank</span>
                {payload ? <small>{sortMetricLabel(payload)}</small> : null}
              </th>
              <th className={styles.stickyPlayerCell} scope="col" rowSpan={2}>
                Player
              </th>
              <th scope="col" rowSpan={2}>Team</th>
              <th scope="col" rowSpan={2}>Pos</th>
              <th scope="col" rowSpan={2}>GP</th>
              <th scope="col" rowSpan={2}>TOI/G</th>
              <th scope="col" rowSpan={2}>Deployment</th>
              {(payload ? groupedHeaders(payload) : []).map((entry) => (
                <th key={entry.group.key} scope="colgroup" colSpan={entry.columns.length}>
                  {entry.group.label}
                </th>
              ))}
            </tr>
            <tr>
              {payload?.meta.metricColumns.map((column) => {
                const active = payload.meta.sortMetric === column.metricKey;
                const nextDirection = sortDirectionForMetric({
                  metricKey: column.metricKey,
                  payload,
                });
                return (
                  <th key={column.metricKey} scope="col">
                    <button
                      type="button"
                      className={styles.matrixSortButton}
                      aria-pressed={active}
                      title={column.tooltip}
                      onClick={() => onSortMetric(column.metricKey, nextDirection)}
                    >
                      <span>{column.shortLabel}</span>
                      {active ? (
                        <small>{payload.meta.sortDirection === "asc" ? "ASC" : "DESC"}</small>
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          {isLoading ? <StateBody colSpan={colSpan} message="Loading matrix..." /> : null}
          {!isLoading && errorMessage ? (
            <StateBody colSpan={colSpan} message={errorMessage} />
          ) : null}
          {!isLoading && !errorMessage && payload && payload.rows.length === 0 ? (
            <StateBody
              colSpan={colSpan}
              message={payload.meta.message ?? "No players matched these filters."}
            />
          ) : null}
          {!isLoading && !errorMessage && payload && payload.rows.length > 0 ? (
            <tbody>
              {payload.rows.map((row) => (
                <Row
                  key={row.entity.id}
                  row={row}
                  payload={payload}
                  selected={row.entity.id === selectedPlayerId}
                  onSelectPlayer={onSelectPlayer}
                />
              ))}
            </tbody>
          ) : null}
        </table>
      </div>
      {payload ? (
        <footer className={styles.matrixFooter}>
          <div className={styles.matrixLegend}>
            <span>
              Showing {payload.meta.rowCount} of {payload.meta.totalRankedRows}
            </span>
            <span>Color = percentile among qualified peers</span>
            {SCORE_TILE_LEGEND.map((band) => (
              <span
                key={band.label}
                className={`${styles.matrixColorBand} ${band.toneClass}`}
              >
                {band.label}
              </span>
            ))}
            <span className={styles.lowerBetterLegend}>
              Lower-is-better metrics still use better-is-greener percentile coloring
            </span>
            <span className={styles.legendPill}>Low sample = caution</span>
            <span className={styles.legendPill}>Planned/N/A = not live or not enough source data</span>
          </div>
          <div className={styles.paginationControls}>
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
            <label>
              Rows
              <select
                value={payload.meta.pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
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
