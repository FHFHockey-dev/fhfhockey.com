import type {
  PlayerMatrixMetricCell,
  PlayerMatrixResponse,
  PlayerMatrixRow,
  PlayerMatrixRankScopes,
} from "lib/rankings/playerMatrix";
import {
  formatDeploymentLabel,
  formatToiClock,
} from "lib/rankings/rankingFormatters";
import type { ContextualRankingsSortDirection } from "lib/rankings/rankingTypes";
import type { RankingsFilterState } from "lib/rankings/rankingUrlState";
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
  displayMode?: RankingsFilterState["displayMode"];
  rankMode?: RankDisplayMode;
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

const PLAYER_PLACEHOLDER_SRC = "/pictures/player-placeholder.jpg";
const TEAM_LOGO_FALLBACK_SRC = "/teamLogos/FHFH.png";

type RankDisplayMode = "overall" | "deployment";

function rankScopeLabel(mode: RankDisplayMode) {
  return mode === "deployment" ? "Deployment" : "Overall";
}

function scopedRank(args: {
  rankScopes: PlayerMatrixRankScopes | undefined;
  fallbackRank: number | null;
  fallbackPercentile: number | null;
  fallbackPeerCount: number;
  mode: RankDisplayMode;
}) {
  const scope = args.rankScopes?.[args.mode];
  return {
    rank: scope?.rank ?? args.fallbackRank,
    percentile: scope?.percentile ?? args.fallbackPercentile,
    qualifiedPeerCount: scope?.qualifiedPeerCount ?? args.fallbackPeerCount,
    peerGroupKey: scope?.peerGroupKey ?? null,
  };
}

