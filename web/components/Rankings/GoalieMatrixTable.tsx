import type {
  GoalieMatrixMetricKey,
  GoalieMatrixResponse,
} from "lib/rankings/goalieMatrix";
import { formatToiClock } from "lib/rankings/rankingFormatters";
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
  selectedGoalieId: number | null;
  onSelectGoalie: (goalieId: number) => void;
  displayMode?: RankingsFilterState["displayMode"];
  density?: RankingsFilterState["density"];
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

function pctValue(value: number | null | undefined) {
  return value == null ? "N/A" : `${(value * 100).toFixed(1)}%`;
}

function goalieMetricState(
  cell: GoalieMatrixResponse["rows"][number]["metrics"][GoalieMatrixMetricKey],
  row: GoalieMatrixResponse["rows"][number],
  staleSource: boolean,
) {
  // Decision 98: below the visible floor the row is unranked by design.
  if (!row.sample.minimumSampleMet) {
    return { label: "Insufficient sample", marker: "L", className: styles.metricStateLowSample };
  }
  if (cell.qualifiedPeerCount === 0) {
    return { label: "No sample", marker: "?", className: styles.metricStateUnavailable };
  }
  if (cell.rawValue == null || cell.percentile == null) {
    return { label: "Source pending", marker: "?", className: styles.metricStateUnavailable };
  }
  if (staleSource) {
    return { label: "Stale source", marker: "~", className: styles.metricStateStale };
  }
  if (row.sample.confidence === "low") {
    return { label: "Low sample", marker: "L", className: styles.metricStateLowSample };
  }
  if (row.warnings.length > 0) {
    return { label: "Source caveat", marker: "!", className: styles.metricStateCaveat };
  }
  if (cell.rawValue === 0) {
    return { label: "True zero", marker: "0", className: styles.metricStateZero };
  }
  return null;
}

