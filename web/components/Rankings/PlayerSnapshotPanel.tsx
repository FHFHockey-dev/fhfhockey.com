import type {
  PlayerMatrixMetricCell,
  PlayerMatrixResponse,
  PlayerMatrixRow,
} from "lib/rankings/playerMatrix";
import {
  formatDeploymentLabel,
  formatPercentile,
  formatToiClock,
} from "lib/rankings/rankingFormatters";

import styles from "styles/Rankings.module.scss";

type PlayerSnapshotPanelProps = {
  payload: PlayerMatrixResponse | null;
  selectedPlayerId: number | null;
  snapshotRow?: PlayerMatrixRow | null;
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

function availableMetricCells(row: PlayerMatrixRow) {
  return Object.values(row.metrics)
    .filter((cell) => cell.availabilityState === "available" && cell.percentile != null)
    .sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0));
}

function topStrengths(row: PlayerMatrixRow) {
  const cells = availableMetricCells(row);
  const elite = cells.filter((cell) => (cell.percentile ?? 0) >= 80).slice(0, 4);
  return elite.length > 0 ? elite : cells.slice(0, 3);
}

function weakSpots(row: PlayerMatrixRow) {
  return availableMetricCells(row)
    .sort((a, b) => (a.percentile ?? 0) - (b.percentile ?? 0))
    .filter((cell) => (cell.percentile ?? 0) <= 39)
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

function profileSummary(row: PlayerMatrixRow) {
  const strengths = topStrengths(row);
  const weak = weakSpots(row);
  if (!strengths.length) return "No live percentile strengths are available in this context.";

  const leader = strengths[0];
  const strengthText = `${leader.fullLabel} (${formatPercentile(leader.percentile)})`;
  if (!weak.length) {
    return `Best live signal is ${strengthText}; no major weak spot appears in the visible metric set.`;
  }
  return `Best live signal is ${strengthText}; weakest visible area is ${weak[0].fullLabel} (${formatPercentile(weak[0].percentile)}).`;
}

function metricBullet(cell: PlayerMatrixMetricCell, mode: "strength" | "weakness") {
  const rank = cell.rank == null ? "unranked" : `rank ${cell.rank}`;
  const raw = cell.formattedValue == null ? "" : ` · ${cell.formattedValue}`;
  const qualifier = cell.lowerIsBetter
    ? mode === "strength"
      ? "suppression"
      : "higher-against raw value"
    : mode === "strength"
      ? "production"
      : "lower peer output";
  return `${cell.fullLabel}: ${formatPercentile(cell.percentile)} percentile, ${rank}${raw} (${qualifier}).`;
}

function MetricList({
  title,
  cells,
  emptyText,
  mode,
}: {
  title: string;
  cells: PlayerMatrixMetricCell[];
  emptyText: string;
  mode: "strength" | "weakness";
}) {
  return (
    <section className={styles.snapshotBullets}>
      <h3>{title}</h3>
      {cells.length > 0 ? (
        <ul>
          {cells.map((cell) => (
            <li key={cell.metricKey}>{metricBullet(cell, mode)}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function snapshotMetricCells(row: PlayerMatrixRow) {
  const preferred = SNAPSHOT_METRICS.flatMap((metricKey) => {
    const cell = row.metrics[metricKey];
    return cell ? [cell] : [];
  });
  if (preferred.length > 0) return preferred;
  return availableMetricCells(row).slice(0, 8);
}

function statusLabel(value: number | string | null | undefined) {
  return value == null || value === "" ? "Source pending" : String(value);
}

function compositeCards(row: PlayerMatrixRow) {
  return [
    {
      title: "Offense Rating",
      value: row.composite?.offenseRating == null ? null : row.composite.offenseRating.toFixed(1),
      text: row.composite?.offenseRating == null
        ? "Unavailable until composite source is populated"
        : "Published composite value",
    },
    {
      title: "Defensive Impact",
      value: row.composite?.defenseRating == null ? null : row.composite.defenseRating.toFixed(1),
      text: row.composite?.defenseRating == null
        ? "Unavailable until composite source is populated"
        : "Published composite value",
    },
    {
      title: "MCM / BEAST",
      value: row.composite?.beastTier
        ? `${row.composite.beastTier} · ${row.composite.mcmScore?.toFixed(1) ?? "-"}`
        : row.composite?.mcmScore?.toFixed(1) ?? null,
      text: row.composite?.mcmScore == null
        ? "Source pending"
        : "Published multi-category signal",
    },
    {
      title: "Luck Score",
      value: null,
      text: "Planned; no live value",
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
}: PlayerSnapshotPanelProps) {
  const row = selectedRow(payload, selectedPlayerId, snapshotRow);

  if (!row) {
    return (
      <aside className={styles.snapshotPanel}>
        <h2>Player Snapshot</h2>
        <p className={styles.snapshotMuted}>Select a row to inspect player context.</p>
      </aside>
    );
  }

  const strengths = topStrengths(row);
  const weaknesses = weakSpots(row);
  const caveatItems = caveats(row);
  const metricCells = snapshotMetricCells(row);
  const cards = compositeCards(row);

  return (
    <aside className={styles.snapshotPanel} aria-label="Player snapshot">
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
        <p>{profileSummary(row)}</p>
      </section>

      <MetricList
        title="Live Strengths"
        cells={strengths}
        emptyText="No live strengths are available for this filter set."
        mode="strength"
      />

      <MetricList
        title="Weak Spots"
        cells={weaknesses}
        emptyText="No sub-40th percentile weak spot appears in the visible metric set."
        mode="weakness"
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
        {metricCells.map((cell) => {
          const pct = cell.percentile ?? 0;
          return (
            <div key={cell.metricKey} className={styles.snapshotMetricBar}>
              <span>{cell.shortLabel}</span>
              <div>
                <i style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
              </div>
              <strong>
                {cell.availabilityState === "available"
                  ? formatPercentile(cell.percentile)
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
