import React, { useEffect, useMemo, useState } from "react";
import { format, startOfWeek } from "date-fns";
import styles from "./TransactionTrends.module.scss";
import OwnershipSparkline, {
  type OwnershipSparkPoint
} from "./OwnershipSparkline";
import PanelStatus from "components/common/PanelStatus";
import useSchedule from "components/GameGrid/utils/useSchedule";
import { buildHomepageModulePresentation } from "lib/dashboard/freshness";
import { buildTopAddsScheduleContextMap } from "lib/dashboard/topAddsScheduleContext";
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
    "risers"
  );
  const weekStartDate = useMemo(
    () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    []
  );
  const [weekSchedule, weekNumGamesPerDay] = useSchedule(weekStartDate, false);

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
          `/api/v1/transactions/ownership-trends?${params.toString()}`
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
    staleMessage: "Ownership movement may be stale."
  });
  const leadRiser = data?.risers?.[0] ?? null;
  const leadFaller = data?.fallers?.[0] ?? null;
  const activePositionLabel = pos || "All skaters";
  const summaryWindowLabel = `${windowDays}-day window`;
  const scheduleContextMap = useMemo(
    () =>
      buildTopAddsScheduleContextMap(
        weekSchedule,
        weekNumGamesPerDay,
        weekStartDate
      ),
    [weekNumGamesPerDay, weekSchedule, weekStartDate]
  );
  const leadRiserSchedule =
    leadRiser?.teamAbbrev != null
      ? scheduleContextMap[leadRiser.teamAbbrev.toUpperCase()] ?? null
      : null;
  const leadFallerSchedule =
    leadFaller?.teamAbbrev != null
      ? scheduleContextMap[leadFaller.teamAbbrev.toUpperCase()] ?? null
      : null;

  return (
    <section
      className={styles.transactionTrends}
      aria-labelledby="trends-heading"
    >
      <div className={styles.headerRow}>
        <h2 id="trends-heading" className={styles.title}>
          Transaction <span>Trends</span>
        </h2>
      </div>
      <div className={styles.summaryIntro}>
        <p className={styles.summaryEyebrow}>Market pulse</p>
        <p className={styles.summaryBody}>
          Scan the fastest ownership moves first, then use the sparkline and delta
          columns to separate genuine momentum from short-term noise.
        </p>
      </div>
      {data && (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Scope</span>
            <strong className={styles.summaryValue}>{summaryWindowLabel}</strong>
            <span className={styles.summaryMeta}>
              {activePositionLabel} • Page{" "}
              {Math.floor((data.offset ?? offset) / (data.pageSize ?? limit)) + 1}
            </span>
          </div>
          <div className={`${styles.summaryCard} ${styles.riseSummaryCard}`}>
            <span className={styles.summaryLabel}>Lead riser</span>
            <div className={styles.summaryCardBody}>
              <div className={styles.summaryCopyBlock}>
                <strong className={styles.summaryValue}>
                  {leadRiser ? leadRiser.name : "No riser data"}
                </strong>
                <div className={styles.summaryMetaStack}>
                  <span className={styles.summaryMeta}>
                    {leadRiser
                      ? `${leadRiser.delta > 0 ? "+" : ""}${leadRiser.delta.toFixed(1)} pts • ${leadRiser.latest.toFixed(1)}% rostered`
                      : "No movement available"}
                  </span>
                  <span className={styles.summaryMeta}>
                    {leadRiser
                      ? [leadRiser.teamAbbrev, leadRiser.displayPosition]
                          .filter(Boolean)
                          .join(" • ")
                      : "No team context available"}
                  </span>
                </div>
              </div>
              <div className={styles.summaryStatRow}>
                <span className={`${styles.summaryStat} ${styles.riseStat}`}>
                  {leadRiserSchedule
                    ? `${leadRiserSchedule.gamesRemaining} GP`
                    : "GP --"}
                </span>
                <span className={`${styles.summaryStat} ${styles.riseStat}`}>
                  {leadRiserSchedule
                    ? `${leadRiserSchedule.offNightsRemaining} off`
                    : "Off --"}
                </span>
              </div>
            </div>
          </div>
          <div className={`${styles.summaryCard} ${styles.fallSummaryCard}`}>
            <span className={styles.summaryLabel}>Lead faller</span>
            <div className={styles.summaryCardBody}>
              <div className={styles.summaryCopyBlock}>
                <strong className={styles.summaryValue}>
                  {leadFaller ? leadFaller.name : "No faller data"}
                </strong>
                <div className={styles.summaryMetaStack}>
                  <span className={styles.summaryMeta}>
                    {leadFaller
                      ? `${leadFaller.delta.toFixed(1)} pts • ${leadFaller.latest.toFixed(1)}% rostered`
                      : "No movement available"}
                  </span>
                  <span className={styles.summaryMeta}>
                    {leadFaller
                      ? [leadFaller.teamAbbrev, leadFaller.displayPosition]
                          .filter(Boolean)
                          .join(" • ")
                      : "No team context available"}
                  </span>
                </div>
              </div>
              <div className={styles.summaryStatRow}>
                <span className={`${styles.summaryStat} ${styles.fallStat}`}>
                  {leadFallerSchedule
                    ? `${leadFallerSchedule.gamesRemaining} GP`
                    : "GP --"}
                </span>
                <span className={`${styles.summaryStat} ${styles.fallStat}`}>
                  {leadFallerSchedule
                    ? `${leadFallerSchedule.offNightsRemaining} off`
                    : "Off --"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={styles.headerControls}>
        <div
          className={styles.timeframeButtons}
          role="group"
          aria-label="Time windows"
        >
          {WINDOWS.map((w) => (
            <button
              key={w}
              className={w === windowDays ? `${styles.isActive} active` : ""}
              onClick={() => setWindowDays(w)}
            >
              {w}D
            </button>
          ))}
        </div>
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
                Top Risers (% Change Δ {data.windowDays}D)
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
                      Own
                    </th>
                    <th scope="col" className={styles.sparkCell}>
                      Trend
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      % Change Δ
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
                              <span className={styles.playerName}>{p.name}</span>
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
                Top Fallers (% Change Δ {data.windowDays}D)
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
                      Own
                    </th>
                    <th scope="col" className={styles.sparkCell}>
                      Trend
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      % Change Δ
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
                              <span className={styles.playerName}>{p.name}</span>
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
          <div className={`${styles.tablesWrapper} ${styles.mobileTabs}`}>
            <div
              className={`${styles.panel} ${
                activeTable === "risers"
                  ? styles.risersPanel
                  : styles.fallersPanel
              }`}
            >
              <div className={styles.tableTabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTable === "risers"}
                  className={`${styles.tabButton} ${styles.riseTab} ${
                    activeTable === "risers" ? "active" : ""
                  }`}
                  onClick={() => setActiveTable("risers")}
                >
                  Risers
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTable === "fallers"}
                  className={`${styles.tabButton} ${styles.fallTab} ${
                    activeTable === "fallers" ? "active" : ""
                  }`}
                  onClick={() => setActiveTable("fallers")}
                >
                  Fallers
                </button>
              </div>
              <h3 className={styles.tableTitle}>
                {activeTable === "risers"
                  ? `Top Risers (% Change Δ ${data.windowDays}D)`
                  : `Top Fallers (% Change Δ ${data.windowDays}D)`}
              </h3>
              <table
                className={styles.dataTable}
                aria-label={
                  activeTable === "risers"
                    ? "Top ownership risers"
                    : "Top ownership fallers"
                }
              >
                <thead>
                  <tr>
                    <th scope="col" className={styles.rankCell}>
                      #
                    </th>
                    <th scope="col">Player</th>
                    <th scope="col" className={styles.ownCellHeader}>
                      Own
                    </th>
                    <th scope="col" className={styles.sparkCell}>
                      Trend
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      % Change Δ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTable === "risers" ? data.risers : data.fallers).map(
                    (p, idx) => (
                      <tr key={p.playerKey}>
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
                                <span className={styles.playerName}>
                                  {p.name}
                                </span>
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
                          <div
                            className={`${styles.neonBox} ${
                              activeTable === "risers"
                                ? styles.rise
                                : styles.fall
                            }`}
                          >
                            {p.latest.toFixed(1)}%
                          </div>
                        </td>
                        <td className={styles.sparkCell}>
                          <div
                            className={`${styles.neonBox} ${
                              activeTable === "risers"
                                ? styles.rise
                                : styles.fall
                            }`}
                          >
                            <OwnershipSparkline
                              points={p.sparkline}
                              variant={
                                activeTable === "risers" ? "rise" : "fall"
                              }
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
                            className={`${styles.neonBox} ${
                              activeTable === "risers"
                                ? styles.rise
                                : styles.fall
                            } ${styles.deltaBox}`}
                          >
                            <div className={styles.deltaSparkBackdrop}>
                              <OwnershipSparkline
                                points={p.sparkline}
                                variant={
                                  activeTable === "risers" ? "rise" : "fall"
                                }
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
                              {activeTable === "risers" && p.delta > 0
                                ? `+${p.delta.toFixed(1)}%`
                                : `${p.delta.toFixed(1)}%`}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {data && (
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
                    ? data.totalRisers ?? data.risers.length
                    : data.totalFallers ?? data.fallers.length) <= offset + limit
                )
              }
            >
              Next
            </button>
          </div>
        </div>
      )}
      <p className={styles.footNote}>
        Δ = change in Yahoo! percent ownership (percentage points) over selected
        window. Sparkline shows recent daily trajectory.
      </p>
    </section>
  );
}