function metricCellTitle(
  cell: PlayerMatrixMetricCell,
  staleSource: boolean,
  rankMode: RankDisplayMode,
) {
  const rank = scopedRank({
    rankScopes: cell.rankScopes,
    fallbackRank: cell.rank,
    fallbackPercentile: cell.percentile,
    fallbackPeerCount: cell.qualifiedPeerCount,
    mode: rankMode,
  });
  const parts = [
    cell.fullLabel,
    cell.formattedValue ? `Value ${cell.formattedValue}` : null,
    rank.rank == null ? null : `${rankScopeLabel(rankMode)} Rank ${rank.rank}`,
    rank.percentile == null
      ? null
      : `${rankScopeLabel(rankMode)} Percentile ${rank.percentile.toFixed(1)}%`,
    cell.sampleConfidence === "low" ? "Low sample" : null,
    !rank.qualifiedPeerCount ? "No qualified peer sample" : null,
    rank.peerGroupKey ? `Peer group ${rank.peerGroupKey}` : null,
    staleSource
      ? "Snapshot is older than latest available matrix snapshot"
      : null,
    cell.lowerIsBetter ? "Lower raw values are better" : null,
    cell.availabilityReason,
    cell.sourceQualityFlags.length > 0
      ? `Caveats: ${cell.sourceQualityFlags.join(", ")}`
      : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function MatrixMetricCell({
  cell,
  latestSnapshotDate,
  rankMode,
  displayMode,
}: {
  cell: PlayerMatrixMetricCell;
  latestSnapshotDate: string | null;
  rankMode: RankDisplayMode;
  displayMode: RankingsFilterState["displayMode"];
}) {
  const unavailable =
    cell.availabilityState !== "available" || cell.availabilityReason;
  const staleSource =
    !unavailable &&
    latestSnapshotDate != null &&
    cell.snapshotDate != null &&
    cell.snapshotDate !== latestSnapshotDate;
  const rank = scopedRank({
    rankScopes: cell.rankScopes,
    fallbackRank: cell.rank,
    fallbackPercentile: cell.percentile,
    fallbackPeerCount: cell.qualifiedPeerCount,
    mode: rankMode,
  });
  const score =
    cell.availabilityState === "planned"
      ? "Planned"
      : unavailable
        ? "N/A"
        : formatPercentileScore(rank.percentile);
  const rankLabel = rank.rank == null ? "UR" : `#${rank.rank}`;
  const title = metricCellTitle(cell, staleSource, rankMode);
  const toneClass = unavailable
    ? styles.scoreToneMuted
    : getScoreTileTone(rank.percentile);
  const showValue = displayMode === "metric_value";

  return (
    <td className={styles.matrixMetricScoreCell}>
      {showValue ? (
        <span
          className={`${styles.metricValueTile} ${toneClass}`}
          title={title}
          aria-label={`${cell.fullLabel} value ${
            unavailable ? "not available" : (cell.formattedValue ?? "-")
          }`}
        >
          {unavailable ? "N/A" : (cell.formattedValue ?? "-")}
        </span>
      ) : (
        <div
          className={`${styles.matrixMetricCell} ${toneClass}`}
          title={title}
          aria-label={title}
        >
          <div className={styles.metricScoreStack}>
            <div className={styles.metricScoreTile}>
              <strong>{score}</strong>
            </div>
            <span className={styles.metricRankLine}>
              {unavailable ? "N/A" : rankLabel}
            </span>
          </div>
        </div>
      )}
    </td>
  );
}

function metricHeaderTitle(args: {
  column: PlayerMatrixResponse["meta"]["metricColumns"][number];
  displayMode: RankingsFilterState["displayMode"];
}) {
  return args.displayMode === "metric_value"
    ? `${args.column.fullLabel} novel score value`
    : args.column.tooltip;
}

function metricHeaderLabel(args: {
  column: PlayerMatrixResponse["meta"]["metricColumns"][number];
  displayMode: RankingsFilterState["displayMode"];
}) {
  return args.displayMode === "metric_value"
    ? `${args.column.shortLabel} Val`
    : args.column.shortLabel;
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

function teamLogoSrc(abbreviation: string | null) {
  return abbreviation
    ? `/teamLogos/${abbreviation}.png`
    : TEAM_LOGO_FALLBACK_SRC;
}

function deploymentToneClass(label: string) {
  switch (label) {
    case "L1":
    case "P1":
    case "PP1":
      return styles.deploymentBadgeGreen;
    case "L2":
    case "PP2":
      return styles.deploymentBadgeYellow;
    case "L3":
    case "P2":
      return styles.deploymentBadgeOrange;
    case "L4":
    case "P3":
      return styles.deploymentBadgeRed;
    case "PK1":
    case "PK2":
      return styles.deploymentBadgePk;
    default:
      return styles.deploymentBadgeMutedTone;
  }
}

function DeploymentBadges({
  deployment,
}: {
  deployment: PlayerMatrixRow["deployment"];
}) {
  const badgeCandidates: Array<{ key: string; label: string } | null> = [
    deployment.ev ? { key: "ev", label: String(deployment.ev) } : null,
    deployment.pp && deployment.pp !== "PP3"
      ? { key: "pp", label: String(deployment.pp) }
      : null,
    deployment.pk ? { key: "pk", label: String(deployment.pk) } : null,
  ];
  const badges = badgeCandidates.filter(
    (badge): badge is { key: string; label: string } => badge != null,
  );

  if (badges.length === 0) {
    return <span className={styles.deploymentBadgeMuted}>No deployment</span>;
  }

  return (
    <span
      className={styles.deploymentBadges}
      aria-label={`Deployment ${formatDeploymentLabel(deployment)}`}
    >
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={`${styles.deploymentBadge} ${deploymentToneClass(badge.label)}`}
        >
          {badge.label}
        </span>
      ))}
    </span>
  );
}

function ToiCell({
  sample,
  strength,
}: {
  sample: PlayerMatrixRow["sample"];
  strength: PlayerMatrixResponse["request"]["strength"];
}) {
  const selectedLabel = strength === "all" ? "ALL" : strength.toUpperCase();
  return (
    <td className={styles.toiCell}>
      <span className={styles.toiCellRow}>
        <b>{selectedLabel}</b>
        <span>{formatToiClock(sample.toiPerGameSeconds)}</span>
      </span>
      <span className={styles.toiCellRow}>
        <b>ALL</b>
        <span>
          {formatToiClock(sample.allStrengthsToiPerGameSeconds ?? null)}
        </span>
      </span>
    </td>
  );
}

