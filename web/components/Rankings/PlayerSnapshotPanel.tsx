import type {
  PlayerMatrixMetricCell,
  PlayerMatrixResponse,
  PlayerMatrixRow,
  PlayerMatrixRankScope,
  PlayerMatrixRankScopes,
} from "lib/rankings/playerMatrix";
import {
  formatDeploymentLabel,
  formatPercentile,
  formatToiClock,
} from "lib/rankings/rankingFormatters";
import {
  DEFENSE_RATING_CONTRACT,
  MCM_SCORE_CONTRACT,
  OFFENSE_RATING_CONTRACT,
  RESULTS_LUCK_INDEX_CONTRACT,
  SKATER_COMPOSITE_SOURCE_TABLE,
} from "lib/rankings/skaterCompositeMethodology";

import styles from "styles/Rankings.module.scss";

type SnapshotRankMode = "overall" | "deployment";

type PlayerSnapshotPanelProps = {
  payload: PlayerMatrixResponse | null;
  selectedPlayerId: number | null;
  snapshotRow?: PlayerMatrixRow | null;
  label?: string;
  rankMode?: SnapshotRankMode;
};

const SNAPSHOT_METRICS = [
  "goals_per_60",
  "points_per_60",
  "ixg_per_60",
  "sog_per_60",
  "shot_attempts_per_60",
  "xga_per_60",
  "on_ice_xgf_percentage",
  "hits_per_60",
  "blocks_per_60",
] as const;

const PLAYER_PLACEHOLDER_SRC = "/pictures/player-placeholder.jpg";
const TEAM_LOGO_FALLBACK_SRC = "/teamLogos/FHFH.png";

function selectedRow(
  payload: PlayerMatrixResponse | null,
  selectedPlayerId: number | null,
  snapshotRow: PlayerMatrixRow | null | undefined,
) {
  if (
    snapshotRow &&
    (selectedPlayerId == null || snapshotRow.entity.id === selectedPlayerId)
  ) {
    return snapshotRow;
  }
  if (!payload) return null;
  if (selectedPlayerId != null) {
    return payload.rows.find((row) => row.entity.id === selectedPlayerId) ?? null;
  }
  return payload.rows[0] ?? null;
}

type SnapshotMetricCell = {
  cell: PlayerMatrixMetricCell;
  scope: PlayerMatrixRankScope;
};

function scopedRank(args: {
  rankScopes: PlayerMatrixRankScopes | undefined;
  fallbackRank: number | null;
  fallbackPercentile: number | null;
  fallbackPeerCount: number;
  mode: SnapshotRankMode;
}): PlayerMatrixRankScope {
  const scope = args.rankScopes?.[args.mode];
  return {
    rank: scope?.rank ?? args.fallbackRank,
    percentile: scope?.percentile ?? args.fallbackPercentile,
    qualifiedPeerCount: scope?.qualifiedPeerCount ?? args.fallbackPeerCount,
    peerGroupKey: scope?.peerGroupKey ?? null,
  };
}

function scopeLabel(mode: SnapshotRankMode) {
  return mode === "deployment" ? "deployment" : "overall";
}

function metricScope(
  cell: PlayerMatrixMetricCell,
  rankMode: SnapshotRankMode,
) {
  return scopedRank({
    rankScopes: cell.rankScopes,
    fallbackRank: cell.rank,
    fallbackPercentile: cell.percentile,
    fallbackPeerCount: cell.qualifiedPeerCount,
    mode: rankMode,
  });
}

function availableMetricCells(
  row: PlayerMatrixRow,
  rankMode: SnapshotRankMode,
): SnapshotMetricCell[] {
  return Object.values(row.metrics)
    .map((cell) => ({ cell, scope: metricScope(cell, rankMode) }))
    .filter(
      (entry) =>
        entry.cell.availabilityState === "available" &&
        entry.scope.percentile != null,
    )
    .sort((a, b) => (b.scope.percentile ?? 0) - (a.scope.percentile ?? 0));
}

function topStrengths(row: PlayerMatrixRow, rankMode: SnapshotRankMode) {
  const cells = availableMetricCells(row, rankMode);
  const elite = cells
    .filter((entry) => (entry.scope.percentile ?? 0) >= 80)
    .slice(0, 4);
  return elite.length > 0 ? elite : cells.slice(0, 3);
}

function weakSpots(row: PlayerMatrixRow, rankMode: SnapshotRankMode) {
  return availableMetricCells(row, rankMode)
    .sort((a, b) => (a.scope.percentile ?? 0) - (b.scope.percentile ?? 0))
    .filter((entry) => (entry.scope.percentile ?? 0) <= 39)
    .slice(0, 4);
}

