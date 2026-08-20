import React, { useEffect, useState } from "react";
import Link from "next/link";

import PanelStatus from "components/common/PanelStatus";
import { buildHomepageModulePresentation } from "lib/dashboard/freshness";
import {
  formatTrendPlayerMetadata,
  normalizeTrendTeamName,
} from "lib/transactions/ownershipTrendMetadata";

import OwnershipSparkline, {
  type OwnershipSparkPoint,
} from "./OwnershipSparkline";
import styles from "./TransactionTrends.module.scss";

type TrendPlayer = {
  playerKey: string;
  playerId?: number | null;
  name: string;
  headshot: string | null;
  displayPosition?: unknown;
  teamFullName?: unknown;
  teamAbbrev?: unknown;
  eligiblePositions?: unknown;
  uniformNumber?: number | null;
  latest: number;
  previous: number;
  delta: number;
  deltaPct: number;
  sparkline: OwnershipSparkPoint[];
};

interface ApiResponse {
  success: boolean;
  metric?: TrendMetric;
  windowDays: number;
  generatedAt?: string;
  page?: number;
  pageSize?: number;
  offset?: number;
  pos?: string | null;
  totalRisers?: number;
  totalFallers?: number;
  risers: TrendPlayer[];
  fallers: TrendPlayer[];
  error?: string;
}

const WINDOWS = [1, 3, 5, 10];
const POSITION_FILTERS = ["", "F", "C", "LW", "RW", "D", "G"] as const;
const PAGE_SIZE = 10;

type TrendDirection = "risers" | "fallers";
type TrendMetric = "ownership" | "adp";
type TransactionTrendsProps = {
  defaultMetric?: TrendMetric;
};

