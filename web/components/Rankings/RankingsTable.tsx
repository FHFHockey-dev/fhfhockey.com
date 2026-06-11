import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
  ContextualRankingsSortDirection,
  ContextualRankingsSortKey,
} from "lib/rankings/rankingTypes";
import type { ReactNode } from "react";
import {
  formatDeploymentLabel,
  formatPercentile,
  formatRank,
  formatSampleConfidence,
  formatToiClock,
} from "lib/rankings/rankingFormatters";

import RankingExplanation from "./RankingExplanation";

import styles from "styles/Rankings.module.scss";

type RankingsTableProps = {
  rows: ContextualRankingApiRow[];
  request: ContextualRankingsRequest;
  sort: ContextualRankingsSortKey;
  direction: ContextualRankingsSortDirection;
  isLoading: boolean;
  errorMessage?: string;
  unavailableMessage?: string | null;
  emptyMessage?: string;
  onSort: (sort: ContextualRankingsSortKey) => void;
  selectedEntityIds?: readonly number[];
  onToggleComparison?: (entityId: number) => void;
};

const SORTABLE_COLUMNS: Array<{
  key: ContextualRankingsSortKey;
  label: string;
}> = [
  { key: "gp", label: "GP" },
  { key: "toi_per_game", label: "TOI/G" },
  { key: "metric_value", label: "Metric Value" },
  { key: "raw_rank", label: "Raw Rank" },
  { key: "percentile", label: "Percentile" },
];

function sortLabel(args: {
  label: string;
  key: ContextualRankingsSortKey;
  activeSort: ContextualRankingsSortKey;
  direction: ContextualRankingsSortDirection;
}) {
  if (args.key !== args.activeSort) return `Sort by ${args.label}`;
  return `Sort by ${args.label} (${args.direction === "asc" ? "ascending" : "descending"})`;
}

function SortableHeader(props: {
  column: (typeof SORTABLE_COLUMNS)[number];
  activeSort: ContextualRankingsSortKey;
  direction: ContextualRankingsSortDirection;
  onSort: (sort: ContextualRankingsSortKey) => void;
}) {
  const active = props.column.key === props.activeSort;
  return (
    <th scope="col">
      <button
        type="button"
        className={styles.sortButton}
        aria-pressed={active}
        onClick={() => props.onSort(props.column.key)}
      >
        <span>
          {props.column.label}
          {active ? (props.direction === "asc" ? " ASC" : " DESC") : ""}
        </span>
        <span className={styles.visuallyHidden}>
          {sortLabel({
            label: props.column.label,
            key: props.column.key,
            activeSort: props.activeSort,
            direction: props.direction,
          })}
        </span>
      </button>
    </th>
  );
}

function Badge({ label, tone }: { label: string; tone?: "warning" | "muted" }) {
  return (
    <span
      className={`${styles.badge} ${
        tone === "warning" ? styles.warningBadge : tone === "muted" ? styles.mutedBadge : ""
      }`}
    >
      {label}
    </span>
  );
}

function StateRow({ children }: { children: ReactNode }) {
  return (
    <tbody>
      <tr>
        <td colSpan={13} className={styles.tableStateCell}>
          {children}
        </td>
      </tr>
    </tbody>
  );
}

export default function RankingsTable({
  rows,
  request,
  sort,
  direction,
  isLoading,
  errorMessage,
  unavailableMessage,
  emptyMessage = "No skaters matched these filters.",
  onSort,
  selectedEntityIds = [],
  onToggleComparison,
}: RankingsTableProps) {
  const hasSmallPeerGroup = rows.some((row) =>
    row.warnings.includes("small_peer_group"),
  );
  const selectedEntityIdSet = new Set(selectedEntityIds);

  return (
    <>
      {hasSmallPeerGroup ? (
        <div className={styles.inlineNotice}>
          Small peer group: percentile values can move sharply when the filter is
          narrow.
        </div>
      ) : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Compare</th>
              <th scope="col">Player</th>
              <th scope="col">Team</th>
              <th scope="col">Pos</th>
              <th scope="col">Deployment</th>
              {SORTABLE_COLUMNS.map((column) => (
                <SortableHeader
                  key={column.key}
                  column={column}
                  activeSort={sort}
                  direction={direction}
                  onSort={onSort}
                />
              ))}
              <th scope="col">Trend</th>
              <th scope="col">Tags</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          {isLoading ? <StateRow>Loading rankings...</StateRow> : null}
          {!isLoading && errorMessage ? <StateRow>{errorMessage}</StateRow> : null}
          {!isLoading && !errorMessage && unavailableMessage ? (
            <StateRow>{unavailableMessage}</StateRow>
          ) : null}
          {!isLoading &&
          !errorMessage &&
          !unavailableMessage &&
          rows.length === 0 ? (
            <StateRow>{emptyMessage}</StateRow>
          ) : null}
          {!isLoading && !errorMessage && !unavailableMessage && rows.length > 0 ? (
            <tbody>
              {rows.map((row) => {
                const belowMinimum = !row.sample.minimumSampleMet;
                return (
                  <tr key={row.entity.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedEntityIdSet.has(row.entity.id)}
                        disabled={!onToggleComparison}
                        aria-label={`Compare ${row.entity.name ?? `Player ${row.entity.id}`}`}
                        onChange={() => onToggleComparison?.(row.entity.id)}
                      />
                    </td>
                    <td>
                      <div className={styles.playerCell}>
                        <strong>{row.entity.name ?? `Player ${row.entity.id}`}</strong>
                        <span>{row.team.name ?? "Team unavailable"}</span>
                      </div>
                    </td>
                    <td>{row.team.abbreviation ?? "-"}</td>
                    <td>{row.entity.position ?? "-"}</td>
                    <td>{formatDeploymentLabel(row.deployment)}</td>
                    <td>{row.sample.gamesPlayed ?? "-"}</td>
                    <td>{formatToiClock(row.sample.toiPerGameSeconds)}</td>
                    <td>{row.metric.formattedValue ?? "-"}</td>
                    <td>{formatRank(row.metric.rawRank)}</td>
                    <td>{formatPercentile(row.metric.percentile)}</td>
                    <td>
                      <span className={styles.muted}>Soon</span>
                    </td>
                    <td>
                      <div className={styles.tags}>
                        <Badge
                          label={`${formatSampleConfidence(row.sample.confidence)} sample`}
                          tone={belowMinimum ? "warning" : undefined}
                        />
                        {row.tags.map((tag) => (
                          <Badge key={tag} label={tag} tone="muted" />
                        ))}
                        {row.warnings.includes("small_peer_group") ? (
                          <Badge label="Small peer" tone="warning" />
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <details className={styles.details}>
                        <summary>Explain</summary>
                        <RankingExplanation row={row} request={request} />
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ) : null}
        </table>
      </div>
    </>
  );
}
