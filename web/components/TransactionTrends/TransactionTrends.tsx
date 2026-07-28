import React, { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./TransactionTrends.module.scss";
import OwnershipSparkline, {
  type OwnershipSparkPoint,
} from "./OwnershipSparkline";
import PanelStatus from "components/common/PanelStatus";
import { buildHomepageModulePresentation } from "lib/dashboard/freshness";
type TrendPlayer = {
  playerKey: string;
  playerId?: number | null;
  name: string;
  headshot: string | null;
  displayPosition?: string | null;
  teamFullName?: string | null;
  teamAbbrev?: string | null;
  eligiblePositions?: string[] | null;
  uniformNumber?: number | null;
  latest: number;
  previous: number;
  delta: number;
  deltaPct: number;
  sparkline: OwnershipSparkPoint[];
};

interface ApiResponse {
  success: boolean;
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
const HOMEPAGE_MOBILE_ROW_LIMIT = 5;

type TrendDirection = "risers" | "fallers";

function MobileTrendPanel({
  direction,
  players,
  windowDays,
}: {
  direction: TrendDirection;
  players: TrendPlayer[];
  windowDays: number;
}) {
  const isRise = direction === "risers";
  const variant = isRise ? "rise" : "fall";
  const title = isRise ? "Top Risers" : "Top Fallers";

  return (
    <section
      id={`mobile-${direction}-panel`}
      className={`${styles.mobileTrendPanel} ${
        isRise ? styles.mobileRisersPanel : styles.mobileFallersPanel
      }`}
      aria-labelledby={`mobile-${direction}-heading`}
    >
      <h3
        id={`mobile-${direction}-heading`}
        className={styles.mobilePanelTitle}
        tabIndex={-1}
      >
        {title} ({windowDays}D)
      </h3>
      <ol className={styles.mobilePlayerList}>
        {players.slice(0, HOMEPAGE_MOBILE_ROW_LIMIT).map((player, index) => (
          <li
            key={player.playerKey}
            className={`${styles.mobilePlayerRow} ${
              isRise ? styles.mobileRiseRow : styles.mobileFallRow
            }`}
          >
            <span className={styles.mobileRank} aria-hidden="true">
              {index + 1}
            </span>
            {player.headshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.headshot}
                alt=""
                className={styles.mobileHeadshot}
                loading="lazy"
              />
            ) : (
              <span
                className={`${styles.mobileHeadshot} ${styles.mobileHeadshotFallback}`}
                aria-hidden="true"
              />
            )}
            <span className={styles.mobilePlayerIdentity}>
              {player.playerId ? (
                <Link
                  href={`/trends/player/${player.playerId}`}
                  className={styles.mobilePlayerName}
                >
                  {player.name}
                </Link>
              ) : (
                <span className={styles.mobilePlayerName}>{player.name}</span>
              )}
              <span className={styles.mobilePlayerMeta}>
                {Array.isArray(player.eligiblePositions) &&
                player.eligiblePositions.length
                  ? player.eligiblePositions.join(", ")
                  : player.displayPosition || ""}
                {(player.teamAbbrev || player.teamFullName) &&
                (player.displayPosition ||
                  (player.eligiblePositions &&
                    player.eligiblePositions.length))
                  ? " • "
                  : ""}
                {player.teamAbbrev || player.teamFullName || ""}
              </span>
            </span>
            <span className={styles.mobileOwnership}>
              <strong>{player.latest.toFixed(0)}%</strong>
              <small>Own</small>
            </span>
            <span className={styles.mobileSparkline}>
              <OwnershipSparkline
                points={player.sparkline}
                variant={variant}
                width={100}
                height={40}
                baseline
                svgClassName={styles.mobileSparkSvg}
                baselineClassName={styles.sparkBaseline}
                areaClassName={styles.sparkArea}
                pathClassName={styles.sparkPath}
                riseClassName={styles.rise}
                fallClassName={styles.fall}
              />
            </span>
            <span
              className={styles.mobileDelta}
              aria-label={`${isRise ? "Up" : "Down"} ${Math.abs(
                player.delta,
              ).toFixed(1)} percentage points`}
            >
              <span aria-hidden="true">{isRise ? "▲" : "▼"}</span>{" "}
              {Math.abs(player.delta).toFixed(1)}%
            </span>
          </li>
        ))}
      </ol>
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

export default function TransactionTrends() {
  // Default to 3-day window per request
  const [windowDays, setWindowDays] = useState(3);
  const [pos, setPos] = useState<string>("");
  const [limit, setLimit] = useState<number>(10);
  const [offset, setOffset] = useState<number>(0);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<"risers" | "fallers">(
    "risers",
  );

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("window", String(windowDays));
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        if (pos) params.set("pos", pos);
        const res = await fetch(
          `/api/v1/transactions/ownership-trends?${params.toString()}`,
        );
        const body = await res.text();
        if (!res.ok) {
          throw new Error(summarizeTransactionTrendError(res.status, body));
        }
        const json: ApiResponse = JSON.parse(body);
        if (!active) return;
        if (!json.success) throw new Error(json.error || "Unknown error");
        setData(json);
      } catch (e: any) {
        if (active) setError(e.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [windowDays, pos, offset, limit]);

  // Reset paging when filters change
  useEffect(() => {
    setOffset(0);
  }, [windowDays, pos]);

  useEffect(() => {
    setOffset(0);
  }, [activeTable]);

  const focusMobilePanel = (direction: TrendDirection) => {
    setActiveTable(direction);
    const heading = document.getElementById(`mobile-${direction}-heading`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: "nearest" });
  };

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
    loadingMessage: "Loading ownership movement...",
    emptyMessage: "No ownership movement is available right now.",
    staleMessage: "Ownership movement may be stale.",
  });
  const supportingCopy =
    windowDays === 1
      ? "Ownership movement over the last day."
      : `Ownership movement over the last ${windowDays} days.`;

  return (
    <section
      className={styles.transactionTrends}
      aria-labelledby="trends-heading"
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
        </div>
        <div className={styles.trendControls}>
          <div className={styles.headerControls}>
            <span className={styles.filterLabel}>Position</span>
            <div
              className={styles.posButtons}
              role="group"
              aria-label="Position filter"
            >
              {POSITION_FILTERS.map((p) => (
                <button
                  key={p || "ALL"}
                  className={p === pos ? `${styles.isActive} active` : ""}
                  onClick={() => setPos(p)}
                  title={p ? `Filter: ${p}` : "All positions"}
                >
                  {p || "All"}
                </button>
              ))}
            </div>
          </div>
          <div
            className={styles.timeframeButtons}
            role="group"
            aria-label="Time windows"
          >
            {WINDOWS.map((w) => (
              <button
                key={w}
                className={
                  w === windowDays ? `${styles.isActive} active` : ""
                }
                onClick={() => setWindowDays(w)}
              >
                {w}D
              </button>
            ))}
          </div>
        </div>
      </div>
      {modulePresentation.panelState && (
        <PanelStatus
          state={modulePresentation.panelState}
          message={modulePresentation.message ?? ""}
          className={styles.statusPanel}
        />
      )}
      {data && modulePresentation.state !== "empty" && (
        <>
          <div className={`${styles.tablesWrapper} ${styles.desktopTables}`}>
            <div className={`${styles.panel} ${styles.risersPanel}`}>
              <h3 className={styles.tableTitle}>
                Top Risers (Δ {data.windowDays}D)
              </h3>
              <table
                className={styles.dataTable}
                aria-label="Top ownership risers"
              >
                <thead>
                  <tr>
                    <th scope="col" className={styles.rankCell}>
                      #
                    </th>
                    <th scope="col">Player</th>
                    <th scope="col" className={styles.ownCellHeader}>
                      Own %
                    </th>
                    <th scope="col" className={styles.sparkCell}>
                      Trend
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      Δ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.risers.map((p, idx) => (
                    <tr key={p.playerKey} className={styles.riseRow}>
                      <th scope="row" className={styles.rankCell}>
                        {offset + idx + 1}
                      </th>
                      <td className={styles.playerCell}>
                        <div className={styles.rowBox}>
                          {p.headshot ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.headshot}
                              alt=""
                              className={styles.headshot}
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className={styles.headshot}
                              style={{ background: "#333" }}
                            />
                          )}
                          <div className={styles.playerTextWrap}>
                            <span className={styles.playerText}>
                              {p.playerId ? (
                                <Link
                                  href={`/trends/player/${p.playerId}`}
                                  className={styles.playerName}
                                >
                                  {p.name}
                                </Link>
                              ) : (
                                <span className={styles.playerName}>
                                  {p.name}
                                </span>
                              )}
                              {(p.displayPosition ||
                                p.teamFullName ||
                                p.teamAbbrev ||
                                p.eligiblePositions ||
                                p.uniformNumber !== undefined) && (
                                <span
                                  className={`${styles.playerMeta} ${p.teamAbbrev ? styles.hasAbbrev : ""}`}
                                >
                                  {Array.isArray(p.eligiblePositions) &&
                                  p.eligiblePositions.length
                                    ? p.eligiblePositions.join(", ")
                                    : p.displayPosition || ""}
                                  {(p.teamFullName || p.teamAbbrev) &&
                                  (p.displayPosition ||
                                    (p.eligiblePositions &&
                                      p.eligiblePositions.length))
                                    ? " • "
                                    : ""}
                                  {p.teamFullName ? (
                                    <span className={styles.teamFullName}>
                                      {p.teamFullName}
                                    </span>
                                  ) : null}
                                  {p.teamAbbrev ? (
                                    <span className={styles.teamAbbrev}>
                                      {p.teamAbbrev}
                                    </span>
                                  ) : null}
                                  {typeof p.uniformNumber === "number"
                                    ? ` • #${p.uniformNumber}`
                                    : ""}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={styles.ownCell}>
                        <div className={`${styles.neonBox} ${styles.rise}`}>
                          {p.latest.toFixed(1)}%
                        </div>
                      </td>
                      <td className={styles.sparkCell}>
                        <div className={`${styles.neonBox} ${styles.rise}`}>
                          <OwnershipSparkline
                            points={p.sparkline}
                            variant="rise"
                            width={100}
                            height={40}
                            baseline
                            svgClassName={styles.sparkSvg}
                            baselineClassName={styles.sparkBaseline}
                            areaClassName={styles.sparkArea}
                            pathClassName={styles.sparkPath}
                            riseClassName={styles.rise}
                            fallClassName={styles.fall}
                          />
                        </div>
                      </td>
                      <td className={styles.deltaCell}>
                        <div
                          className={`${styles.neonBox} ${styles.rise} ${styles.deltaBox}`}
                        >
                          <div className={styles.deltaSparkBackdrop}>
                            <OwnershipSparkline
                              points={p.sparkline}
                              variant="rise"
                              width={100}
                              height={40}
                              baseline
                              svgClassName={styles.sparkSvg}
                              baselineClassName={styles.sparkBaseline}
                              areaClassName={styles.sparkArea}
                              pathClassName={styles.sparkPath}
                              riseClassName={styles.rise}
                              fallClassName={styles.fall}
                            />
                          </div>
                          <div className={styles.deltaContent}>
                            {p.delta > 0
                              ? `+${p.delta.toFixed(1)}%`
                              : `${p.delta.toFixed(1)}%`}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`${styles.panel} ${styles.fallersPanel}`}>
              <h3 className={styles.tableTitle}>
                Top Fallers (Δ {data.windowDays}D)
              </h3>
              <table
                className={styles.dataTable}
                aria-label="Top ownership fallers"
              >
                <thead>
                  <tr>
                    <th scope="col" className={styles.rankCell}>
                      #
                    </th>
                    <th scope="col">Player</th>
                    <th scope="col" className={styles.ownCellHeader}>
                      Own %
                    </th>
                    <th scope="col" className={styles.sparkCell}>
                      Trend
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      Δ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.fallers.map((p, idx) => (
                    <tr key={p.playerKey} className={styles.fallRow}>
                      <th scope="row" className={styles.rankCell}>
                        {offset + idx + 1}
                      </th>
                      <td className={styles.playerCell}>
                        <div className={styles.rowBox}>
                          {p.headshot ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.headshot}
                              alt=""
                              className={styles.headshot}
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className={styles.headshot}
                              style={{ background: "#333" }}
                            />
                          )}
                          <div className={styles.playerTextWrap}>
                            <span className={styles.playerText}>
                              {p.playerId ? (
                                <Link
                                  href={`/trends/player/${p.playerId}`}
                                  className={styles.playerName}
                                >
                                  {p.name}
                                </Link>
                              ) : (
                                <span className={styles.playerName}>
                                  {p.name}
                                </span>
                              )}
                              {(p.displayPosition ||
                                p.teamFullName ||
                                p.teamAbbrev ||
                                p.eligiblePositions ||
                                p.uniformNumber !== undefined) && (
                                <span
                                  className={`${styles.playerMeta} ${p.teamAbbrev ? styles.hasAbbrev : ""}`}
                                >
                                  {Array.isArray(p.eligiblePositions) &&
                                  p.eligiblePositions.length
                                    ? p.eligiblePositions.join(", ")
                                    : p.displayPosition || ""}
                                  {(p.teamFullName || p.teamAbbrev) &&
                                  (p.displayPosition ||
                                    (p.eligiblePositions &&
                                      p.eligiblePositions.length))
                                    ? " • "
                                    : ""}
                                  {p.teamFullName ? (
                                    <span className={styles.teamFullName}>
                                      {p.teamFullName}
                                    </span>
                                  ) : null}
                                  {p.teamAbbrev ? (
                                    <span className={styles.teamAbbrev}>
                                      {p.teamAbbrev}
                                    </span>
                                  ) : null}
                                  {typeof p.uniformNumber === "number"
                                    ? ` • #${p.uniformNumber}`
                                    : ""}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={styles.ownCell}>
                        <div className={`${styles.neonBox} ${styles.fall}`}>
                          {p.latest.toFixed(1)}%
                        </div>
                      </td>
                      <td className={styles.sparkCell}>
                        <div className={`${styles.neonBox} ${styles.fall}`}>
                          <OwnershipSparkline
                            points={p.sparkline}
                            variant="fall"
                            width={100}
                            height={40}
                            baseline
                            svgClassName={styles.sparkSvg}
                            baselineClassName={styles.sparkBaseline}
                            areaClassName={styles.sparkArea}
                            pathClassName={styles.sparkPath}
                            riseClassName={styles.rise}
                            fallClassName={styles.fall}
                          />
                        </div>
                      </td>
                      <td className={styles.deltaCell}>
                        <div
                          className={`${styles.neonBox} ${styles.fall} ${styles.deltaBox}`}
                        >
                          <div className={styles.deltaSparkBackdrop}>
                            <OwnershipSparkline
                              points={p.sparkline}
                              variant="fall"
                              width={100}
                              height={40}
                              baseline
                              svgClassName={styles.sparkSvg}
                              baselineClassName={styles.sparkBaseline}
                              areaClassName={styles.sparkArea}
                              pathClassName={styles.sparkPath}
                              riseClassName={styles.rise}
                              fallClassName={styles.fall}
                            />
                          </div>
                          <div className={styles.deltaContent}>
                            {p.delta.toFixed(1)}%
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={styles.mobileTrends}>
            <div
              className={styles.mobileDirectionNav}
              role="group"
              aria-label="Trend direction"
            >
              <button
                type="button"
                aria-pressed={activeTable === "risers"}
                aria-controls="mobile-risers-panel"
                className={activeTable === "risers" ? styles.isActive : ""}
                onClick={() => focusMobilePanel("risers")}
              >
                Risers
              </button>
              <button
                type="button"
                aria-pressed={activeTable === "fallers"}
                aria-controls="mobile-fallers-panel"
                className={activeTable === "fallers" ? styles.isActive : ""}
                onClick={() => focusMobilePanel("fallers")}
              >
                Fallers
              </button>
            </div>
            <MobileTrendPanel
              direction="risers"
              players={data.risers}
              windowDays={data.windowDays}
            />
            <MobileTrendPanel
              direction="fallers"
              players={data.fallers}
              windowDays={data.windowDays}
            />
          </div>
        </>
      )}
      {data && modulePresentation.state !== "empty" && (
        <div className={styles.pager} role="navigation" aria-label="Pagination">
          <div className={styles.pagerInfo}>
            <span>
              Page{" "}
              {Math.floor((data.offset ?? offset) / (data.pageSize ?? limit)) +
                1}
            </span>
            <span className={styles.separator}>•</span>
            <span>
              Risers: {data.totalRisers ?? data.risers.length} | Fallers:{" "}
              {data.totalFallers ?? data.fallers.length}
            </span>
          </div>
          <div className={styles.pagerButtons}>
            <button
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              disabled={offset === 0}
            >
              Prev
            </button>
            <button
              onClick={() => setOffset((o) => o + limit)}
              disabled={
                !!(
                  (activeTable === "risers"
                    ? (data.totalRisers ?? data.risers.length)
                    : (data.totalFallers ?? data.fallers.length)) <=
                  offset + limit
                )
              }
            >
              Next
            </button>
          </div>
        </div>
      )}
      {data && modulePresentation.state !== "empty" ? (
        <p className={styles.footNote}>
          Δ = change in Yahoo! percent ownership (percentage points) over
          selected window. Sparkline shows recent daily trajectory.
        </p>
      ) : null}
    </section>
  );
}