function formatSignedDelta(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function TrendPanel({
  direction,
  players,
  metric,
  windowDays,
  offset,
  isMobileActive,
}: {
  direction: TrendDirection;
  players: TrendPlayer[];
  metric: TrendMetric;
  windowDays: number;
  offset: number;
  isMobileActive: boolean;
}) {
  const isRise = direction === "risers";
  const isAdp = metric === "adp";
  const variant = isRise ? "rise" : "fall";
  const title = isRise ? "Top Risers" : "Top Fallers";

  return (
    <section
      id={`${direction}-panel`}
      className={`${styles.panel} ${
        isRise ? styles.risersPanel : styles.fallersPanel
      } ${isMobileActive ? styles.isMobileActive : ""}`}
      aria-labelledby={`${direction}-heading`}
    >
      <h3 id={`${direction}-heading`} className={styles.tableTitle} tabIndex={-1}>
        {title} (Δ {windowDays}D)
      </h3>
      <table className={styles.dataTable} aria-label={title}>
        <thead>
          <tr>
            <th scope="col" className={styles.rankCell}>
              #
            </th>
            <th scope="col" className={styles.playerHeader}>
              Player
            </th>
            <th scope="col" className={styles.metadataCell}>
              Team · Elig
            </th>
            <th scope="col" className={styles.ownCell}>
              {isAdp ? "Avg Pick" : "Own %"}
            </th>
            <th scope="col" className={styles.sparkCell}>
              Trend ({windowDays}D)
            </th>
            <th scope="col" className={styles.deltaCell}>
              Δ {windowDays}D
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => {
            const metadata = formatTrendPlayerMetadata(player);
            const teamFullName = normalizeTrendTeamName(player.teamFullName);
            const metadataTitle = teamFullName
              ? `${metadata.label} — ${teamFullName}`
              : metadata.label;
            const displayedDelta = isAdp ? player.deltaPct : player.delta;
            const signedDelta = formatSignedDelta(displayedDelta);
            const movementLabel = Number.isFinite(displayedDelta)
              ? isAdp
                ? `Average pick moved ${Math.abs(displayedDelta).toFixed(1)}% ${
                    isRise ? "earlier" : "later"
                  }`
                : `${isRise ? "Up" : "Down"} ${Math.abs(
                    displayedDelta,
                  ).toFixed(1)} percentage points`
              : `${isAdp ? "ADP" : "Ownership"} movement unavailable`;

            return (
              <tr key={player.playerKey}>
                <th scope="row" className={styles.rankCell}>
                  {offset + index + 1}
                </th>
                <td className={styles.playerCell}>
                  <div className={styles.playerIdentity}>
                    {player.headshot ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={player.headshot}
                        alt=""
                        className={styles.headshot}
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className={`${styles.headshot} ${styles.headshotFallback}`}
                        aria-hidden="true"
                      />
                    )}
                    <span className={styles.playerCopy}>
                      {player.playerId ? (
                        <Link
                          href={`/trends/player/${player.playerId}`}
                          className={styles.playerName}
                          title={player.name}
                        >
                          {player.name}
                        </Link>
                      ) : (
                        <span className={styles.playerName} title={player.name}>
                          {player.name}
                        </span>
                      )}
                      <span
                        className={styles.mobilePlayerMeta}
                        title={metadataTitle}
                      >
                        {metadata.label}
                      </span>
                    </span>
                  </div>
                </td>
                <td className={styles.metadataCell} title={metadataTitle}>
                  {metadata.label}
                </td>
                <td className={styles.ownCell}>
                  {Number.isFinite(player.latest)
                    ? `${player.latest.toFixed(1)}${isAdp ? "" : "%"}`
                    : "—"}
                </td>
                <td className={styles.sparkCell}>
                  <span
                    className={styles.sparkline}
                    role="img"
                    aria-label={`${player.name} ${
                      isAdp ? "average draft pick" : "ownership"
                    } trend over ${windowDays} days`}
                  >
                    <OwnershipSparkline
                      points={player.sparkline}
                      variant={variant}
                      width={100}
                      height={24}
                      invert={isAdp}
                      svgClassName={styles.sparkSvg}
                      areaClassName={styles.sparkArea}
                      pathClassName={styles.sparkPath}
                      riseClassName={styles.rise}
                      fallClassName={styles.fall}
                      emptyClassName={styles.emptySparkline}
                    />
                  </span>
                </td>
                <td className={styles.deltaCell}>
                  <span
                    className={`${styles.deltaValue} ${
                      isRise ? styles.deltaPositive : styles.deltaNegative
                    }`}
                    aria-label={movementLabel}
                  >
                    <span aria-hidden="true">{isRise ? "▲" : "▼"}</span>{" "}
                    <span aria-hidden="true">{signedDelta}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function summarizeTransactionTrendError(status: number, body: string): string {
  if (status === 503) {
    return "Transaction trend data is temporarily unavailable.";
  }

  if (
    body.includes("<!DOCTYPE html") ||
    body.includes("<html") ||
    body.includes("Connection timed out")
  ) {
    return "Transaction trend data is temporarily unavailable.";
  }

  try {
    const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error;
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    // Fall through to generic message.
  }

  return `Transaction trend request failed (${status}).`;
}

export default function TransactionTrends({
  defaultMetric = "adp",
}: TransactionTrendsProps) {
  const [windowDays, setWindowDays] = useState(3);
  const [metric, setMetric] = useState<TrendMetric>(defaultMetric);
  const [pos, setPos] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<TrendDirection>("risers");

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("window", String(windowDays));
        params.set("metric", metric);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));
        if (pos) params.set("pos", pos);

        const response = await fetch(
          `/api/v1/transactions/ownership-trends?${params.toString()}`,
        );
        const body = await response.text();
        if (!response.ok) {
          throw new Error(
            summarizeTransactionTrendError(response.status, body),
          );
        }

        const json: ApiResponse = JSON.parse(body);
        if (!active) return;
        if (!json.success) throw new Error(json.error || "Unknown error");
        setData(json);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [windowDays, metric, pos, offset]);

  useEffect(() => {
    setOffset(0);
  }, [windowDays, metric, pos, activeTable]);

  const selectMetric = (nextMetric: TrendMetric) => {
    if (nextMetric === metric) return;
    setData(null);
    setMetric(nextMetric);
  };

  const selectMobilePanel = (direction: TrendDirection) => {
    setActiveTable(direction);
    window.setTimeout(() => {
      const heading = document.getElementById(`${direction}-heading`);
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView?.({ block: "nearest" });
    }, 0);
  };

  const isAdp = metric === "adp";
  const movementName = isAdp ? "ADP movement" : "ownership movement";
  const modulePresentation = buildHomepageModulePresentation({
    source: "transaction-trends",
    loading,
    error,
    isEmpty:
      Boolean(data) &&
      Array.isArray(data?.risers) &&
      Array.isArray(data?.fallers) &&
      data.risers.length + data.fallers.length === 0,
    timestamp: data?.generatedAt ?? null,
    maxAgeHours: 18,
    loadingMessage: `Loading ${movementName}...`,
    emptyMessage: `No ${movementName} is available right now.`,
    staleMessage: `${isAdp ? "ADP" : "Ownership"} movement may be stale.`,
  });
  const supportingCopy =
    windowDays === 1
      ? `${isAdp ? "Average draft pick" : "Ownership"} movement over the last day.`
      : `${isAdp ? "Average draft pick" : "Ownership"} movement over the last ${windowDays} days.`;
  const showData = Boolean(data) && modulePresentation.state !== "empty";
  const totalRisers = data?.totalRisers ?? data?.risers.length ?? 0;
  const totalFallers = data?.totalFallers ?? data?.fallers.length ?? 0;
  const hasNextPage = Math.max(totalRisers, totalFallers) > offset + PAGE_SIZE;

  return (
    <section
      className={styles.transactionTrends}
      aria-labelledby="trends-heading"
      aria-busy={loading}
    >
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <div className={styles.titleLine}>
            <h2 id="trends-heading" className={styles.title}>
              Transaction <span>Trends</span>
            </h2>
            <Link href="/trends" className={styles.viewAllLink}>
              View all
            </Link>
          </div>
          <p className={styles.subtitle}>{supportingCopy}</p>
          {modulePresentation.state === "stale" ? (
            <div className={styles.staleNotice} role="status">
              <span aria-hidden="true">●</span>{" "}
              {modulePresentation.message}
            </div>
          ) : null}
        </div>

        <div className={styles.trendControls}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Metric</span>
            <div
              className={styles.metricButtons}
              role="group"
              aria-label="Trend metric"
            >
              {(["ownership", "adp"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === metric ? styles.isActive : ""}
                  aria-pressed={option === metric}
                  onClick={() => selectMetric(option)}
                >
                  {option === "adp" ? "ADP" : "Ownership"}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Position</span>
            <div
              className={styles.posButtons}
              role="group"
              aria-label="Position filter"
            >
              {POSITION_FILTERS.map((position) => (
                <button
                  key={position || "ALL"}
                  type="button"
                  className={position === pos ? styles.isActive : ""}
                  aria-pressed={position === pos}
                  onClick={() => setPos(position)}
                  title={position ? `Filter: ${position}` : "All positions"}
                >
                  {position || "All"}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Timeframe</span>
            <div
              className={styles.timeframeButtons}
              role="group"
              aria-label="Time windows"
            >
              {WINDOWS.map((window) => (
                <button
                  key={window}
                  type="button"
                  className={window === windowDays ? styles.isActive : ""}
                  aria-pressed={window === windowDays}
                  onClick={() => setWindowDays(window)}
                >
                  {window}D
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modulePresentation.panelState &&
      modulePresentation.state !== "stale" ? (
        <PanelStatus
          state={modulePresentation.panelState}
          message={modulePresentation.message ?? ""}
          className={styles.statusPanel}
        />
      ) : null}

      {showData && data ? (
        <>
          <div
            className={styles.mobileDirectionNav}
            role="group"
            aria-label="Trend direction"
          >
            <button
              type="button"
              aria-pressed={activeTable === "risers"}
              aria-controls="risers-panel"
              className={activeTable === "risers" ? styles.isActive : ""}
              onClick={() => selectMobilePanel("risers")}
            >
              Risers
            </button>
            <button
              type="button"
              aria-pressed={activeTable === "fallers"}
              aria-controls="fallers-panel"
              className={activeTable === "fallers" ? styles.isActive : ""}
              onClick={() => selectMobilePanel("fallers")}
            >
              Fallers
            </button>
          </div>

          <div className={styles.tablesWrapper}>
            <TrendPanel
              direction="risers"
              players={data.risers}
              metric={metric}
              windowDays={data.windowDays}
              offset={offset}
              isMobileActive={activeTable === "risers"}
            />
            <TrendPanel
              direction="fallers"
              players={data.fallers}
              metric={metric}
              windowDays={data.windowDays}
              offset={offset}
              isMobileActive={activeTable === "fallers"}
            />
          </div>

          <footer className={styles.footer}>
            <div className={styles.footerCopy}>
              <div className={styles.pagerInfo}>
                <span>Page {Math.floor(offset / PAGE_SIZE) + 1}</span>
                <span className={styles.separator}>·</span>
                <span>
                  Risers: {totalRisers} | Fallers: {totalFallers}
                </span>
              </div>
              <p className={styles.footNote}>
                {isAdp
                  ? "Δ = relative change in Yahoo! average draft pick over the selected window; lower average picks rank as risers. Sparkline shows recent daily average-pick trajectory."
                  : "Δ = change in Yahoo! percent ownership (percentage points) over the selected window. Sparkline shows recent daily trajectory."}
              </p>
            </div>
            <nav className={styles.pagerButtons} aria-label="Pagination">
              <button
                type="button"
                onClick={() =>
                  setOffset((current) => Math.max(0, current - PAGE_SIZE))
                }
                disabled={offset === 0}
              >
                <span aria-hidden="true">‹</span> Prev
              </button>
              <button
                type="button"
                onClick={() => setOffset((current) => current + PAGE_SIZE)}
                disabled={!hasNextPage}
              >
                Next <span aria-hidden="true">›</span>
              </button>
            </nav>
          </footer>
        </>
      ) : null}
    </section>
  );
}