function caveats(row: PlayerMatrixRow) {
  const notes = new Set<string>();
  if (row.sample.confidence === "low" || !row.sample.minimumSampleMet) {
    notes.add("Low sample: treat percentiles as directional.");
  }
  if (row.warnings.includes("small_peer_group")) {
    notes.add("Small peer group: rankings can move sharply with narrow filters.");
  }
  Object.values(row.metrics).forEach((cell) => {
    if (cell.availabilityState === "planned") {
      notes.add(`${cell.shortLabel}: planned metric is not live.`);
    }
    if (cell.availabilityState === "unavailable" && cell.availabilityReason) {
      notes.add(`${cell.shortLabel}: ${cell.availabilityReason}`);
    }
    if (cell.sourceQualityFlags.length > 0) {
      notes.add(`${cell.shortLabel}: source caveat applies.`);
    }
  });
  return Array.from(notes).slice(0, 5);
}

function profileSummary(row: PlayerMatrixRow, rankMode: SnapshotRankMode) {
  const strengths = topStrengths(row, rankMode);
  const weak = weakSpots(row, rankMode);
  if (!strengths.length) return "No live percentile strengths are available in this context.";

  const leader = strengths[0];
  const strengthText = `${leader.cell.fullLabel} (${formatPercentile(leader.scope.percentile)} ${scopeLabel(rankMode)})`;
  if (!weak.length) {
    return `Best live signal is ${strengthText}; no major weak spot appears in the visible metric set.`;
  }
  return `Best live signal is ${strengthText}; weakest visible area is ${weak[0].cell.fullLabel} (${formatPercentile(weak[0].scope.percentile)} ${scopeLabel(rankMode)}).`;
}

function sourceState(cell: PlayerMatrixMetricCell) {
  if (cell.availabilityState === "planned") return "planned";
  if (cell.availabilityState === "unavailable") return "source pending";
  if (cell.sourceQualityFlags.length > 0) return "source caveat";
  return "available";
}

function metricBullet(
  entry: SnapshotMetricCell,
  mode: "strength" | "weakness",
  rankMode: SnapshotRankMode,
) {
  const { cell, scope } = entry;
  const rank =
    scope.rank == null
      ? "unranked"
      : `rank ${scope.rank} of ${scope.qualifiedPeerCount || "unknown"}`;
  const raw = cell.formattedValue == null ? "" : ` · value ${cell.formattedValue}`;
  const peer = scope.peerGroupKey ? ` · peer group ${scope.peerGroupKey}` : "";
  const sample = ` · sample ${cell.sampleConfidence}`;
  const source = ` · source ${sourceState(cell)}`;
  const qualifier = cell.lowerIsBetter
    ? mode === "strength"
      ? "suppression"
      : "higher-against raw value"
    : mode === "strength"
      ? "production"
      : "lower peer output";
  return `${cell.fullLabel}: ${formatPercentile(scope.percentile)} ${scopeLabel(rankMode)} percentile, ${rank}${peer}${raw}${sample}${source} (${qualifier}).`;
}

