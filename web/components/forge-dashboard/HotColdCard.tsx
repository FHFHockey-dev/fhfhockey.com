import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import styles from "styles/ForgeDashboard.module.scss";
import { buildForgeHref } from "lib/dashboard/forgeLinks";
import {
  normalizeSkaterTrendResponse,
  type NormalizedSkaterTrendResponse
} from "lib/dashboard/normalizers";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
import {
  describePlayerSignalFrame,
  describeTrendBand,
  resolveInsightTone
} from "lib/dashboard/playerInsightContext";
import { fetchOwnershipContextMap } from "lib/dashboard/playerOwnership";

type HotColdCardProps = {
  date: string;
  team: string;
  position: "all" | "f" | "d" | "g";
  ownershipMin: number;
  ownershipMax: number;
  returnToHref?: string | null;
  onResolvedDate?: (resolvedDate: string | null) => void;
  onStatusChange?: (status: {
    loading: boolean;
    error: string | null;
    staleMessage: string | null;
    empty: boolean;
  }) => void;
};

type TrendMode = "hotCold" | "movement";
const MAX_SPARKS_PER_COLUMN = 1;

type CompositePlayerRow = {
  playerId: number;
  fullName: string;
  position: string | null;
  teamAbbr: string | null;
  imageUrl: string | null;
  currentScore: number;
  movementScore: number;
  currentDriver: string;
  movementDriver: string;
  currentSeries: Array<{ gp: number; percentile: number }>;
  movementSeries: Array<{ gp: number; percentile: number }>;
};

const CATEGORY_META: Record<
  string,
  { label: string; shortHot: string; shortCold: string }
> = {
  shotsPer60: {
    label: "Shots/60",
    shortHot: "shot volume driving the current heater",
    shortCold: "shot volume has cooled off"
  },
  ixgPer60: {
    label: "ixG/60",
    shortHot: "chance quality is staying elevated",
    shortCold: "chance quality has dropped"
  },
  timeOnIce: {
    label: "TOI",
    shortHot: "deployment is supporting the run",
    shortCold: "deployment is fading"
  },
  powerPlayTime: {
    label: "PP TOI",
    shortHot: "power-play role is lifting the trend",
    shortCold: "power-play role is shrinking"
  }
};

const formatSigned = (value: number): string => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

const formatScore = (value: number): string => value.toFixed(1);

