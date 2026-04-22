import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { format } from "date-fns";

import DashboardPillarHero from "components/dashboard/DashboardPillarHero";
import { TRENDS_SURFACE_LINKS } from "lib/navigation/siteSurfaceLinks";
import { teamsInfo } from "lib/teamsInfo";
import {
  extractReasonHighlights,
  SANDBOX_ENTITY_CONFIG,
  type SandboxBandRow,
  type SandboxEntityType,
  type SandboxScoreRow
} from "lib/sustainability/entitySurface";
import styles from "./trends/sandbox.module.scss";

type EntityOption = {
  id: number;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
};

type ScoresResponse = {
  success: boolean;
  snapshotDate: string | null;
  windowCode: string;
  totalRows: number;
  rows: SandboxScoreRow[];
  selectedRow: SandboxScoreRow | null;
  message?: string;
};

type BandsResponse = {
  success: boolean;
  snapshotDate: string | null;
  windowCode: string;
  currentRows: SandboxBandRow[];
  historyRows: SandboxBandRow[];
  message?: string;
};

const WINDOW_OPTIONS = ["l3", "l5", "l10", "l20"] as const;
const DEFAULT_DATE = new Date().toISOString().slice(0, 10);
const MIN_SEARCH_LENGTH = 2;

const TEAM_OPTIONS: EntityOption[] = Object.values(teamsInfo)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((team) => ({
    id: team.id,
    name: team.name,
    subtitle: team.abbrev,
    imageUrl: `/teamLogos/${team.abbrev}.png`
  }));