function Row({
  row,
  payload,
  selected,
  rankMode,
  displayMode,
  onSelectPlayer,
}: {
  row: PlayerMatrixRow;
  payload: PlayerMatrixResponse;
  selected: boolean;
  rankMode: RankDisplayMode;
  displayMode: RankingsFilterState["displayMode"];
  onSelectPlayer: (playerId: number) => void;
}) {
  const sortRank = scopedRank({
    rankScopes: row.sort.rankScopes,
    fallbackRank: row.sort.rank,
    fallbackPercentile: row.sort.percentile,
    fallbackPeerCount: payload.meta.totalRankedRows,
    mode: rankMode,
  });
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
          {sortRank.rank ?? "-"}
        </button>
      </td>
      <td className={styles.stickyPlayerCell}>
        <div className={styles.playerCell}>
          <span className={styles.playerMedia} aria-hidden="true">
            <img
              className={styles.playerHeadshot}
              src={row.entity.imageUrl ?? PLAYER_PLACEHOLDER_SRC}
              alt=""
              onError={(event) => {
                event.currentTarget.src = PLAYER_PLACEHOLDER_SRC;
              }}
            />
            <img
              className={styles.playerTeamLogo}
              src={teamLogoSrc(row.team.abbreviation)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = TEAM_LOGO_FALLBACK_SRC;
              }}
            />
          </span>
          <span className={styles.playerIdentity}>
            <strong>{row.entity.name ?? `Player ${row.entity.id}`}</strong>
            <span>
              {row.entity.position ?? "-"} ·{" "}
              {row.team.name ?? row.team.abbreviation ?? "Team unavailable"}
            </span>
          </span>
          <DeploymentBadges deployment={row.deployment} />
        </div>
      </td>
      <td className={styles.sampleCell}>{row.sample.gamesPlayed ?? "-"}</td>
      <ToiCell sample={row.sample} strength={payload.request.strength} />
      {payload.meta.metricColumns.map((column) => (
        <MatrixMetricCell
          key={column.metricKey}
          cell={row.metrics[column.metricKey]}
          latestSnapshotDate={payload.meta.latestAvailableSnapshotDate}
          rankMode={rankMode}
          displayMode={displayMode}
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
  displayMode = "both",
  rankMode,
}: PlayerMatrixTableProps) {
  const activeRankMode = rankMode ?? "overall";
  const metricColumnCount = payload?.meta.metricColumns.length ?? 0;
  const colSpan = 4 + metricColumnCount;

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
              <th className={styles.sampleCell} scope="col" rowSpan={2}>
                GP
              </th>
              <th className={styles.toiCell} scope="col" rowSpan={2}>
                TOI/G
              </th>
              {(payload ? groupedHeaders(payload) : []).map((entry) => (
                <th
                  key={entry.group.key}
                  scope="colgroup"
                  colSpan={entry.columns.length}
                >
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
                  <th
                    key={column.metricKey}
                    className={styles.matrixMetricHeader}
                    scope="col"
                  >
                    <button
                      type="button"
                      className={styles.matrixSortButton}
                      aria-pressed={active}
                      title={metricHeaderTitle({ column, displayMode })}
                      onClick={() =>
                        onSortMetric(column.metricKey, nextDirection)
                      }
                    >
                      <span>{metricHeaderLabel({ column, displayMode })}</span>
                      {active ? (
                        <small>
                          {payload.meta.sortDirection === "asc"
                            ? "ASC"
                            : "DESC"}
                        </small>
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          {isLoading ? (
            <StateBody colSpan={colSpan} message="Loading matrix..." />
          ) : null}
          {!isLoading && errorMessage ? (
            <StateBody colSpan={colSpan} message={errorMessage} />
          ) : null}
          {!isLoading &&
          !errorMessage &&
          payload &&
          payload.rows.length === 0 ? (
            <StateBody
              colSpan={colSpan}
              message={
                payload.meta.message ?? "No players matched these filters."
              }
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
                  rankMode={activeRankMode}
                  displayMode={displayMode}
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
            <span>Color = better-than-peer percentile</span>
            {SCORE_TILE_LEGEND.map((band) => (
              <span
                key={band.label}
                className={`${styles.matrixColorBand} ${band.toneClass}`}
              >
                {band.label}
              </span>
            ))}
            <span className={styles.lowerBetterLegend}>
              Lower-is-better metrics still use better-is-greener percentile
              coloring
            </span>
            <span className={styles.legendPill}>Low sample = caution</span>
            <span className={styles.legendPill}>
              Planned/N/A = not live or not enough source data
            </span>
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
                onChange={(event) =>
                  onPageSizeChange(Number(event.target.value))
                }
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
