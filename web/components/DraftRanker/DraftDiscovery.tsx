import { useMemo } from "react";

import {
  useDraftDiscovery,
  type DraftDiscoveryCard,
} from "hooks/useDraftDiscovery";
import { useDraftPlayerActions } from "hooks/useDraftPlayerActions";

import type { PlacementCandidate } from "./AssistedPlacementPanel";
import styles from "./DraftRanker.module.scss";

type Props = {
  rankingId: string;
  enabled: boolean;
  onCompare: (player: PlacementCandidate) => void;
};

const TYPE_LABELS: Record<DraftDiscoveryCard["type"], string> = {
  cutoff_challenger: "Cutoff challenger",
  opportunity_change: "Opportunity change",
  previously_undrafted: "Previously undrafted",
  projection_gap: "Projection gap",
  ownership_riser: "Ownership riser",
};

function sourceLabel(source: string) {
  if (source === "yahoo_players.ownership_timeline") return "Yahoo ownership";
  if (source === "yahoo_players.adp") return "Yahoo ADP";
  if (source === "forge_roster_events") return "Verified roster event";
  if (source.startsWith("projection:")) {
    return source.slice("projection:".length).replaceAll("_", " ");
  }
  return source.replaceAll("_", " ").replaceAll(".", " · ");
}

function formatDate(value: string | null) {
  if (!value) return "Source date unavailable";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(timestamp);
}

function placementCandidate(card: DraftDiscoveryCard): PlacementCandidate {
  return {
    playerId: card.playerId,
    canonicalName: card.player.canonicalName,
    position: card.player.position,
    organizationName: card.player.organizationName,
    headshotUrl: card.player.headshotUrl,
  };
}

export default function DraftDiscovery({
  rankingId,
  enabled,
  onCompare,
}: Props) {
  const discovery = useDraftDiscovery(rankingId, enabled);
  const actions = useDraftPlayerActions(rankingId, enabled);
  const sourceSummary = useMemo(() => {
    const sources = discovery.data?.sourceHealth ?? [];
    return {
      available: sources.filter((source) => source.health_state === "available")
        .length,
      waiting: sources.filter((source) => source.health_state !== "available")
        .length,
    };
  }, [discovery.data?.sourceHealth]);

  if (!enabled) return null;

  function act(
    card: DraftDiscoveryCard,
    action: "watch" | "unwatch" | "dismiss" | "not_relevant" | "compare_now",
  ) {
    actions.action.mutate(
      {
        playerId: card.playerId,
        action,
        operationId: crypto.randomUUID(),
        sourceContext: "discovery",
      },
      action === "compare_now"
        ? { onSuccess: () => onCompare(placementCandidate(card)) }
        : undefined,
    );
  }

  return (
    <section
      className={styles.discoveryCard}
      aria-labelledby="draft-discovery-title"
    >
      <div className={styles.discoveryHeading}>
        <div>
          <p className={styles.eyebrow}>Explainable discovery</p>
          <h2 id="draft-discovery-title">Players worth another look</h2>
          <p>
            Every suggestion must clear a published data threshold and carry a
            source date. Stale evidence disappears automatically.
          </p>
        </div>
        {discovery.data?.refresh ? (
          <div className={styles.discoveryFreshness}>
            <span>{sourceSummary.available} sources ready</span>
            <small>
              Refreshed {formatDate(discovery.data.refresh.completedAt)}
            </small>
          </div>
        ) : null}
      </div>

      {discovery.isLoading ? (
        <p className={styles.discoveryState}>Checking verified sources…</p>
      ) : discovery.error ? (
        <div className={styles.discoveryState} role="alert">
          <p>Discovery sources could not be loaded.</p>
          <button type="button" onClick={() => discovery.refetch()}>
            Try again
          </button>
        </div>
      ) : discovery.data?.cards.length ? (
        <div className={styles.discoveryGrid}>
          {discovery.data.cards.map((card) => (
            <article
              className={styles.discoveryPlayerCard}
              key={`${card.type}:${card.playerId}`}
            >
              <div className={styles.discoveryPlayerHeader}>
                {card.player.headshotUrl ? (
                  <img src={card.player.headshotUrl} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden="true">{card.player.position ?? "?"}</span>
                )}
                <div>
                  <small>{TYPE_LABELS[card.type]}</small>
                  <h3>{card.player.canonicalName}</h3>
                  <p>
                    {[
                      card.player.organizationName ?? "Unsigned",
                      card.player.position,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {card.personalRank ? ` · Your #${card.personalRank}` : ""}
                  </p>
                </div>
              </div>
              <p className={styles.discoveryReason}>{card.reason}</p>
              <div className={styles.discoverySources}>
                {card.sources.map((source) => (
                  <span key={source} title={source}>
                    {sourceLabel(source)}
                  </span>
                ))}
                <span>
                  As of {formatDate(card.sourceDate ?? card.sourceObservedAt)}
                </span>
              </div>
              <div className={styles.discoveryActions}>
                <button
                  type="button"
                  disabled={actions.action.isPending}
                  onClick={() => act(card, "compare_now")}
                >
                  {card.onBoard ? "Compare now" : "Place player"}
                </button>
                <button
                  type="button"
                  disabled={actions.action.isPending}
                  onClick={() => act(card, card.watched ? "unwatch" : "watch")}
                >
                  {card.watched ? "Unwatch" : "Watch"}
                </button>
                <button
                  type="button"
                  disabled={actions.action.isPending}
                  onClick={() => act(card, "dismiss")}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  disabled={actions.action.isPending}
                  onClick={() => act(card, "not_relevant")}
                >
                  Not relevant
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.discoveryState}>
          <strong>No recommendations are being forced.</strong>
          <p>{discovery.data?.message}</p>
          {sourceSummary.waiting ? (
            <small>
              {sourceSummary.available} verified sources ready ·{" "}
              {sourceSummary.waiting} waiting or unavailable
            </small>
          ) : null}
        </div>
      )}

      {actions.action.error ? (
        <p className={styles.error} role="alert">
          That discovery action could not be saved. Your previous state is
          unchanged.
        </p>
      ) : null}
    </section>
  );
}
