import { format } from "date-fns";

import type { UlsRouteStatus, UlsStatusSnapshot } from "lib/underlying-stats/ulsRouteStatus";

import styles from "./UlsStatusPanel.module.scss";

type UlsStatusPanelProps = {
  status: UlsRouteStatus | null;
  variant: "landing" | "team" | "skater" | "goalie";
};

function formatSnapshotDate(value: string | null): string {
  if (!value) return "Awaiting first snapshot";
  try {
    return format(new Date(`${value}T00:00:00.000Z`), "MMM d, yyyy");
  } catch {
    return value;
  }
}

function buildCards(
  status: UlsRouteStatus | null,
  variant: UlsStatusPanelProps["variant"]
): Array<{ key: string; label: string; snapshot: UlsStatusSnapshot | null }> {
  if (!status) {
    return [];
  }

  if (variant === "landing") {
    return [
      { key: "team", label: "Team snapshot", snapshot: status.teamRatings },
      {
        key: "skater",
        label: "Skater ratings",
        snapshot:
          status.skaterOffenseRatings.rowCount + status.skaterDefenseRatings.rowCount > 0
            ? {
                latestSnapshotDate:
                  status.skaterOffenseRatings.latestSnapshotDate ??
                  status.skaterDefenseRatings.latestSnapshotDate,
                rowCount:
                  status.skaterOffenseRatings.rowCount +
                  status.skaterDefenseRatings.rowCount,
                status:
                  status.skaterOffenseRatings.status === "ready" ||
                  status.skaterDefenseRatings.status === "ready"
                    ? "ready"
                    : "pending",
              }
            : {
                latestSnapshotDate: null,
                rowCount: 0,
                status: "pending",
              },
      },
      { key: "goalie", label: "Goalie ratings", snapshot: status.goalieRatings },
      {
        key: "models",
        label: "Model signals",
        snapshot: {
          latestSnapshotDate:
            status.modelMarketFlags.latestSnapshotDate ??
            status.gamePredictions.latestSnapshotDate ??
            status.playerPredictions.latestSnapshotDate,
          rowCount:
            status.modelMarketFlags.rowCount +
            status.gamePredictions.rowCount +
            status.playerPredictions.rowCount,
          status:
            status.modelMarketFlags.status === "ready" ||
            status.gamePredictions.status === "ready" ||
            status.playerPredictions.status === "ready"
              ? "ready"
              : "pending",
        },
      },
    ];
  }

  if (variant === "team") {
    return [
      { key: "team", label: "Team snapshot", snapshot: status.teamRatings },
      {
        key: "models",
        label: "Game/model reads",
        snapshot: {
          latestSnapshotDate:
            status.gamePredictions.latestSnapshotDate ??
            status.modelMarketFlags.latestSnapshotDate,
          rowCount: status.gamePredictions.rowCount + status.modelMarketFlags.rowCount,
          status:
            status.gamePredictions.status === "ready" ||
            status.modelMarketFlags.status === "ready"
              ? "ready"
              : "pending",
        },
      },
    ];
  }

  if (variant === "goalie") {
    return [
      { key: "goalie", label: "Goalie ratings", snapshot: status.goalieRatings },
      {
        key: "props",
        label: "Goalie model reads",
        snapshot: {
          latestSnapshotDate:
            status.playerPredictions.latestSnapshotDate ??
            status.modelMarketFlags.latestSnapshotDate,
          rowCount: status.playerPredictions.rowCount + status.modelMarketFlags.rowCount,
          status:
            status.playerPredictions.status === "ready" ||
            status.modelMarketFlags.status === "ready"
              ? "ready"
              : "pending",
        },
      },
    ];
  }

  return [
    { key: "offense", label: "Offensive ratings", snapshot: status.skaterOffenseRatings },
    { key: "defense", label: "Defensive ratings", snapshot: status.skaterDefenseRatings },
    {
      key: "props",
      label: "Player model reads",
      snapshot: {
        latestSnapshotDate:
          status.playerPredictions.latestSnapshotDate ??
          status.modelMarketFlags.latestSnapshotDate,
        rowCount: status.playerPredictions.rowCount + status.modelMarketFlags.rowCount,
        status:
          status.playerPredictions.status === "ready" ||
          status.modelMarketFlags.status === "ready"
            ? "ready"
            : "pending",
      },
    },
  ];
}

export default function UlsStatusPanel({ status, variant }: UlsStatusPanelProps) {
  const cards = buildCards(status, variant);
  if (!status || cards.length === 0) {
    return null;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.grid}>
        {cards.map(({ key, label, snapshot }) => (
          <article
            key={key}
            className={styles.card}
            data-status={snapshot?.status ?? "pending"}
          >
            <p className={styles.label}>{label}</p>
            <p className={styles.value}>
              {snapshot?.rowCount ? snapshot.rowCount.toLocaleString() : "Pending"}
            </p>
            <p className={styles.meta}>
              {formatSnapshotDate(snapshot?.latestSnapshotDate ?? null)}
            </p>
          </article>
        ))}
      </div>
      <p className={styles.note}>
        Player props remain deferred for now. The route family is wired to surface ratings and model outputs as soon as those daily products are populated.
      </p>
    </div>
  );
}