function formatStateLabel(state: SandboxScoreRow["expectationState"]) {
  if (state === "overperforming") return "Overperforming";
  if (state === "underperforming") return "Underperforming";
  return "Stable";
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatDelta(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function scoreToneClass(state: SandboxScoreRow["expectationState"]) {
  if (state === "overperforming") return styles.bandHot;
  if (state === "underperforming") return styles.bandCold;
  return styles.bandNeutral;
}

type ElasticityBandChartProps = {
  data: SandboxBandRow[];
  loading: boolean;
  error: string | null;
};

function ElasticityBandChart({
  data,
  loading,
  error
}: ElasticityBandChartProps) {
  const parsed = useMemo(() => {
    return data
      .map((row) => {
        const date = new Date(row.snapshotDate);
        if (Number.isNaN(date.getTime())) return null;
        const status =
          row.value > row.ciUpper
            ? "hot"
            : row.value < row.ciLower
              ? "cold"
              : "neutral";
        return {
          date,
          lower: row.ciLower,
          upper: row.ciUpper,
          value: row.value,
          baseline: row.baseline,
          status
        } as {
          date: Date;
          lower: number;
          upper: number;
          value: number;
          baseline: number | null;
          status: "hot" | "cold" | "neutral";
        };
      })
      .filter(
        (
          row
        ): row is {
          date: Date;
          lower: number;
          upper: number;
          value: number;
          baseline: number | null;
          status: "hot" | "cold" | "neutral";
        } => row != null
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(960);
  const chartHeight = 320;
  const margins = useMemo(
    () => ({ top: 32, right: 24, bottom: 48, left: 64 }),
    []
  );
  const innerWidth = Math.max(containerWidth - margins.left - margins.right, 24);
  const innerHeight = Math.max(chartHeight - margins.top - margins.bottom, 24);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateWidth = () => {
      const next = element.clientWidth || 960;
      setContainerWidth((prev) => (prev !== next ? next : prev));
    };
    updateWidth();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(element);
      return () => observer.disconnect();
    }
    const handleResize = () => updateWidth();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const latest = parsed.at(-1) ?? null;

  const geometry = useMemo(() => {
    if (!parsed.length || innerWidth <= 0 || innerHeight <= 0) {
      return null;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    parsed.forEach((row) => {
      min = Math.min(min, row.lower, row.upper, row.value);
      if (row.baseline != null) min = Math.min(min, row.baseline);
      max = Math.max(max, row.lower, row.upper, row.value);
      if (row.baseline != null) max = Math.max(max, row.baseline);
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 1;
    }
    if (max === min) {
      max += 0.5;
      min -= 0.5;
    }
    const padding = Math.max((max - min) * 0.08, 1e-3);
    const domain: [number, number] = [min - padding, max + padding];

    const extent = d3.extent(parsed, (row) => row.date);
    if (!extent[0] || !extent[1]) return null;

    const xScale = d3
      .scaleTime()
      .domain([extent[0], extent[1]])
      .range([0, innerWidth]);
    const yScale = d3
      .scaleLinear()
      .domain(domain)
      .range([innerHeight, 0])
      .nice();

    const areaGenerator = d3
      .area<typeof parsed[number]>()
      .x((d) => xScale(d.date))
      .y0((d) => yScale(d.lower))
      .y1((d) => yScale(d.upper))
      .curve(d3.curveMonotoneX);

    const lineGenerator = d3
      .line<{ date: Date; value: number }>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    const valueSeries = parsed.map((row) => ({
      date: row.date,
      value: row.value
    }));
    const baselineSeries = parsed
      .filter((row) => row.baseline != null)
      .map((row) => ({
        date: row.date,
        value: row.baseline as number
      }));

    return {
      xScale,
      yScale,
      areaPath: areaGenerator(parsed) ?? "",
      linePath: lineGenerator(valueSeries) ?? "",
      baselinePath:
        baselineSeries.length >= 2 ? lineGenerator(baselineSeries) ?? "" : "",
      xTicks: xScale.ticks(Math.min(6, parsed.length)),
      yTicks: yScale.ticks(6)
    };
  }, [parsed, innerHeight, innerWidth]);

  const statusLabel =
    latest?.status === "hot"
      ? "Running Hot"
      : latest?.status === "cold"
        ? "Running Cold"
        : "Within Band";

  const statusValueClass =
    latest?.status === "hot"
      ? styles.bandChartLatestHot
      : latest?.status === "cold"
        ? styles.bandChartLatestCold
        : styles.bandChartLatestNeutral;

  return (
    <div className={styles.bandChart}>
      <div className={styles.bandChartHeader}>
        <div className={styles.bandChartTitleBlock}>
          <span className={styles.bandChartMetric}>
            {data[0]?.metricLabel ?? "Elasticity Band"}
          </span>
          <span className={styles.bandChartWindow}>
            Window {data[0]?.windowCode?.toUpperCase() ?? "—"}
          </span>
        </div>
        <div className={styles.bandChartLatest}>
          {latest ? (
            <>
              <span className={styles.bandChartLatestValue}>
                {latest.value.toFixed(2)}
              </span>
              <span
                className={`${styles.bandChartLatestStatus} ${statusValueClass}`}
              >
                {statusLabel}
              </span>
              <span className={styles.bandChartLatestRange}>
                Band {latest.lower.toFixed(2)} – {latest.upper.toFixed(2)}
              </span>
              {latest.baseline != null && (
                <span className={styles.bandChartLatestBaseline}>
                  Baseline {latest.baseline.toFixed(2)}
                </span>
              )}
            </>
          ) : (
            <span className={styles.bandChartLatestValue}>—</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.bandChartMessage}>Loading band history…</div>
      ) : error ? (
        <div className={`${styles.bandChartMessage} ${styles.bandChartError}`}>
          {error}
        </div>
      ) : !parsed.length ? (
        <div className={styles.bandChartMessage}>
          No historical band data available yet.
        </div>
      ) : !geometry ? (
        <div className={styles.bandChartMessage}>
          Not enough room to render the band chart.
        </div>
      ) : (
        <div ref={containerRef} className={styles.bandChartWrapper}>
          <svg
            className={styles.bandChartSvg}
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${containerWidth} ${chartHeight}`}
            preserveAspectRatio="none"
          >
            <g transform={`translate(${margins.left},${margins.top})`}>
              <rect
                className={styles.bandChartPlot}
                width={innerWidth}
                height={innerHeight}
              />
              {geometry.yTicks.map((tickValue) => {
                const y = geometry.yScale(tickValue);
                return (
                  <g key={`y-${tickValue}`}>
                    <line
                      className={styles.bandChartGridline}
                      x1={0}
                      x2={innerWidth}
                      y1={y}
                      y2={y}
                    />
                    <text
                      className={`${styles.bandChartAxisText} ${styles.bandChartAxisTextY}`}
                      x={-12}
                      y={y}
                      dy="0.32em"
                      textAnchor="end"
                    >
                      {tickValue.toFixed(2)}
                    </text>
                  </g>
                );
              })}
              {geometry.xTicks.map((tickDate) => {
                const x = geometry.xScale(tickDate);
                return (
                  <g
                    key={`x-${tickDate.getTime()}`}
                    transform={`translate(${x},0)`}
                  >
                    <line
                      className={styles.bandChartGridlineVertical}
                      x1={0}
                      x2={0}
                      y1={0}
                      y2={innerHeight}
                    />
                    <text
                      className={`${styles.bandChartAxisText} ${styles.bandChartAxisTextX}`}
                      x={0}
                      y={innerHeight + 16}
                      textAnchor="middle"
                    >
                      {format(
                        tickDate,
                        parsed.length > 24 ? "MMM" : "MMM d"
                      )}
                    </text>
                  </g>
                );
              })}
              {geometry.areaPath && (
                <path className={styles.bandChartArea} d={geometry.areaPath} />
              )}
              {geometry.baselinePath && (
                <path
                  className={styles.bandChartBaseline}
                  d={geometry.baselinePath}
                />
              )}
              {geometry.linePath && (
                <path className={styles.bandChartLine} d={geometry.linePath} />
              )}
              {parsed.map((point, index) => {
                const dotClass =
                  point.status === "hot"
                    ? styles.bandChartDotHot
                    : point.status === "cold"
                      ? styles.bandChartDotCold
                      : styles.bandChartDotNeutral;
                const cx = geometry.xScale(point.date);
                const cy = geometry.yScale(point.value);
                return (
                  <circle
                    key={`${point.date.getTime()}-${index}`}
                    className={`${styles.bandChartDot} ${dotClass}`}
                    cx={cx}
                    cy={cy}
                    r={3.2}
                  />
                );
              })}
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}

export default function TrendsSandboxPage() {
  const [entityType, setEntityType] = useState<SandboxEntityType>("skater");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EntityOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null);
  const [requestedDate, setRequestedDate] = useState(DEFAULT_DATE);
  const [windowCode, setWindowCode] = useState<(typeof WINDOW_OPTIONS)[number]>(
    "l5"
  );
  const [selectedMetric, setSelectedMetric] = useState(
    SANDBOX_ENTITY_CONFIG.skater.metrics[0]?.key ?? "ixg_per_60"
  );
  const [scoreData, setScoreData] = useState<ScoresResponse | null>(null);
  const [bandData, setBandData] = useState<BandsResponse | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [bandLoading, setBandLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bandError, setBandError] = useState<string | null>(null);

  const entityConfig = SANDBOX_ENTITY_CONFIG[entityType];
  const selectedEntityId = selectedEntity?.id ?? null;
  const initialMetricKey = entityConfig.metrics[0]?.key ?? "";

  useEffect(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedEntity(null);
    setSelectedMetric(initialMetricKey);
    setBandData(null);
    setErrorMessage(null);
    setBandError(null);
  }, [entityType, initialMetricKey]);

  useEffect(() => {
    if (entityType === "team") {
      setSearchResults([]);
      return;
    }

    if (searchQuery.trim().length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          entityType,
          q: searchQuery.trim(),
          limit: "12"
        });
        const response = await fetch(
          `/api/v1/sustainability/entity-options?${params.toString()}`
        );
        const json = (await response.json()) as {
          success: boolean;
          options?: EntityOption[];
          message?: string;
        };

        if (cancelled) return;
        if (!response.ok || !json.success) {
          throw new Error(json.message ?? "Failed to search entities");
        }
        setSearchResults(json.options ?? []);
      } catch (error: any) {
        if (!cancelled) {
          setSearchResults([]);
          setErrorMessage(error?.message ?? "Unable to search right now.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [entityType, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    setScoreLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams({
      entityType,
      date: requestedDate,
      windowCode,
      limit: "80"
    });
    if (selectedEntityId != null) {
      params.set("entityId", String(selectedEntityId));
    }

    fetch(`/api/v1/sustainability/entity-scores?${params.toString()}`)
      .then(async (response) => {
        const json = (await response.json()) as ScoresResponse & {
          success: boolean;
          message?: string;
        };
        if (cancelled) return;
        if (!response.ok || !json.success) {
          throw new Error(json.message ?? "Failed to load sustainability scores");
        }
        setScoreData(json);
      })
      .catch((error: any) => {
        if (!cancelled) {
          setScoreData(null);
          setErrorMessage(error?.message ?? "Unable to load sustainability scores.");
        }
      })
      .finally(() => {
        if (!cancelled) setScoreLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityType, requestedDate, selectedEntityId, windowCode]);

  useEffect(() => {
    if (selectedEntityId == null || !selectedMetric) {
      setBandData(null);
      return;
    }

    let cancelled = false;
    setBandLoading(true);
    setBandError(null);

    const params = new URLSearchParams({
      entityType,
      entityId: String(selectedEntityId),
      date: requestedDate,
      windowCode,
      metricKey: selectedMetric,
      limit: "180"
    });

    fetch(`/api/v1/sustainability/entity-bands?${params.toString()}`)
      .then(async (response) => {
        const json = (await response.json()) as BandsResponse & {
          success: boolean;
          message?: string;
        };
        if (cancelled) return;
        if (!response.ok || !json.success) {
          throw new Error(json.message ?? "Failed to load elasticity bands");
        }
        setBandData(json);
      })
      .catch((error: any) => {
        if (!cancelled) {
          setBandData(null);
          setBandError(error?.message ?? "Unable to load elasticity bands.");
        }
      })
      .finally(() => {
        if (!cancelled) setBandLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityType, requestedDate, selectedEntityId, selectedMetric, windowCode]);

  const activeRow = useMemo(() => {
    if (!selectedEntity) return null;
    return (
      scoreData?.selectedRow ??
      scoreData?.rows.find((row) => row.entityId === selectedEntity.id) ??
      null
    );
  }, [scoreData, selectedEntity]);

  const bandRows = useMemo(() => {
    if (!bandData?.currentRows) return [];
    return [...bandData.currentRows].sort((a, b) =>
      a.metricLabel.localeCompare(b.metricLabel)
    );
  }, [bandData]);

  const leaderboard = useMemo(() => {
    const rows = scoreData?.rows ?? [];
    return {
      overperforming: rows
        .filter((row) => row.expectationState === "overperforming")
        .slice(0, 5),
      stable: rows.filter((row) => row.expectationState === "stable").slice(0, 5),
      underperforming: rows
        .filter((row) => row.expectationState === "underperforming")
        .slice(0, 5)
    };
  }, [scoreData]);

  const reasonHighlights = useMemo(
    () => extractReasonHighlights(activeRow?.components),
    [activeRow]
  );

  const resetState = () => {
    setEntityType("skater");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedEntity(null);
    setRequestedDate(DEFAULT_DATE);
    setWindowCode("l5");
    setSelectedMetric(SANDBOX_ENTITY_CONFIG.skater.metrics[0]?.key ?? "ixg_per_60");
    setScoreData(null);
    setBandData(null);
    setErrorMessage(null);
    setBandError(null);
  };

  return (
    <div className={styles.page}>
      <DashboardPillarHero
        eyebrow="Workshop pillar"
        title="Trends Sandbox"
        description={
          <p>
            This is the sustainability lab for teams, skaters, and goalies.
            Use season baseline plus rolling expectation bands to test whether
            current performance looks sustainable, overheated, or cold.
          </p>
        }
        emphasis="Sustainability meter"
        owns={[
          "Team, skater, and goalie sustainability reads against baseline expectation",
          "Threshold-band views that classify overperformance, underperformance, and stability",
          "Transparent reasoning inputs before these concepts harden into production surfaces"
        ]}
        defers={[
          "Fast production trend scans and weekly decision support",
          "Full team-strength and process diagnosis"
        ]}
        surfaceLinks={TRENDS_SURFACE_LINKS.slice(0, 3)}
        actions={
          <button
            type="button"
            onClick={resetState}
            className={styles.resetButton}
          >
            Reset
          </button>
        }
      />

      <section className={styles.entityTabs}>
        {(["team", "skater", "goalie"] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={
              type === entityType ? styles.entityTabActive : styles.entityTab
            }
            onClick={() => setEntityType(type)}
          >
            {SANDBOX_ENTITY_CONFIG[type].label}
          </button>
        ))}
      </section>

      <section className={styles.controls}>
        <div className={styles.controlGroup}>
          <label htmlFor="entity-date">Snapshot Date</label>
          <input
            id="entity-date"
            type="date"
            value={requestedDate}
            onChange={(event) => setRequestedDate(event.target.value)}
          />
        </div>

        <div className={styles.controlGroup}>
          <span>Window</span>
          <div className={styles.windowButtons}>
            {WINDOW_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={
                  option === windowCode
                    ? styles.windowButtonActive
                    : styles.windowButton
                }
                onClick={() => setWindowCode(option)}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {entityType === "team" ? (
          <div className={styles.controlGroup}>
            <label htmlFor="team-select">Team</label>
            <select
              id="team-select"
              value={selectedEntity?.id ?? ""}
              onChange={(event) => {
                const next = TEAM_OPTIONS.find(
                  (option) => option.id === Number(event.target.value)
                );
                setSelectedEntity(next ?? null);
              }}
            >
              <option value="">Select a team</option>
              {TEAM_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className={styles.controlGroup}>
            <label htmlFor="entity-search">{entityConfig.label.slice(0, -1)}</label>
            <input
              id="entity-search"
              type="search"
              placeholder={entityConfig.searchPlaceholder}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setErrorMessage(null);
              }}
            />
            {searching && <span className={styles.status}>Searching…</span>}
            {!searching && searchResults.length > 0 && (
              <ul className={styles.playerResults}>
                {searchResults.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEntity(option);
                        setSearchQuery(option.name);
                        setSearchResults([]);
                      }}
                    >
                      <span>{option.name}</span>
                      {option.subtitle ? (
                        <span className={styles.positionTag}>
                          {option.subtitle}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={styles.controlGroup}>
          <label htmlFor="metric-select">Band Metric</label>
          <select
            id="metric-select"
            value={selectedMetric}
            onChange={(event) => setSelectedMetric(event.target.value)}
          >
            {entityConfig.metrics.map((metric) => (
              <option key={metric.key} value={metric.key}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.controlGroup}>
          <span>Entity Contract</span>
          <div className={styles.readinessCopy}>{entityConfig.readinessCopy}</div>
        </div>
      </section>

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      <section className={styles.summary}>
        <div>
          <strong>Entity Type</strong>
          <span>{entityConfig.label}</span>
        </div>
        <div>
          <strong>Selected Entity</strong>
          <span>{selectedEntity?.name ?? "—"}</span>
        </div>
        <div>
          <strong>Snapshot Used</strong>
          <span>{scoreData?.snapshotDate ?? "—"}</span>
        </div>
        <div>
          <strong>Rows Available</strong>
          <span>{scoreLoading ? "Loading…" : scoreData?.totalRows ?? "0"}</span>
        </div>
        <div>
          <strong>Selected Window</strong>
          <span>{windowCode.toUpperCase()}</span>
        </div>
      </section>

      <section className={styles.sustainabilityGrid}>
        <article className={styles.surfaceCard}>
          <div className={styles.surfaceCardHeader}>
            <h2 className={styles.surfaceCardTitle}>Sustainability Meter</h2>
            <span className={styles.surfaceCardMeta}>
              {activeRow ? formatStateLabel(activeRow.expectationState) : "Awaiting selection"}
            </span>
          </div>
          {activeRow ? (
            <div className={styles.meterBlock}>
              <div className={`${styles.meterScore} ${scoreToneClass(activeRow.expectationState)}`}>
                {formatNumber(activeRow.score, 2)}
              </div>
              <div className={styles.meterMeta}>
                <div>
                  <strong>State</strong>
                  <span>{formatStateLabel(activeRow.expectationState)}</span>
                </div>
                <div>
                  <strong>Raw Score</strong>
                  <span>{formatNumber(activeRow.rawScore, 2)}</span>
                </div>
                <div>
                  <strong>Z-Score</strong>
                  <span>{formatNumber(activeRow.zScore, 2)}</span>
                </div>
                <div>
                  <strong>Recent vs Expected</strong>
                  <span>
                    {activeRow.recentValue != null && activeRow.expectedValue != null
                      ? formatDelta(activeRow.recentValue - activeRow.expectedValue, 2)
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.bandEmpty}>
              Select an entity to load the sustainability meter.
            </div>
          )}
        </article>

        <article className={styles.surfaceCard}>
          <div className={styles.surfaceCardHeader}>
            <h2 className={styles.surfaceCardTitle}>Expectation Inputs</h2>
            <span className={styles.surfaceCardMeta}>Interpretability</span>
          </div>
          {activeRow ? (
            <div className={styles.detailGrid}>
              <div>
                <strong>Baseline</strong>
                <span>{formatNumber(activeRow.baselineValue, 2)}</span>
              </div>
              <div>
                <strong>Recent</strong>
                <span>{formatNumber(activeRow.recentValue, 2)}</span>
              </div>
              <div>
                <strong>Expected</strong>
                <span>{formatNumber(activeRow.expectedValue, 2)}</span>
              </div>
              <div>
                <strong>Scope</strong>
                <span>{activeRow.metricScope}</span>
              </div>
            </div>
          ) : (
            <div className={styles.bandEmpty}>
              Baseline, recent, and expected fields will appear here for the
              selected entity when available.
            </div>
          )}
        </article>

        <article className={styles.surfaceCard}>
          <div className={styles.surfaceCardHeader}>
            <h2 className={styles.surfaceCardTitle}>Metric Set</h2>
            <span className={styles.surfaceCardMeta}>{entityConfig.label}</span>
          </div>
          <ul className={styles.metricList}>
            {entityConfig.metrics.map((metric) => (
              <li key={metric.key} className={styles.metricRow}>
                <div>
                  <strong>{metric.label}</strong>
                  <span>{metric.description}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className={styles.surfaceSection}>
        <div className={styles.bandHeader}>
          <h2>Reasoning Inputs</h2>
          <span className={styles.bandStatus}>What is driving the state</span>
        </div>
        {reasonHighlights.length > 0 ? (
          <div className={styles.reasonGrid}>
            {reasonHighlights.map((reason) => (
              <div key={reason.key} className={styles.reasonCard}>
                <div className={styles.reasonLabel}>{reason.label}</div>
                <div className={styles.reasonValue}>
                  {formatDelta(reason.value, 2)}
                </div>
                <p className={styles.reasonSentence}>{reason.sentence}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.bandEmpty}>
            {activeRow
              ? "No interpretable component breakdown is available for this row yet."
              : "Select an entity to inspect the reasoning inputs behind its sustainability state."}
          </div>
        )}
      </section>

      <section className={styles.surfaceSection}>
        <div className={styles.bandHeader}>
          <h2>Entity Snapshot Board</h2>
          <span className={styles.bandStatus}>
            Overperforming, stable, and underperforming reads
          </span>
        </div>
        <div className={styles.leaderboardGrid}>
          {(["overperforming", "stable", "underperforming"] as const).map(
            (state) => (
              <div key={state} className={styles.leaderboardCard}>
                <div className={styles.leaderboardTitle}>
                  {formatStateLabel(state)}
                </div>
                {(leaderboard[state] ?? []).length > 0 ? (
                  <ul className={styles.leaderboardList}>
                    {leaderboard[state].map((row) => (
                      <li key={`${row.entityType}-${row.entityId}`} className={styles.leaderboardRow}>
                        <button
                          type="button"
                          className={styles.leaderboardButton}
                          onClick={() =>
                            setSelectedEntity({
                              id: row.entityId,
                              name: row.entityName,
                              subtitle: row.entitySubtitle,
                              imageUrl: null
                            })
                          }
                        >
                          <span>{row.entityName}</span>
                          <span>{formatNumber(row.score, 1)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.bandEmpty}>No rows in this state.</div>
                )}
              </div>
            )
          )}
        </div>
      </section>

      <section className={styles.bandSection}>
        <div className={styles.bandHeader}>
          <h2>Threshold Bands</h2>
          {bandLoading && <span className={styles.bandStatus}>Updating…</span>}
          {bandError && <span className={styles.error}>{bandError}</span>}
        </div>
        <div className={styles.bandGrid}>
          {bandRows.length > 0 ? (
            bandRows.map((row) => {
              const statusClass =
                row.value > row.ciUpper
                  ? styles.bandHot
                  : row.value < row.ciLower
                    ? styles.bandCold
                    : styles.bandNeutral;
              return (
                <button
                  key={`${row.metricKey}-${row.windowCode}`}
                  type="button"
                  className={`${styles.bandCard} ${statusClass}`}
                  onClick={() => setSelectedMetric(row.metricKey)}
                >
                  <div className={styles.bandMetric}>{row.metricLabel}</div>
                  <div className={styles.bandValue}>{row.value.toFixed(2)}</div>
                  <div className={styles.bandRange}>
                    {row.ciLower.toFixed(2)} – {row.ciUpper.toFixed(2)}
                  </div>
                  {row.baseline != null && (
                    <div className={styles.bandBaseline}>
                      Baseline {row.baseline.toFixed(2)}
                    </div>
                  )}
                  <div className={styles.bandWindow}>
                    Window {row.windowCode.toUpperCase()}
                  </div>
                </button>
              );
            })
          ) : (
            <div className={styles.bandEmpty}>
              {selectedEntity
                ? "No band rows are available yet for the selected entity."
                : "Select an entity to load threshold bands."}
            </div>
          )}
        </div>
      </section>

      <section className={styles.bandChartSection}>
        <ElasticityBandChart
          data={bandData?.historyRows ?? []}
          loading={bandLoading}
          error={bandError}
        />
      </section>
    </div>
  );
}