const formatOwnershipDelta = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pts`;
};

const toneClassForMagnitude = (score: number) => {
  const tone = resolveInsightTone(score);
  if (tone === "risk") return styles.insightContextRisk;
  if (tone === "watch") return styles.insightContextWatch;
  return styles.insightContextStable;
};

const toPositionParam = (position: HotColdCardProps["position"]) => {
  if (position === "d") return "defense";
  if (position === "f") return "forward";
  return "all";
};

const buildReason = (
  row: CompositePlayerRow,
  mode: TrendMode,
  side: "positive" | "negative"
) => {
  if (mode === "movement") {
    return side === "positive"
      ? `${row.movementDriver} is climbing fastest in the latest window. Short-term only.`
      : `${row.movementDriver} is sliding hardest in the latest window. Short-term only.`;
  }

  return side === "positive"
    ? `${row.currentDriver} keeps this player hot right now. Momentum only, not a trust grade.`
    : `${row.currentDriver} is the clearest sign that this player is cold right now. Short-term read, not a long-term verdict.`;
};

const buildSparklinePath = (
  points: Array<{ gp: number; percentile: number }>
): string | null => {
  if (points.length < 2) return null;

  const values = points.map((point) => point.percentile);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 72;
  const height = 24;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.percentile - min) / range) * (height - 2) - 1;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
};

export default function HotColdCard({
  date,
  team,
  position,
  ownershipMin,
  ownershipMax,
  returnToHref,
  onResolvedDate,
  onStatusChange
}: HotColdCardProps) {
  const [mode, setMode] = useState<TrendMode>("hotCold");
  const [payload, setPayload] = useState<NormalizedSkaterTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownershipMap, setOwnershipMap] = useState<
    Record<number, { ownership: number | null; delta: number | null; sparkline: Array<{ date: string; value: number }> }>
  >({});
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipWarning, setOwnershipWarning] = useState<string | null>(null);
  const shortTermGuide = describePlayerSignalFrame("shortTerm");

  useEffect(() => {
    let active = true;

    if (position === "g") {
      setPayload(null);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    const query = new URLSearchParams({
      date,
      position: toPositionParam(position),
      window: "5",
      limit: "40"
    });

    fetchCachedJson<unknown>(`/api/v1/trends/skater-power?${query.toString()}`, {
      ttlMs: 5 * 60_000
    })
      .then((response) => normalizeSkaterTrendResponse(response))
      .then((response) => {
        if (!active) return;
        setPayload(response);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load player trend movement.";
        setError(message);
        setPayload(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, position]);

  const rankedRows = useMemo<CompositePlayerRow[]>(() => {
    if (!payload || payload.serving?.status === "blocked") return [];

    const byPlayer = new Map<
      number,
      {
        currentTotal: number;
        currentCount: number;
        movementTotal: number;
        movementCount: number;
        currentDriver: { label: string; value: number } | null;
        movementDriver: { label: string; value: number } | null;
        currentSeries: Array<{ gp: number; percentile: number }>;
        movementSeries: Array<{ gp: number; percentile: number }>;
      }
    >();

    Object.entries(payload.categories).forEach(([categoryKey, category]) => {
      category.rankings.forEach((ranking) => {
        const existing = byPlayer.get(ranking.playerId) ?? {
          currentTotal: 0,
          currentCount: 0,
          movementTotal: 0,
          movementCount: 0,
          currentDriver: null,
          movementDriver: null,
          currentSeries: [],
          movementSeries: []
        };

        existing.currentTotal += ranking.percentile;
        existing.currentCount += 1;
        existing.movementTotal += ranking.delta;
        existing.movementCount += 1;

        const meta = CATEGORY_META[categoryKey];
        const currentMagnitude = Math.abs(ranking.percentile - 50);
        const movementMagnitude = Math.abs(ranking.delta);

        if (
          !existing.currentDriver ||
          currentMagnitude > Math.abs(existing.currentDriver.value)
        ) {
          existing.currentSeries = category.series[String(ranking.playerId)]?.slice(-10) ?? [];
          existing.currentDriver = {
            label:
              ranking.percentile >= 50
                ? meta?.shortHot ?? categoryKey
                : meta?.shortCold ?? categoryKey,
            value: ranking.percentile - 50
          };
        }

        if (
          !existing.movementDriver ||
          movementMagnitude > Math.abs(existing.movementDriver.value)
        ) {
          existing.movementSeries = category.series[String(ranking.playerId)]?.slice(-10) ?? [];
          existing.movementDriver = {
            label: meta?.label ?? categoryKey,
            value: ranking.delta
          };
        }

        byPlayer.set(ranking.playerId, existing);
      });
    });

    return Array.from(byPlayer.entries())
      .map(([playerId, aggregate]) => {
        const metadata = payload.playerMetadata[String(playerId)];
        if (!metadata?.fullName) return null;
        if (
          team !== "all" &&
          (metadata.teamAbbrev ?? "").toUpperCase() !== team.toUpperCase()
        ) {
          return null;
        }

        return {
          playerId,
          fullName: metadata.fullName,
          position: metadata.position,
          teamAbbr: metadata.teamAbbrev,
          imageUrl: metadata.imageUrl,
          currentScore:
            aggregate.currentCount > 0
              ? aggregate.currentTotal / aggregate.currentCount
              : 0,
          movementScore:
            aggregate.movementCount > 0
              ? aggregate.movementTotal / aggregate.movementCount
              : 0,
          currentDriver: aggregate.currentDriver?.label ?? "balanced recent form",
          movementDriver: aggregate.movementDriver?.label ?? "recent movement",
          currentSeries: aggregate.currentSeries,
          movementSeries: aggregate.movementSeries
        };
      })
      .filter((row): row is CompositePlayerRow => Boolean(row));
  }, [payload, team]);

  const ownershipPlayerIds = useMemo(
    () => rankedRows.map((row) => row.playerId),
    [rankedRows]
  );

  useEffect(() => {
    let active = true;

    if (ownershipPlayerIds.length === 0) {
      setOwnershipMap({});
      setOwnershipLoading(false);
      setOwnershipWarning(null);
      return () => {
        active = false;
      };
    }

    setOwnershipLoading(true);
    setOwnershipWarning(null);

    fetchOwnershipContextMap(ownershipPlayerIds, date, 5)
      .then((nextMap) => {
        if (!active) return;
        setOwnershipMap(nextMap);
      })
      .catch(() => {
        if (!active) return;
        setOwnershipMap({});
        setOwnershipWarning("Ownership filter unavailable; showing unfiltered player insight.");
      })
      .finally(() => {
        if (!active) return;
        setOwnershipLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, ownershipPlayerIds]);

  const ownershipFilterActive = !ownershipWarning;
  const missingOwnershipCount = useMemo(
    () =>
      rankedRows.reduce((count, row) => {
        const ownership = ownershipMap[row.playerId]?.ownership;
        return ownership == null ? count + 1 : count;
      }, 0),
    [ownershipMap, rankedRows]
  );
  const ownershipCoverageWarning =
    ownershipFilterActive && missingOwnershipCount > 0
      ? `Ownership coverage incomplete for ${missingOwnershipCount} trend candidates; rows with Own -- remain visible outside the normal ownership band.`
      : null;
  const filteredRankedRows = useMemo(
    () =>
      rankedRows.filter((row) => {
        if (!ownershipFilterActive) return true;
        const ownership = ownershipMap[row.playerId]?.ownership;
        if (ownership == null) return true;
        return ownership >= ownershipMin && ownership <= ownershipMax;
      }),
    [ownershipFilterActive, ownershipMap, ownershipMax, ownershipMin, rankedRows]
  );

  const hotRows = useMemo(
    () => [...filteredRankedRows].sort((a, b) => b.currentScore - a.currentScore).slice(0, 4),
    [filteredRankedRows]
  );
  const coldRows = useMemo(
    () => [...filteredRankedRows].sort((a, b) => a.currentScore - b.currentScore).slice(0, 4),
    [filteredRankedRows]
  );
  const upRows = useMemo(
    () => [...filteredRankedRows].sort((a, b) => b.movementScore - a.movementScore).slice(0, 4),
    [filteredRankedRows]
  );
  const downRows = useMemo(
    () => [...filteredRankedRows].sort((a, b) => a.movementScore - b.movementScore).slice(0, 4),
    [filteredRankedRows]
  );

  const generatedDate = payload?.generatedAt?.slice(0, 10) ?? "n/a";
  const resolvedDate = payload?.dateUsed ?? null;
  const servingMessage = payload?.serving?.message ?? null;
  const servingSeverity = payload?.serving?.severity ?? "none";
  const servingBlocked = payload?.serving?.status === "blocked";
  const isStale = useMemo(() => {
    if (!payload?.generatedAt) return false;
    const ts = new Date(payload.generatedAt).getTime();
    return Number.isFinite(ts) ? Date.now() - ts > 36 * 60 * 60 * 1000 : false;
  }, [payload?.generatedAt]);

  const leftRows = mode === "hotCold" ? hotRows : upRows;
  const rightRows = mode === "hotCold" ? coldRows : downRows;
  const leftTitle = mode === "hotCold" ? "Hot Players" : "Trending Up";
  const rightTitle = mode === "hotCold" ? "Cold Players" : "Trending Down";
  const leftEmptyLabel =
    mode === "hotCold"
      ? "No hot players cleared the current ownership and position filter."
      : "No players are trending up inside the current filter.";
  const rightEmptyLabel =
    mode === "hotCold"
      ? "No cold players cleared the current ownership and position filter."
      : "No players are trending down inside the current filter.";

  useEffect(() => {
    onResolvedDate?.(resolvedDate);
  }, [onResolvedDate, resolvedDate]);

  useEffect(() => {
    onStatusChange?.({
      loading: loading || ownershipLoading,
      error,
      staleMessage:
        !loading && !ownershipLoading && !error
          ? [
              servingMessage ??
                (resolvedDate && resolvedDate !== date
                  ? `Trend movement scoped through ${resolvedDate}`
                  : null),
              isStale && payload?.generatedAt
                ? `Player trend feed last updated ${payload.generatedAt.slice(0, 10)}`
                : null,
              ownershipWarning,
              ownershipCoverageWarning
            ]
              .filter(Boolean)
              .join(" • ") || null
          : null,
      empty:
        !loading &&
        !ownershipLoading &&
        !error &&
        position !== "g" &&
        filteredRankedRows.length === 0 &&
        !servingBlocked
    });
  }, [
    error,
    filteredRankedRows.length,
    isStale,
    loading,
    onStatusChange,
    ownershipLoading,
    ownershipCoverageWarning,
    ownershipWarning,
    payload?.generatedAt,
    servingMessage,
    servingBlocked,
    date,
    resolvedDate,
    position
  ]);

  return (
    <article className={styles.hotColdCard} aria-label="Player hot and cold trend movement">
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Hot / Cold and Trend Movement</h3>
        <span className={styles.panelMeta}>
          Skater 5G • Scope {resolvedDate ?? date} • Updated {generatedDate}
        </span>
      </header>

      <div className={styles.hotColdTabs} role="tablist" aria-label="Player trend mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "hotCold"}
          className={`${styles.hotColdTab} ${mode === "hotCold" ? styles.hotColdTabActive : ""}`}
          onClick={() => setMode("hotCold")}
        >
          Hot / Cold
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "movement"}
          className={`${styles.hotColdTab} ${mode === "movement" ? styles.hotColdTabActive : ""}`}
          onClick={() => setMode("movement")}
        >
          Trending Up / Down
        </button>
      </div>

      {position === "g" && (
        <p className={styles.panelState}>Trend movement is available for skaters only.</p>
      )}
      {position !== "g" && (loading || ownershipLoading) && (
        <p className={styles.panelState}>Loading player trend movement...</p>
      )}
      {position !== "g" && !loading && error && (
        <p className={styles.panelState}>Error: {error}</p>
      )}
      {position !== "g" &&
        !loading &&
        !ownershipLoading &&
        !error &&
        servingBlocked && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          {servingMessage ??
            "Trend movement is materially stale for this dashboard date, so the card is withholding player rows until fresher trend metrics exist."}
          {payload?.generatedAt ? ` Latest refresh timestamp: ${payload.generatedAt}.` : ""}
        </p>
      )}
      {position !== "g" &&
        !loading &&
        !ownershipLoading &&
        !error &&
        !servingBlocked &&
        filteredRankedRows.length === 0 && (
        <p className={styles.panelState}>No player trend movement available for this filter.</p>
      )}
      {position !== "g" &&
        !loading &&
        !ownershipLoading &&
        !error &&
        !servingBlocked &&
        (isStale || (resolvedDate != null && resolvedDate !== date)) && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          {servingMessage
            ? servingSeverity === "error"
              ? `${servingMessage} Latest refresh timestamp: ${payload?.generatedAt ?? "unknown"}.`
              : servingMessage
            : resolvedDate != null && resolvedDate !== date
              ? `Trend movement is using the latest available game-date scope (${resolvedDate}).`
              : `Trend feed may be stale (last update ${payload?.generatedAt}).`}
        </p>
      )}

      {position !== "g" &&
        !loading &&
        !ownershipLoading &&
        !error &&
        filteredRankedRows.length > 0 && (
        <>
        <div className={styles.insightLegend} aria-label="Trend signal guide">
          <div className={styles.insightLegendItem}>
            <span className={`${styles.insightContextPill} ${styles.insightContextWatch}`}>
              {shortTermGuide.label}
            </span>
            <span className={styles.insightLegendText}>
              {mode === "hotCold"
                ? "Hot and cold identify current form. They do not say whether the run is trustworthy."
                : "Trending up and down track movement speed. They do not replace sustainability."
              }
            </span>
          </div>
          <div className={styles.insightLegendItem}>
            <span className={`${styles.insightContextPill} ${styles.insightRoutePill}`}>
              Trends drill-in
            </span>
            <span className={styles.insightLegendText}>
              Player rows open the Trends player page for deeper movement history, not the FORGE opportunity detail page.
            </span>
          </div>
        </div>
        <p className={styles.compactChartNote}>
          Lead rows keep the only trend traces in each column.
        </p>
        <div className={styles.hotColdColumns}>
          <div className={styles.hotColdColumn}>
            <p className={styles.susColumnTitle}>{leftTitle}</p>
            <ul className={styles.susList}>
              {leftRows.length === 0 && (
                <li className={styles.hotColdEmptyState}>{leftEmptyLabel}</li>
              )}
              {leftRows.map((row, index) => {
                const sparkPath = buildSparklinePath(
                  mode === "hotCold" ? row.currentSeries : row.movementSeries
                );
                const ownershipContext = ownershipMap[row.playerId];

                return (
                  <li key={`${mode}-left-${row.playerId}`} className={styles.hotColdRow}>
                    <Link
                      href={buildForgeHref(`/trends/player/${row.playerId}`, {
                        date,
                        origin: "forge-dashboard",
                        returnTo: returnToHref
                      })}
                      className={styles.hotColdRowLink}
                    >
                      <div>
                        <p className={styles.hotColdName}>{row.fullName}</p>
                        <div className={styles.insightContextBlock}>
                          <span
                            className={`${styles.insightContextPill} ${toneClassForMagnitude(mode === "hotCold" ? row.currentScore - 50 : row.movementScore)}`}
                          >
                            {describeTrendBand(
                              mode,
                              mode === "hotCold" ? row.currentScore : row.movementScore
                            ).title}
                          </span>
                          <span className={styles.insightContextText}>
                            {
                              describeTrendBand(
                                mode,
                                mode === "hotCold" ? row.currentScore : row.movementScore
                              ).detail
                            }
                          </span>
                        </div>
                        <p className={styles.hotColdReason}>
                          {buildReason(row, mode, "positive")}
                        </p>
                        <span className={styles.insightRouteNote}>
                          Opens in Trends player detail
                        </span>
                      </div>
                      <div className={styles.hotColdStats}>
                        <span className={styles.hotColdMeta}>
                          {(row.teamAbbr ?? "--")} • {(row.position ?? "--")}
                        </span>
                        <span className={styles.hotColdMeta}>
                          Own {ownershipContext?.ownership == null ? "--" : `${ownershipContext.ownership.toFixed(0)}%`}
                        </span>
                        <span className={styles.hotColdMeta}>
                          5D {formatOwnershipDelta(ownershipContext?.delta)}
                        </span>
                        <span className={styles.hotColdDelta}>
                          {mode === "hotCold"
                            ? formatScore(row.currentScore)
                            : formatSigned(row.movementScore)}
                        </span>
                        {index < MAX_SPARKS_PER_COLUMN && sparkPath ? (
                          <svg
                            className={styles.sparkSvg}
                            viewBox="0 0 72 24"
                            aria-hidden="true"
                          >
                            <path
                              className={`${styles.sparkPath} ${styles.sparkRise}`}
                              d={sparkPath}
                            />
                          </svg>
                        ) : (
                          <span className={styles.compactChartNote}>Text-first row</span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={styles.hotColdColumn}>
            <p className={styles.susColumnTitle}>{rightTitle}</p>
            <ul className={styles.susList}>
              {rightRows.length === 0 && (
                <li className={styles.hotColdEmptyState}>{rightEmptyLabel}</li>
              )}
              {rightRows.map((row, index) => {
                const sparkPath = buildSparklinePath(
                  mode === "hotCold" ? row.currentSeries : row.movementSeries
                );
                const ownershipContext = ownershipMap[row.playerId];

                return (
                  <li key={`${mode}-right-${row.playerId}`} className={styles.hotColdRow}>
                    <Link
                      href={buildForgeHref(`/trends/player/${row.playerId}`, {
                        date,
                        origin: "forge-dashboard",
                        returnTo: returnToHref
                      })}
                      className={styles.hotColdRowLink}
                    >
                      <div>
                        <p className={styles.hotColdName}>{row.fullName}</p>
                        <div className={styles.insightContextBlock}>
                          <span
                            className={`${styles.insightContextPill} ${toneClassForMagnitude(mode === "hotCold" ? row.currentScore - 50 : row.movementScore)}`}
                          >
                            {describeTrendBand(
                              mode,
                              mode === "hotCold" ? row.currentScore : row.movementScore
                            ).title}
                          </span>
                          <span className={styles.insightContextText}>
                            {
                              describeTrendBand(
                                mode,
                                mode === "hotCold" ? row.currentScore : row.movementScore
                              ).detail
                            }
                          </span>
                        </div>
                        <p className={styles.hotColdReason}>
                          {buildReason(row, mode, "negative")}
                        </p>
                        <span className={styles.insightRouteNote}>
                          Opens in Trends player detail
                        </span>
                      </div>
                      <div className={styles.hotColdStats}>
                        <span className={styles.hotColdMeta}>
                          {(row.teamAbbr ?? "--")} • {(row.position ?? "--")}
                        </span>
                        <span className={styles.hotColdMeta}>
                          Own {ownershipContext?.ownership == null ? "--" : `${ownershipContext.ownership.toFixed(0)}%`}
                        </span>
                        <span className={styles.hotColdMeta}>
                          5D {formatOwnershipDelta(ownershipContext?.delta)}
                        </span>
                        <span
                          className={`${styles.hotColdDelta} ${styles.hotColdDeltaDown}`}
                        >
                          {mode === "hotCold"
                            ? formatScore(row.currentScore)
                            : formatSigned(row.movementScore)}
                        </span>
                        {index < MAX_SPARKS_PER_COLUMN && sparkPath ? (
                          <svg
                            className={styles.sparkSvg}
                            viewBox="0 0 72 24"
                            aria-hidden="true"
                          >
                            <path
                              className={`${styles.sparkPath} ${styles.sparkFall}`}
                              d={sparkPath}
                            />
                          </svg>
                        ) : (
                          <span className={styles.compactChartNote}>Text-first row</span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        </>
      )}
    </article>
  );
}
