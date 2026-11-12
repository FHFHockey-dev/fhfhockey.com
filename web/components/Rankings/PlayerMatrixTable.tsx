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

import { formatCaveats } from "./caveatLabels";
import ScoreText from "./ScoreText";
import ScrollRegion from "./ScrollRegion";

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
  density?: RankingsFilterState["density"];
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
    cell.formattedValue
      ? COMPOSITE_METRIC_KEYS.has(cell.metricKey) && cell.metricKey !== "beast_tier"
        ? `Score ${cell.formattedValue} of 100 (a weighted score, not a percentile)`
        : `Value ${cell.formattedValue}`
      : null,
    rank.rank == null ? null : `${rankScopeLabel(rankMode)} Rank ${rank.rank}`,
    rank.percentile == null
      ? null
      : `${rankScopeLabel(rankMode)} Percentile ${rank.percentile.toFixed(1)}%`,
    cell.sampleConfidence === "low" ? "Below selected sample minimums or sample unavailable" : null,
    !rank.qualifiedPeerCount ? "No qualified peer sample" : null,
    rank.peerGroupKey ? `Peer group ${rank.peerGroupKey}` : null,
    staleSource
      ? "Snapshot is older than latest available matrix snapshot"
      : null,
    cell.lowerIsBetter ? "Lower raw values are better" : null,
    cell.availabilityReason,
    cell.sourceQualityFlags.length > 0
      ? `Caveats: ${formatCaveats(cell.sourceQualityFlags)}`
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
  // Composites are 0–100 scores, never formatted as percentiles (decision 74);
  // their cohort percentile only sets the tile tone.
  const isCompositeScore =
    COMPOSITE_METRIC_KEYS.has(cell.metricKey) && cell.metricKey !== "beast_tier";
  const score =
    cell.availabilityState === "planned"
      ? "Planned"
      : unavailable
        ? "N/A"
        : isCompositeScore
          ? cell.rawValue == null
            ? "N/A"
            : String(Math.round(cell.rawValue))
          : formatPercentileScore(rank.percentile);
  const rankLabel = rank.rank == null ? "–" : `#${rank.rank}`;
  const title = metricCellTitle(cell, staleSource, rankMode);
  const toneClass = unavailable
    ? styles.scoreToneMuted
    : getScoreTileTone(rank.percentile);
  const showValue = displayMode === "metric_value";
  // BEAST is a tier only the top players earn; a scored player without one is not missing data.
  const noBeastTier =
    cell.metricKey === "beast_tier" &&
    cell.availabilityState === "unavailable" &&
    cell.rawValue != null;

  if (noBeastTier) {
    return (
      <td className={styles.matrixMetricScoreCell}>
        <span
          className={styles.matrixNoTier}
          title="No BEAST tier"
          aria-label={`${cell.fullLabel}: no tier`}
        >
          –
        </span>
      </td>
    );
  }

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
              <strong>
                <ScoreText label={score} />
              </strong>
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
  const playerName = row.entity.name ?? `Player ${row.entity.id}`;
  return (
    <tr className={selected ? styles.selectedMatrixRow : undefined}>
      <td className={styles.stickyRankCell}>
        <button
          type="button"
          className={styles.rowSelectButton}
          aria-label={`Select ${playerName}`}
          aria-pressed={selected}
          onClick={() => onSelectPlayer(row.entity.id)}
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
            <strong>{playerName}</strong>
            <span>
              {row.entity.position ?? "-"} ·{" "}
              <span className={styles.teamNameFull}>
                {row.team.name ?? row.team.abbreviation ?? "Team unavailable"}
              </span>
              <span className={styles.teamNameShort}>
                {row.team.abbreviation ?? row.team.name ?? "-"}
              </span>
              {/* Phones show the badge in this line; only one copy is displayed at a time. */}
              <span className={styles.metaBadges}>
                {" · "}
                <DeploymentBadges deployment={row.deployment} />
              </span>
            </span>
          </span>
          <span className={styles.rowBadges}>
            <DeploymentBadges deployment={row.deployment} />
          </span>
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

// Composite scores publish separately; when a season has none yet, every row is unavailable.
// Drop those columns (never the active sort column) and say so once in the footer.
const COMPOSITE_METRIC_KEYS = new Set([
  "offense_rating",
  "defense_rating",
  "mcm_score",
  "beast_tier",
]);

function hideUnpublishedComposites(payload: PlayerMatrixResponse | null) {
  if (!payload || payload.rows.length === 0) return { payload, hidden: [] as string[] };
  const hiddenColumns = payload.meta.metricColumns.filter(
    (column) =>
      COMPOSITE_METRIC_KEYS.has(column.metricKey) &&
      column.metricKey !== payload.meta.sortMetric &&
      payload.rows.every((row) => {
        const cell = row.metrics[column.metricKey];
        // A BEAST cell with a score but no tier is published; only scoreless cells count.
        return cell?.availabilityState === "unavailable" && cell.rawValue == null;
      }),
  );
  if (hiddenColumns.length === 0) return { payload, hidden: [] as string[] };
  const hiddenKeys = new Set(hiddenColumns.map((column) => column.metricKey));
  return {
    payload: {
      ...payload,
      meta: {
        ...payload.meta,
        metricColumns: payload.meta.metricColumns.filter(
          (column) => !hiddenKeys.has(column.metricKey),
        ),
      },
    },
    hidden: hiddenColumns.map((column) => column.shortLabel),
  };
}

function seasonLabel(season: number) {
  const start = Math.floor(season / 10000);
  return `${start}\u2013${String(start + 1).slice(2)}`;
}

export default function PlayerMatrixTable({
  payload: rawPayload,
  isLoading,
  errorMessage,
  selectedPlayerId,
  onSelectPlayer,
  onSortMetric,
  onPageChange,
  onPageSizeChange,
  displayMode = "both",
  density = "detailed",
  rankMode,
}: PlayerMatrixTableProps) {
  const { payload, hidden: hiddenComposites } = hideUnpublishedComposites(rawPayload);
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
      <ScrollRegion className={styles.matrixWrap} label="Skater rankings matrix">
        <table
          className={`${styles.matrixTable} ${density === "compact" ? styles.matrixCompact : ""}`}
        >
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
                <span>Rank</span>
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
                          <span aria-hidden="true">
                            {payload.meta.sortDirection === "asc" ? "▲" : "▼"}
                          </span>
                          <span className={styles.visuallyHidden}>
                            {payload.meta.sortDirection === "asc"
                              ? " ascending"
                              : " descending"}
                          </span>
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
      </ScrollRegion>
      {payload ? (
        <footer className={styles.matrixFooter}>
          <div className={styles.matrixLegend}>
            <span>
              Showing {payload.meta.rowCount} of {payload.meta.totalRankedRows}
            </span>
            <span>Percentile vs peers</span>
            {SCORE_TILE_LEGEND.map((band) => (
              <span
                key={band.label}
                className={`${styles.matrixColorBand} ${band.toneClass}`}
              >
                {band.label}
              </span>
            ))}
            {hiddenComposites.length ? (
              <span className={styles.matrixLegendNote}>
                {hiddenComposites.join(", ")} not published for{" "}
                {seasonLabel(payload.request.season)} yet
              </span>
            ) : null}
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