function GoalieMetricCell({
  cell,
  column,
  row,
  displayMode,
  staleSource,
}: {
  cell: GoalieMatrixResponse["rows"][number]["metrics"][GoalieMatrixMetricKey];
  column: GoalieMatrixResponse["meta"]["metricColumns"][number];
  row: GoalieMatrixResponse["rows"][number];
  displayMode: RankingsFilterState["displayMode"];
  staleSource: boolean;
}) {
  const insufficientSample = !row.sample.minimumSampleMet;
  const unavailable =
    cell.qualifiedPeerCount === 0 || cell.rawValue == null || cell.percentile == null;
  const effectiveStaleSource = staleSource && !unavailable;
  const state = goalieMetricState(cell, row, effectiveStaleSource);
  const title = [
    column.label,
    cell.formattedValue ? `Value ${cell.formattedValue}` : null,
    cell.rank == null ? null : `Rank ${cell.rank}`,
    cell.percentile == null ? null : `Percentile ${cell.percentile.toFixed(1)}%`,
    column.lowerIsBetter ? "Lower raw values are better" : null,
    effectiveStaleSource
      ? "Snapshot is older than latest available goalie matrix snapshot"
      : null,
    insufficientSample
      ? "Insufficient sample: below the minimum starts or shots, so not ranked"
      : row.sample.confidence === "low"
        ? "Low sample"
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
            {insufficientSample && cell.formattedValue
              ? cell.formattedValue
              : unavailable
                ? "N/A"
                : cell.formattedValue ?? "-"}
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

// Role cell: depth code on top (G1, G1A, G1B, G2) colour-coded by depth, meaning below
// ("Workhorse", "Tandem Lead"). Labels come from formatGoalieDeploymentBucket.
function GoalieRoleLabel({ label }: { label: string | null }) {
  if (!label) {
    return (
      <span className={styles.goalieRole} data-role-code="none">
        <strong>—</strong>
        <span>Unclassified</span>
      </span>
    );
  }
  const [code, ...rest] = label.split(" ");
  return (
    <span className={styles.goalieRole} data-role-code={code}>
      <strong>{code}</strong>
      <span>{rest.join(" ")}</span>
    </span>
  );
}

export default function GoalieMatrixTable({
  payload,
  isLoading,
  errorMessage,
  onSortMetric,
  onPageChange,
  onPageSizeChange,
  selectedGoalieId,
  onSelectGoalie,
  displayMode = "both",
  density = "detailed",
}: GoalieMatrixTableProps) {
  const metricColumnCount = payload?.meta.metricColumns.length ?? 0;
  const colSpan = 10 + metricColumnCount;
  const staleMatrixSnapshot =
    payload?.meta.snapshotDate != null &&
    payload.meta.latestAvailableSnapshotDate != null &&
    payload.meta.snapshotDate !== payload.meta.latestAvailableSnapshotDate;

  return (
    <section className={styles.matrixSection}>
      <ScrollRegion className={styles.matrixWrap} label="Goalie rankings matrix">
        <table
          className={`${styles.matrixTable} ${styles.matrixTableFlatHeader} ${density === "compact" ? styles.matrixCompact : ""}`}
        >
          <thead>
            <tr>
              <th className={styles.stickyRankCell} scope="col">Rank</th>
              <th className={styles.stickyPlayerCell} scope="col">Goalie</th>
              <th>Team</th>
              <th className={styles.goalieRoleHeader} scope="col">Role</th>
              <th>GP</th>
              <th>Starts</th>
              <th>Raw Start%</th>
              <th>Adj Start%</th>
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
                <tr
                  key={row.entity.id}
                  className={
                    row.entity.id === selectedGoalieId
                      ? styles.selectedMatrixRow
                      : undefined
                  }
                >
                  <td className={styles.stickyRankCell}>
                    <button
                      type="button"
                      className={styles.rowSelectButton}
                      aria-label={`Select ${row.entity.name ?? `Goalie ${row.entity.id}`}`}
                      aria-pressed={row.entity.id === selectedGoalieId}
                      onClick={() => onSelectGoalie(row.entity.id)}
                    >
                      {row.sort.rank ?? "-"}
                    </button>
                  </td>
                  <td className={styles.stickyPlayerCell}>
                    <div className={styles.playerCell}>
                      <span className={styles.playerIdentity}>
                        <strong>{row.entity.name ?? `Goalie ${row.entity.id}`}</strong>
                        <span>
                          {row.sample.minimumSampleMet
                            ? `Sample ${row.sample.confidence}`
                            : "Insufficient sample"}
                          {" · "}
                          Role {row.role.roleConfidence}
                          {row.role.confirmedStatus ? " · confirmed starter" : ""}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>{row.team.abbreviation ?? "-"}</td>
                  <td
                    className={styles.textCell}
                    title={row.role.roleNotes.join(" | ")}
                    aria-label={`${row.role.deploymentLabel ?? "Unclassified"} role, ${row.role.roleConfidence} confidence`}
                  >
                    <GoalieRoleLabel label={row.role.deploymentLabel} />
                  </td>
                  <td>{row.sample.gamesPlayed}</td>
                  <td>{row.sample.gamesStarted}</td>
                  <td>{pctValue(row.role.rawStartShare)}</td>
                  <td>{pctValue(row.role.adjustedStartShare)}</td>
                  <td>{row.sample.shotsAgainst}</td>
                  <td>{formatToiClock(row.sample.toiSeconds)}</td>
                  {payload.meta.metricColumns.map((column) => {
                    const cell = row.metrics[column.metricKey];
                    return (
                      <GoalieMetricCell
                        key={column.metricKey}
                        cell={cell}
                        column={column}
                        row={row}
                        displayMode={displayMode}
                        staleSource={Boolean(staleMatrixSnapshot)}
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
        {payload?.meta.sampleFloor ? `${payload.meta.sampleFloor.label} ` : ""}
        Roles come from projected season start share when available, otherwise
        from this window&apos;s starts among each team&apos;s top two goalies.
        Workload notes are estimates, not injury news.
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
          <div className={styles.matrixLegend} aria-label="Goalie source state legend">
            <span>
              Showing {payload.meta.rowCount} of {payload.meta.totalRankedRows} goalies
            </span>
            <span className={styles.legendPill}>? Source pending/no sample</span>
            <span className={styles.legendPill}>~ Stale source</span>
            <span className={styles.legendPill}>! Source caveat</span>
            <span className={styles.legendPill}>L Low or insufficient sample</span>
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
