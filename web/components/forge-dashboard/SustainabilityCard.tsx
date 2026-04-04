import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import OwnershipSparkline from "components/TransactionTrends/OwnershipSparkline";
import styles from "styles/ForgeDashboard.module.scss";
import { buildForgeHref } from "lib/dashboard/forgeLinks";
import type {
  NormalizedSustainabilityResponse,
  NormalizedSustainabilityRow
} from "lib/dashboard/normalizers";
import { normalizeSustainabilityResponse } from "lib/dashboard/normalizers";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
import {
  describePlayerSignalFrame,
  describeSustainabilityBand,
  resolveInsightTone
} from "lib/dashboard/playerInsightContext";
import { fetchOwnershipContextMap } from "lib/dashboard/playerOwnership";

type SustainabilityDirection = "hot" | "cold";

type SustainabilityCardProps = {
  date: string;
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

const toPosParam = (position: SustainabilityCardProps["position"]): "all" | "F" | "D" => {
  if (position === "f") return "F";
  if (position === "d") return "D";
  return "all";
};

const formatScore = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(1);
};

const formatSigned = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
};

const formatOwnershipDelta = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pts`;
};

const confidenceLabel = (pressure: number): string => {
  const abs = Math.abs(pressure);
  if (abs >= 1.25) return "High";
  if (abs >= 0.75) return "Medium";
  return "Low";
};

const formatPosition = (row: NormalizedSustainabilityRow): string => {
  if (row.position_code) return row.position_code;
  if (row.position_group) return row.position_group.toUpperCase();
  return "--";
};

const getPrimaryDriver = (row: NormalizedSustainabilityRow) => {
  const candidates = [
    { key: "SHP", value: row.z_shp },
    { key: "OI SH%", value: row.z_oishp },
    { key: "IPP", value: row.z_ipp },
    { key: "PP SH%", value: row.z_ppshp }
  ];

  return candidates
    .filter((candidate) => candidate.value != null)
    .sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0))[0] ?? null;
};

const getReasonText = (
  row: NormalizedSustainabilityRow,
  direction: "sustainable" | "unsustainable"
) => {
  const driver = getPrimaryDriver(row);
  if (!driver) {
    return direction === "sustainable"
      ? "Low luck pressure keeps this rise closer to skill-backed than spike-backed."
      : "Luck pressure is elevated even without one dominant component spike.";
  }

  if (direction === "sustainable") {
    return `${driver.key} is not driving the signal beyond expectation, keeping the profile steadier.`;
  }

  return `${driver.key} is the biggest inflation source inside this heater right now.`;
};

const toneClassForPressure = (pressure: number) => {
  const tone = resolveInsightTone(pressure);
  if (tone === "risk") return styles.insightContextRisk;
  if (tone === "watch") return styles.insightContextWatch;
  return styles.insightContextStable;
};

async function fetchDirection(params: {
  date: string;
  pos: "all" | "F" | "D";
  direction: SustainabilityDirection;
  limit: number;
}): Promise<NormalizedSustainabilityResponse> {
  const query = new URLSearchParams({
    snapshot_date: params.date,
    window_code: "l10",
    pos: params.pos,
    direction: params.direction,
    limit: String(params.limit)
  });

  return normalizeSustainabilityResponse(
    await fetchCachedJson<unknown>(`/api/v1/sustainability/trends?${query.toString()}`, {
      ttlMs: 90_000
    })
  );
}

export default function SustainabilityCard({
  date,
  position,
  ownershipMin,
  ownershipMax,
  returnToHref,
  onResolvedDate,
  onStatusChange
}: SustainabilityCardProps) {
  const [hotRows, setHotRows] = useState<NormalizedSustainabilityRow[]>([]);
  const [coldRows, setColdRows] = useState<NormalizedSustainabilityRow[]>([]);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownershipMap, setOwnershipMap] = useState<
    Record<number, { ownership: number | null; delta: number | null; sparkline: Array<{ date: string; value: number }> }>
  >({});
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipWarning, setOwnershipWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const pos = toPosParam(position);

    Promise.all([
      fetchDirection({ date, pos, direction: "hot", limit: 8 }),
      fetchDirection({ date, pos, direction: "cold", limit: 8 })
    ])
      .then(([hot, cold]) => {
        if (!active) return;
        setHotRows(hot.rows ?? []);
        setColdRows(cold.rows ?? []);
        setSnapshotDate(hot.snapshot_date ?? cold.snapshot_date ?? null);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load sustainability data.";
        setError(message);
        setHotRows([]);
        setColdRows([]);
        setSnapshotDate(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, position]);

  const ownershipPlayerIds = useMemo(
    () => Array.from(new Set([...hotRows, ...coldRows].map((row) => row.player_id))),
    [coldRows, hotRows]
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
      ownershipPlayerIds.reduce((count, playerId) => {
        const ownership = ownershipMap[playerId]?.ownership;
        return ownership == null ? count + 1 : count;
      }, 0),
    [ownershipMap, ownershipPlayerIds]
  );
  const ownershipCoverageWarning =
    ownershipFilterActive && missingOwnershipCount > 0
      ? `Ownership coverage incomplete for ${missingOwnershipCount} sustainability candidates; rows with Own -- remain visible outside the normal ownership band.`
      : null;
  const withinOwnershipBand = (playerId: number) => {
    if (!ownershipFilterActive) return true;
    const ownership = ownershipMap[playerId]?.ownership;
    if (ownership == null) return true;
    return ownership >= ownershipMin && ownership <= ownershipMax;
  };

  const sustainableRows = useMemo(
    () => coldRows.filter((row) => withinOwnershipBand(row.player_id)).slice(0, 5),
    [coldRows, ownershipMap, ownershipMax, ownershipMin, ownershipWarning]
  );
  const riskRows = useMemo(
    () => hotRows.filter((row) => withinOwnershipBand(row.player_id)).slice(0, 5),
    [hotRows, ownershipMap, ownershipMax, ownershipMin, ownershipWarning]
  );
  const isStale = Boolean(snapshotDate && snapshotDate !== date);
  const metaSnapshot = snapshotDate ?? date;
  const trustworthyGuide = describePlayerSignalFrame("trustworthy");
  const overheatedGuide = describePlayerSignalFrame("overheated");

  useEffect(() => {
    onResolvedDate?.(snapshotDate);
  }, [onResolvedDate, snapshotDate]);

  useEffect(() => {
    onStatusChange?.({
      loading: loading || ownershipLoading,
      error,
      staleMessage:
        !loading && !ownershipLoading && !error
          ? [
              isStale && snapshotDate ? `Sustainability using ${snapshotDate}` : null,
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
        sustainableRows.length === 0 &&
        riskRows.length === 0
    });
  }, [
    error,
    isStale,
    loading,
    ownershipLoading,
    ownershipCoverageWarning,
    ownershipWarning,
    onStatusChange,
    riskRows.length,
    snapshotDate,
    sustainableRows.length
  ]);

  return (
    <article className={styles.sustainabilityCard} aria-label="Sustainable versus unsustainable performances">
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Sustainable vs Unsustainable</h3>
        <span className={styles.panelMeta}>L10 • {metaSnapshot}</span>
      </header>

      {(loading || ownershipLoading) && <p className={styles.panelState}>Loading sustainability signals...</p>}
      {!loading && error && <p className={styles.panelState}>Error: {error}</p>}

      {!loading && !error && sustainableRows.length === 0 && riskRows.length === 0 && (
        <p className={styles.panelState}>No sustainability signals available for this date.</p>
      )}
      {!loading && !error && isStale && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          Showing nearest available snapshot ({snapshotDate}).
        </p>
      )}

      {!loading && !error && (sustainableRows.length > 0 || riskRows.length > 0) && (
        <>
          <div className={styles.insightLegend} aria-label="Sustainability signal guide">
            <div className={styles.insightLegendItem}>
              <span className={`${styles.susBadge} ${styles.susBadgeStable}`}>
                {trustworthyGuide.label}
              </span>
              <span className={styles.insightLegendText}>{trustworthyGuide.detail}</span>
            </div>
            <div className={styles.insightLegendItem}>
              <span className={`${styles.susBadge} ${styles.susBadgeRisk}`}>
                {overheatedGuide.label}
              </span>
              <span className={styles.insightLegendText}>{overheatedGuide.detail}</span>
            </div>
            <div className={styles.insightLegendItem}>
              <span className={`${styles.insightContextPill} ${styles.insightRoutePill}`}>
                Trends drill-in
              </span>
              <span className={styles.insightLegendText}>
                Sustainability rows open the Trends player page where the longer signal history lives.
              </span>
            </div>
          </div>
          <div className={styles.sustainabilityColumns}>
            <div className={styles.susColumn}>
              <p className={styles.susColumnTitle}>Sustainable Risers</p>
              <ul className={styles.susList}>
                {sustainableRows.map((row, index) => {
                  const band = describeSustainabilityBand(row, "sustainable");
                  const ownershipContext = ownershipMap[row.player_id];
                  return (
                    <li key={`sustain-${row.player_id}`} className={styles.susRow}>
                      <Link
                        href={buildForgeHref(`/trends/player/${row.player_id}`, {
                          date,
                          origin: "forge-dashboard",
                          returnTo: returnToHref
                        })}
                        className={styles.susRowLink}
                      >
                        <div className={styles.susBadgeRow}>
                          <span className={`${styles.susBadge} ${styles.susBadgeStable}`}>
                            Trust {confidenceLabel(row.luck_pressure)}
                          </span>
                          <span className={styles.susBadge}>{formatPosition(row)}</span>
                          <span className={styles.susBadge}>
                            Own {ownershipContext?.ownership == null ? "--" : `${ownershipContext.ownership.toFixed(0)}%`}
                          </span>
                          <span className={styles.susBadge}>
                            5D {formatOwnershipDelta(ownershipContext?.delta)}
                          </span>
                          <span className={styles.susBadge}>S {formatScore(row.s_100)}</span>
                        </div>
                        <span className={styles.susName}>
                          {row.player_name ?? `Player ${row.player_id}`}
                        </span>
                        <span className={styles.susMeta}>
                          Luck pressure {formatSigned(row.luck_pressure)}
                        </span>
                        <div className={styles.insightContextBlock}>
                          <span
                            className={`${styles.insightContextPill} ${toneClassForPressure(row.luck_pressure)}`}
                          >
                            {band.title}
                          </span>
                          <span className={styles.insightContextText}>{band.detail}</span>
                        </div>
                        {index === 0 && ownershipContext?.sparkline?.length ? (
                          <div className={styles.playerOwnershipTrendInline}>
                            <span className={styles.playerOwnershipTrendLabel}>
                              Ownership 5D
                            </span>
                            <OwnershipSparkline
                              points={ownershipContext.sparkline}
                              variant={(ownershipContext.delta ?? 0) >= 0 ? "rise" : "fall"}
                              width={72}
                              height={24}
                              svgClassName={styles.sparkSvg}
                              areaClassName={styles.sparkArea}
                              pathClassName={styles.sparkPath}
                              riseClassName={styles.sparkRise}
                              fallClassName={styles.sparkFall}
                              emptyClassName={styles.sparkEmpty}
                            />
                          </div>
                        ) : null}
                        <span className={styles.susReason}>
                          {getReasonText(row, "sustainable")}
                        </span>
                        <span className={styles.insightRouteNote}>
                          Opens in Trends player detail
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className={styles.susColumn}>
              <p className={styles.susColumnTitle}>Unsustainable Heaters</p>
              <ul className={styles.susList}>
                {riskRows.map((row, index) => {
                  const band = describeSustainabilityBand(row, "unsustainable");
                  const ownershipContext = ownershipMap[row.player_id];
                  return (
                    <li key={`risk-${row.player_id}`} className={styles.susRow}>
                      <Link
                        href={buildForgeHref(`/trends/player/${row.player_id}`, {
                          date,
                          origin: "forge-dashboard",
                          returnTo: returnToHref
                        })}
                        className={styles.susRowLink}
                      >
                        <div className={styles.susBadgeRow}>
                          <span className={`${styles.susBadge} ${styles.susBadgeRisk}`}>
                            Heat {confidenceLabel(row.luck_pressure)}
                          </span>
                          <span className={styles.susBadge}>{formatPosition(row)}</span>
                          <span className={styles.susBadge}>
                            Own {ownershipContext?.ownership == null ? "--" : `${ownershipContext.ownership.toFixed(0)}%`}
                          </span>
                          <span className={styles.susBadge}>
                            5D {formatOwnershipDelta(ownershipContext?.delta)}
                          </span>
                          <span className={styles.susBadge}>S {formatScore(row.s_100)}</span>
                        </div>
                        <span className={styles.susName}>
                          {row.player_name ?? `Player ${row.player_id}`}
                        </span>
                        <span className={styles.susMeta}>
                          Luck pressure {formatSigned(row.luck_pressure)}
                        </span>
                        <div className={styles.insightContextBlock}>
                          <span
                            className={`${styles.insightContextPill} ${toneClassForPressure(row.luck_pressure)}`}
                          >
                            {band.title}
                          </span>
                          <span className={styles.insightContextText}>{band.detail}</span>
                        </div>
                        {index === 0 && ownershipContext?.sparkline?.length ? (
                          <div className={styles.playerOwnershipTrendInline}>
                            <span className={styles.playerOwnershipTrendLabel}>
                              Ownership 5D
                            </span>
                            <OwnershipSparkline
                              points={ownershipContext.sparkline}
                              variant={(ownershipContext.delta ?? 0) >= 0 ? "rise" : "fall"}
                              width={72}
                              height={24}
                              svgClassName={styles.sparkSvg}
                              areaClassName={styles.sparkArea}
                              pathClassName={styles.sparkPath}
                              riseClassName={styles.sparkRise}
                              fallClassName={styles.sparkFall}
                              emptyClassName={styles.sparkEmpty}
                            />
                          </div>
                        ) : null}
                        <span className={styles.susReason}>
                          {getReasonText(row, "unsustainable")}
                        </span>
                        <span className={styles.insightRouteNote}>
                          Opens in Trends player detail
                        </span>
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