function MetricList({
  title,
  cells,
  emptyText,
  mode,
  rankMode,
}: {
  title: string;
  cells: SnapshotMetricCell[];
  emptyText: string;
  mode: "strength" | "weakness";
  rankMode: SnapshotRankMode;
}) {
  return (
    <section className={styles.snapshotBullets}>
      <h3>{title}</h3>
      {cells.length > 0 ? (
        <ul>
          {cells.map((entry) => (
            <li key={entry.cell.metricKey}>
              {metricBullet(entry, mode, rankMode)}
            </li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function snapshotMetricCells(
  row: PlayerMatrixRow,
  rankMode: SnapshotRankMode,
): SnapshotMetricCell[] {
  const preferred = SNAPSHOT_METRICS.flatMap((metricKey) => {
    const cell = row.metrics[metricKey];
    return cell ? [{ cell, scope: metricScope(cell, rankMode) }] : [];
  });
  if (preferred.length > 0) return preferred;
  return availableMetricCells(row, rankMode).slice(0, 8);
}

function statusLabel(value: number | string | null | undefined) {
  return value == null || value === "" ? "Source pending" : String(value);
}

function compositeCards(row: PlayerMatrixRow) {
  const source =
    row.composite == null
      ? "Source pending"
      : `${SKATER_COMPOSITE_SOURCE_TABLE} · ${row.composite.methodologyVersion ?? "methodology pending"}`;
  const snapshot = row.composite?.snapshotDate
    ? ` Snapshot ${row.composite.snapshotDate}.`
    : "";
  return [
    {
      title: "Offense Rating",
      value: row.composite?.offenseRating == null ? null : row.composite.offenseRating.toFixed(1),
      text: row.composite?.offenseRating == null
        ? "Unavailable until composite source is populated"
        : `${OFFENSE_RATING_CONTRACT.label}: deployment-peer percentile composite from ${source}.${snapshot}`,
    },
    {
      title: "Defensive Impact",
      value: row.composite?.defenseRating == null ? null : row.composite.defenseRating.toFixed(1),
      text: row.composite?.defenseRating == null
        ? "Unavailable until composite source is populated"
        : `${DEFENSE_RATING_CONTRACT.label}: context-influenced defensive composite from ${source}.${snapshot}`,
    },
    {
      title: "MCM / BEAST",
      value: row.composite?.beastTier
        ? `${row.composite.beastTier} · ${row.composite.mcmScore?.toFixed(1) ?? "-"}`
        : row.composite?.mcmScore?.toFixed(1) ?? null,
      text: row.composite?.mcmScore == null
        ? "Source pending"
        : `${MCM_SCORE_CONTRACT.label}: current-contract fantasy multi-category composite from ${source}; PP points source-pending.${snapshot}`,
    },
    {
      title: "Results Luck Index",
      value: row.composite?.resultsLuckIndex == null
        ? null
        : row.composite.resultsLuckIndex.toFixed(1),
      text: row.composite?.resultsLuckIndex == null
        ? "Source pending until selected-window-excluded baseline provenance is available"
        : `${RESULTS_LUCK_INDEX_CONTRACT.label}: 100-centered selected-window results context from ${source}.${snapshot}`,
    },
  ];
}

function teamLogoSrc(abbreviation: string | null) {
  return abbreviation ? `/teamLogos/${abbreviation}.png` : TEAM_LOGO_FALLBACK_SRC;
}

export default function PlayerSnapshotPanel({
  payload,
  selectedPlayerId,
  snapshotRow,
  label = "Player snapshot",
  rankMode = "overall",
}: PlayerSnapshotPanelProps) {
  const row = selectedRow(payload, selectedPlayerId, snapshotRow);

  if (!row) {
    return (
      <aside className={styles.snapshotPanel} aria-label={label}>
        <h2>Player Snapshot</h2>
        <p className={styles.snapshotMuted}>Select a row to inspect player context.</p>
      </aside>
    );
  }

  const strengths = topStrengths(row, rankMode);
  const weaknesses = weakSpots(row, rankMode);
  const caveatItems = caveats(row);
  const metricCells = snapshotMetricCells(row, rankMode);
  const cards = compositeCards(row);

  return (
    <aside className={styles.snapshotPanel} aria-label={label}>
      <header className={styles.snapshotHeader}>
        <div className={styles.snapshotAvatar}>
          <img
            src={row.entity.imageUrl ?? PLAYER_PLACEHOLDER_SRC}
            alt={`${row.entity.name ?? `Player ${row.entity.id}`} headshot`}
            onError={(event) => {
              event.currentTarget.src = PLAYER_PLACEHOLDER_SRC;
            }}
          />
          <img
            className={styles.snapshotTeamLogo}
            src={teamLogoSrc(row.team.abbreviation)}
            alt={`${row.team.name ?? row.team.abbreviation ?? "Team"} logo`}
            onError={(event) => {
              event.currentTarget.src = TEAM_LOGO_FALLBACK_SRC;
            }}
          />
        </div>
        <div>
          <h2>{row.entity.name ?? `Player ${row.entity.id}`}</h2>
          <p>
            {row.entity.position ?? "-"} · {row.team.name ?? row.team.abbreviation ?? "-"}
          </p>
        </div>
      </header>

      <dl className={styles.snapshotFacts}>
        <div>
          <dt>Deployment</dt>
          <dd>{formatDeploymentLabel(row.deployment)}</dd>
        </div>
        <div>
          <dt>GP</dt>
          <dd>{row.sample.gamesPlayed ?? "-"}</dd>
        </div>
        <div>
          <dt>TOI/G</dt>
          <dd>{formatToiClock(row.sample.toiPerGameSeconds)}</dd>
        </div>
        <div>
          <dt>Sample</dt>
          <dd>{row.sample.confidence}</dd>
        </div>
      </dl>

      <section className={styles.snapshotProfile}>
        <h3>Profile Read</h3>
        <p>{profileSummary(row, rankMode)}</p>
      </section>

      <MetricList
        title="Live Strengths"
        cells={strengths}
        emptyText="No live strengths are available for this filter set."
        mode="strength"
        rankMode={rankMode}
      />

      <MetricList
        title="Weak Spots"
        cells={weaknesses}
        emptyText="No sub-40th percentile weak spot appears in the visible metric set."
        mode="weakness"
        rankMode={rankMode}
      />

      <section className={styles.snapshotCaveats}>
        <h3>Sample & Source Notes</h3>
        {caveatItems.length > 0 ? (
          <ul>
            {caveatItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>No live caveats beyond normal contextual ranking variance.</p>
        )}
      </section>

      <section className={styles.snapshotMetricBars} aria-label="Key advanced metrics">
        <h3>Key Metric Percentiles</h3>
        {metricCells.map(({ cell, scope }) => {
          const pct = scope.percentile ?? 0;
          return (
            <div key={cell.metricKey} className={styles.snapshotMetricBar}>
              <span>{cell.shortLabel}</span>
              <div>
                <i style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
              </div>
              <strong>
                {cell.availabilityState === "available"
                  ? formatPercentile(scope.percentile)
                  : "N/A"}
              </strong>
            </div>
          );
        })}
      </section>

      <section className={styles.snapshotScores} aria-label="Composite status">
        <h3>Composite Status</h3>
        <div>
          {cards.map((card) => (
            <article key={card.title} className={styles.snapshotScoreCard}>
              <span>{card.title}</span>
              <strong>{statusLabel(card.value)}</strong>
              <small>{card.text}</small>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}
